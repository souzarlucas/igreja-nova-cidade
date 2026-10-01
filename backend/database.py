from pathlib import Path


class LocalDatabase:
    def __init__(self, path):
        import sqlite3

        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(
            path, isolation_level=None, check_same_thread=False
        )
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA foreign_keys=ON")
        self.connection.execute("PRAGMA journal_mode=WAL")

    def migrate(self):
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)"
        )
        for file in sorted((Path(__file__).parent.parent / "drizzle").glob("*.sql")):
            if self.connection.execute(
                "SELECT name FROM schema_migrations WHERE name=?", (file.name,)
            ).fetchone():
                continue
            statements = (
                file.read_text().replace("--> statement-breakpoint", "").split(";")
            )
            self.connection.execute("BEGIN IMMEDIATE")
            try:
                for sql in statements:
                    if sql.strip():
                        self.connection.execute(sql)
                self.connection.execute(
                    "INSERT INTO schema_migrations VALUES (?)", (file.name,)
                )
                self.connection.execute("COMMIT")
            except Exception:
                self.connection.execute("ROLLBACK")
                raise

    async def all(self, sql, *params):
        return [dict(r) for r in self.connection.execute(sql, params).fetchall()]

    async def first(self, sql, *params):
        r = self.connection.execute(sql, params).fetchone()
        return dict(r) if r else None

    async def run(self, sql, *params):
        c = self.connection.execute(sql, params)
        return {"changes": max(0, c.rowcount)}

    async def batch(self, operations):
        self.connection.execute("BEGIN IMMEDIATE")
        try:
            result = []
            for sql, params in operations:
                result.append(await self.run(sql, *params))
            self.connection.execute("COMMIT")
            return result
        except Exception:
            self.connection.execute("ROLLBACK")
            raise


class D1Database:
    def __init__(self, binding):
        self.binding = binding

    def statement(self, sql, params):
        prepared = self.binding.prepare(sql)
        return prepared.bind(*params) if params else prepared

    @staticmethod
    def convert(value):
        if value is None:
            return None
        return value.to_py() if hasattr(value, "to_py") else value

    async def all(self, sql, *params):
        result = self.convert(await self.statement(sql, params).all())
        return result["results"]

    async def first(self, sql, *params):
        return self.convert(await self.statement(sql, params).first())

    async def run(self, sql, *params):
        result = self.convert(await self.statement(sql, params).run())
        return {"changes": result["meta"]["changes"]}

    async def batch(self, operations):
        statements = [self.statement(sql, params) for sql, params in operations]
        result = self.convert(await self.binding.batch(statements))
        return [{"changes": r["meta"]["changes"]} for r in result]
