import json, os, secrets, hmac, time, logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError

try:
    from .models import SCHEMAS, UserInput
    from .security import (
        digest,
        hash_password,
        verify_password,
        launch_allowed,
        can_finance,
        global_finance,
        can_write,
    )
    from .database import LocalDatabase, D1Database
except ImportError:
    from models import SCHEMAS, UserInput
    from security import (
        digest,
        hash_password,
        verify_password,
        launch_allowed,
        can_finance,
        global_finance,
        can_write,
    )
    from database import LocalDatabase, D1Database


logger = logging.getLogger("church")
KINDS = list(SCHEMAS)
FINANCIAL = {"budgets", "expenses", "incomes", "requests"}


class ApiError(Exception):
    def __init__(self, message, status=400):
        self.message = message
        self.status = status


def now_ms():
    return int(time.time() * 1000)


def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def setting(request, key, default=""):
    env = request.scope.get("env")
    return getattr(env, key, default) if env else os.getenv(key, default)


def get_db(request):
    env = request.scope.get("env")
    if env:
        if not getattr(env, "DB", None):
            raise ApiError("Banco indisponível", 503)
        return D1Database(env.DB)
    return request.app.state.database


def public_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "ministry": user["ministry"],
        "active": user["active"],
        "financeAccess": bool(user.get("finance_access")),
        "isOwner": bool(user.get("is_owner")),
        "canFinance": can_finance(user),
    }


async def current(request, db):
    token = request.cookies.get("church_session")
    if not token:
        return None
    return await db.first(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.active=1",
        digest(token),
        now_ms(),
    )


async def audit(db, user, action, target, detail=None):
    await db.run(
        "INSERT INTO audit(id,user,action,target,time,detail) VALUES(?,?,?,?,?,?)",
        secrets.token_hex(16),
        user["id"],
        action,
        target,
        now_ms(),
        dump(detail or {}),
    )


def audit_statement(user, action, target, detail=None):
    return (
        "INSERT INTO audit(id,user,action,target,time,detail) VALUES(?,?,?,?,?,?)",
        (
            secrets.token_hex(16),
            user["id"],
            action,
            target,
            now_ms(),
            dump(detail or {}),
        ),
    )


def owner(user):
    if user["role"] != "admin" or not user.get("is_owner"):
        raise ApiError(
            "Somente o administrador principal pode gerenciar autorizações.", 403
        )


def small_string(value, maximum=100):
    if not isinstance(value, str) or len(value) > maximum:
        raise ApiError("Campo inválido")
    return value


async def ministry_valid(db, ministry, allow_church=False):
    if allow_church and ministry == "":
        return
    if not await db.first(
        "SELECT id FROM records WHERE kind='ministries' AND id=?", ministry
    ):
        raise ApiError("Selecione um ministério válido.")


async def state(request):
    db = get_db(request)
    user = await current(request, db)
    if not user:
        return {
            "user": None,
            "setup": not bool(await db.first("SELECT id FROM users LIMIT 1")),
        }
    data = {kind: [] for kind in KINDS}
    if global_finance(user):
        rows = await db.all(
            "SELECT * FROM records"
            if user["role"] == "admin"
            else "SELECT * FROM records WHERE kind<>'members'"
        )
    else:
        financial = (
            " OR (ministry=? AND kind IN ('budgets','expenses','incomes','requests'))"
            if can_finance(user)
            else ""
        )
        members = (
            " OR (kind='members' AND ministry=?)" if user["role"] == "ministry" else ""
        )
        args = []
        if financial:
            args.append(user["ministry"])
        if members:
            args.append(user["ministry"])
        rows = await db.all(
            "SELECT * FROM records WHERE kind IN ('events','ministries','settings')"
            + financial
            + members,
            *args,
        )
    for row in rows:
        kind = row["kind"]
        if kind not in data:
            continue
        value = {
            **json.loads(row["data"]),
            "id": row["id"],
            "ministry": row["ministry"],
        }
        if kind == "events" and (
            not can_finance(user)
            or not global_finance(user)
            and row["ministry"] != user["ministry"]
        ):
            value.pop("amount", None)
        if (
            kind == "ministries"
            and user["role"] != "admin"
            and (user["role"] != "ministry" or row["id"] != user["ministry"])
        ):
            value = {
                key: value.get(key, "")
                for key in ("id", "ministry", "name", "leader", "area", "description")
            }
        data[kind].append(value)
    people = (
        await db.all("SELECT * FROM users")
        if user["role"] == "admin" and user.get("is_owner")
        else []
    )
    history = (
        await db.all(
            "SELECT a.*,u.name FROM audit a LEFT JOIN users u ON a.user=u.id ORDER BY a.time DESC LIMIT 100"
        )
        if user["role"] == "admin"
        else []
    )
    return {
        "user": public_user(user),
        "data": data,
        "users": [public_user(u) for u in people],
        "audit": history,
    }


async def login(request, body, db):
    email = small_string(body.get("email", ""), 200).strip().lower()
    if "@" not in email:
        raise ApiError("E-mail ou senha inválidos.", 401)
    password = small_string(body.get("password", ""), 128)
    if not password:
        raise ApiError("E-mail ou senha inválidos.", 401)
    ip = request.headers.get("cf-connecting-ip") or (
        request.client.host if request.client else "unknown"
    )
    keys = [(digest(email + "|" + ip), 5), (digest("ip|" + ip), 30)]
    for key, limit in keys:
        attempt = await db.first("SELECT * FROM attempts WHERE key=?", key)
        if attempt and attempt["until"] > now_ms() and attempt["count"] >= limit:
            raise ApiError("Muitas tentativas. Aguarde 15 minutos.", 429)
    user = await db.first("SELECT * FROM users WHERE email=? AND active=1", email)
    stored = user["password"] if user else "pbkdf2_sha256_chain_v1$6$dummy-salt$" + "0" * 64
    if not await verify_password(password, stored) or not user:
        operations = []
        for key, _ in keys:
            operations.append(
                (
                    "INSERT INTO attempts(key,count,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=?",
                    (key, now_ms() + 900000, now_ms(), now_ms() + 900000),
                )
            )
        await db.batch(operations)
        raise ApiError("E-mail ou senha inválidos.", 401)
    token = secrets.token_urlsafe(48)
    operations = [
        ("DELETE FROM attempts WHERE key=?", (keys[0][0],)),
        ("DELETE FROM sessions WHERE expires<?", (now_ms(),)),
        (
            "INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)",
            (digest(token), user["id"], now_ms() + 8 * 3600000),
        ),
        audit_statement(user, "login", user["id"]),
    ]
    if not stored.startswith("pbkdf2_sha256$"):
        operations.append(
            (
                "UPDATE users SET password=? WHERE id=?",
                (await hash_password(password), user["id"]),
            )
        )
    await db.batch(operations)
    response = JSONResponse({"ok": True})
    response.set_cookie(
        "church_session",
        token,
        max_age=28800,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="strict",
        path="/",
    )
    return response


async def handle(request, body):
    db = get_db(request)
    action = body.get("action")
    if action == "setup":
        secret = setting(request, "SETUP_TOKEN")
        provided = body.get("token")
        if (
            not secret
            or not isinstance(provided, str)
            or not hmac.compare_digest(secret, provided)
        ):
            raise ApiError("Código de configuração inválido.", 403)
        payload = UserInput.model_validate(
            {
                "email": body.get("email"),
                "name": body.get("name"),
                "password": body.get("password"),
                "role": "admin",
            }
        )
        if len(payload.password) < 12:
            raise ApiError("A senha deve ter pelo menos 12 caracteres.")
        result = await db.run(
            "INSERT INTO users(id,email,name,role,ministry,password,active,finance_access,is_owner) SELECT ?,?,?,'admin','',?,1,1,1 WHERE NOT EXISTS(SELECT 1 FROM users)",
            secrets.token_hex(16),
            payload.email,
            payload.name,
            await hash_password(payload.password),
        )
        if not result["changes"]:
            raise ApiError("A configuração inicial já foi concluída.", 409)
        return await login(request, body, db)
    if action == "login":
        return await login(request, body, db)
    user = await current(request, db)
    if not user:
        raise ApiError("Faça login para continuar.", 401)
    if action == "logout":
        await db.run(
            "DELETE FROM sessions WHERE token=?",
            digest(request.cookies.get("church_session", "")),
        )
        response = JSONResponse({"ok": True})
        response.delete_cookie(
            "church_session",
            path="/",
            httponly=True,
            samesite="strict",
            secure=request.url.scheme == "https",
        )
        return response
    if action in {
        "user",
        "updateUser",
        "setFinanceAccess",
        "disableUser",
        "enableUser",
        "password",
    }:
        owner(user)
        if action == "user":
            payload = UserInput.model_validate(body.get("data"))
            if len(payload.password) < 12:
                raise ApiError("A senha deve ter pelo menos 12 caracteres.")
            if payload.role in {"ministry", "member"}:
                await ministry_valid(db, payload.ministry)
            identifier = secrets.token_hex(16)
            await db.batch(
                [
                    (
                        "INSERT INTO users(id,email,name,role,ministry,password,active,finance_access,is_owner) VALUES(?,?,?,?,?,?,1,?,0)",
                        (
                            identifier,
                            payload.email,
                            payload.name,
                            payload.role,
                            payload.ministry,
                            await hash_password(payload.password),
                            int(payload.financeAccess),
                        ),
                    ),
                    audit_statement(
                        user,
                        "criou usuário",
                        identifier,
                        {"role": payload.role, "financeAccess": payload.financeAccess},
                    ),
                ]
            )
            return {"ok": True}
        identifier = small_string(body.get("id", ""))
        target = await db.first("SELECT * FROM users WHERE id=?", identifier)
        if not target:
            raise ApiError("Usuário não encontrado.", 404)
        if action == "password":
            password = small_string(body.get("password", ""), 128)
            if len(password) < 12:
                raise ApiError("A senha deve ter pelo menos 12 caracteres.")
            await db.batch(
                [
                    (
                        "UPDATE users SET password=? WHERE id=?",
                        (await hash_password(password), identifier),
                    ),
                    ("DELETE FROM sessions WHERE user_id=?", (identifier,)),
                    audit_statement(user, "redefiniu senha", identifier),
                ]
            )
        elif action in {"disableUser", "enableUser"}:
            if target.get("is_owner"):
                raise ApiError(
                    "A conta do administrador principal não pode ser desativada.", 403
                )
            active = int(action == "enableUser")
            await db.batch(
                [
                    ("UPDATE users SET active=? WHERE id=?", (active, identifier)),
                    ("DELETE FROM sessions WHERE user_id=?", (identifier,)),
                    audit_statement(
                        user,
                        "ativou usuário" if active else "desativou usuário",
                        identifier,
                    ),
                ]
            )
        elif action == "setFinanceAccess":
            if target["role"] == "admin":
                raise ApiError("O perfil Admin já possui acesso administrativo.")
            allowed = body.get("allowed")
            if type(allowed) is not bool:
                raise ApiError("Autorização inválida.")
            if allowed and target["role"] in {"member", "ministry"}:
                await ministry_valid(db, target["ministry"])
            await db.batch(
                [
                    (
                        "UPDATE users SET finance_access=? WHERE id=?",
                        (int(allowed), identifier),
                    ),
                    ("DELETE FROM sessions WHERE user_id=?", (identifier,)),
                    audit_statement(
                        user,
                        "liberou financeiro" if allowed else "bloqueou financeiro",
                        identifier,
                    ),
                ]
            )
        else:
            payload = UserInput.model_validate({**body.get("data", {}), "password": ""})
            if target.get("is_owner") and payload.role != "admin":
                raise ApiError("O administrador principal deve manter o perfil Admin.")
            if payload.role in {"member", "ministry"}:
                await ministry_valid(db, payload.ministry)
            await db.batch(
                [
                    (
                        "UPDATE users SET email=?,name=?,role=?,ministry=?,finance_access=? WHERE id=?",
                        (
                            payload.email,
                            payload.name,
                            payload.role,
                            payload.ministry,
                            int(payload.financeAccess),
                            identifier,
                        ),
                    ),
                    ("DELETE FROM sessions WHERE user_id=?", (identifier,)),
                    audit_statement(
                        user,
                        "alterou perfil",
                        identifier,
                        {"role": payload.role, "financeAccess": payload.financeAccess},
                    ),
                ]
            )
        return {"ok": True}
    if action == "decideRequest":
        if not global_finance(user):
            raise ApiError("Você não está autorizado a aprovar recursos.", 403)
        identifier = small_string(body.get("id", ""))
        row = await db.first(
            "SELECT * FROM records WHERE id=? AND kind='requests'", identifier
        )
        if not row:
            raise ApiError("Pedido não encontrado.", 404)
        data = json.loads(row["data"])
        if data["createdBy"] == user["id"]:
            raise ApiError("Você não pode aprovar ou rejeitar o próprio pedido.", 403)
        if data["status"] != "Pendente":
            raise ApiError("Este pedido já recebeu uma decisão.", 409)
        decision = body.get("decision")
        if decision not in {"Aprovado", "Rejeitado"}:
            raise ApiError("Decisão inválida.")
        comment = small_string(body.get("comment", ""), 4000).strip()
        if decision == "Rejeitado" and len(comment) < 10:
            raise ApiError("Informe o motivo da rejeição (mínimo 10 caracteres).")
        marker = secrets.token_hex(16)
        updated = {
            **data,
            "status": decision,
            "decidedBy": user["id"],
            "decidedByName": user["name"],
            "decisionComment": comment,
            "decidedAt": now_ms(),
            "decisionId": marker,
        }
        clause = ""
        args = [dump(updated), now_ms(), identifier, user["id"]]
        if decision == "Aprovado":
            year = int(data["date"][:4])
            month = int(data["date"][5:7])
            area = data["area"]
            limits = await db.all(
                "SELECT json_extract(data,'$.month') AS month FROM records WHERE kind='budgets' AND ministry=? AND json_extract(data,'$.year')=? AND json_extract(data,'$.month') IN (0,?) AND lower(json_extract(data,'$.area'))=lower(?)",
                row["ministry"],
                year,
                month,
                area,
            )
            if not limits:
                raise ApiError(
                    "Defina o orçamento da categoria antes de aprovar recursos.", 409
                )
            for limit in limits:
                budget_month = limit["month"]
                period = data["date"][:7] if budget_month else data["date"][:4]
                clause += """ AND ? <=
            (SELECT coalesce(sum(json_extract(data,'$.amount')),0) FROM records WHERE kind='budgets' AND ministry=? AND json_extract(data,'$.year')=? AND json_extract(data,'$.month')=? AND lower(json_extract(data,'$.area'))=lower(?))
            - (SELECT coalesce(sum(json_extract(data,'$.amount')),0) FROM records WHERE kind='expenses' AND ministry=? AND substr(json_extract(data,'$.date'),1,?)=? AND lower(json_extract(data,'$.area'))=lower(?))
            - (SELECT coalesce(sum(max(0,json_extract(r.data,'$.amount')-coalesce((SELECT sum(json_extract(e.data,'$.amount')) FROM records e WHERE e.kind='expenses' AND json_extract(e.data,'$.requestId')=r.id),0))),0) FROM records r WHERE r.kind='requests' AND r.ministry=? AND json_extract(r.data,'$.status')='Aprovado' AND substr(json_extract(r.data,'$.date'),1,?)=? AND lower(json_extract(r.data,'$.area'))=lower(?))"""
                args.extend(
                    [
                        data["amount"],
                        row["ministry"],
                        year,
                        budget_month,
                        area,
                        row["ministry"],
                        len(period),
                        period,
                        area,
                        row["ministry"],
                        len(period),
                        period,
                        area,
                    ]
                )
        change_sql = (
            "UPDATE records SET data=?,updated=? WHERE id=? AND kind='requests' AND json_extract(data,'$.status')='Pendente' AND json_extract(data,'$.createdBy')<>?"
            + clause
        )
        log_sql = "INSERT INTO audit(id,user,action,target,time,detail) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,'$.decisionId')=?)"
        results = await db.batch(
            [
                (change_sql, tuple(args)),
                (
                    log_sql,
                    (
                        secrets.token_hex(16),
                        user["id"],
                        "decidiu pedido",
                        identifier,
                        now_ms(),
                        dump({"decision": decision, "comment": comment}),
                        identifier,
                        marker,
                    ),
                ),
            ]
        )
        if not results[0]["changes"]:
            raise ApiError(
                "Orçamento disponível insuficiente para aprovar este pedido, ou ele já foi decidido. Defina/revise o orçamento da categoria.",
                409,
            )
        return {"ok": True}
    if action != "save":
        raise ApiError("Operação inválida.")
    kind = body.get("kind")
    if kind not in SCHEMAS or not can_write(user["role"], kind):
        raise ApiError("Você não tem permissão para esta operação.", 403)
    if kind in FINANCIAL and not can_finance(user):
        raise ApiError(
            "O administrador principal ainda não liberou seu acesso financeiro.", 403
        )
    payload = SCHEMAS[kind].model_validate(body.get("data", {}))
    data = payload.model_dump()
    ministry = small_string(body.get("ministry", ""))
    identifier = (
        "settings"
        if kind == "settings"
        else small_string(body.get("id") or secrets.token_hex(16))
    )
    old = await db.first("SELECT * FROM records WHERE id=?", identifier)
    if old and (
        old["kind"] != kind
        or user["role"] == "ministry"
        and (old["id"] if kind == "ministries" else old["ministry"]) != user["ministry"]
    ):
        raise ApiError("Operação não permitida.", 403)
    if kind == "ministries" and old:
        data["area"] = json.loads(old["data"]).get("area", "")
    if user["role"] == "ministry":
        if kind == "ministries":
            if not old or identifier != user["ministry"]:
                raise ApiError("Você só pode editar seu próprio ministério.", 403)
            ministry = old["ministry"]
        elif ministry != user["ministry"]:
            raise ApiError("Ministério não permitido.", 403)
        config = await db.first(
            "SELECT data FROM records WHERE kind='settings' LIMIT 1"
        )
        if not launch_allowed(json.loads(config["data"])["deadline"] if config else 10):
            raise ApiError(
                "O prazo de lançamento terminou. O acesso está em consulta.", 403
            )
        if kind == "events" and not can_finance(user) and data.get("amount", 0):
            raise ApiError(
                "Você não está autorizado a informar valores financeiros.", 403
            )
    if kind in {"members", "events", "budgets", "expenses", "incomes", "requests"}:
        await ministry_valid(
            db,
            ministry,
            allow_church=kind in {"budgets", "expenses", "incomes"}
            and global_finance(user),
        )
    if data.get("event") and not await db.first(
        "SELECT id FROM records WHERE id=? AND kind='events' AND ministry=?",
        data["event"],
        ministry,
    ):
        raise ApiError("O evento deve pertencer ao mesmo ministério.")
    if kind == "requests":
        if old:
            raise ApiError(
                "Pedidos enviados não podem ser alterados. Uma nova solicitação deve ser enviada.",
                409,
            )
        data.update(
            {
                "status": "Pendente",
                "createdBy": user["id"],
                "createdByName": user["name"],
                "createdAt": now_ms(),
            }
        )
    budget_key = None
    if kind == "budgets":
        budget_key = (
            f"{ministry}:{data['year']}:{data['month']}:{data['area'].casefold()}"
        )
        conflict = await db.first(
            "SELECT id FROM records WHERE kind='budgets' AND ministry=? AND json_extract(data,'$.year')=? AND json_extract(data,'$.month')=? AND lower(json_extract(data,'$.area'))=lower(?) AND id<>?",
            ministry,
            data["year"],
            data["month"],
            data["area"],
            identifier,
        )
        if conflict:
            raise ApiError(
                "Já existe orçamento para esta categoria e período. Edite o existente.", 409
            )
    params = (identifier, kind, ministry, dump(data), budget_key, now_ms())
    sql = "INSERT INTO records(id,kind,ministry,data,budget_key,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ministry=excluded.ministry,data=excluded.data,budget_key=excluded.budget_key,updated=excluded.updated"
    if kind == "expenses" and data.get("requestId"):
        resource = await db.first(
            "SELECT * FROM records WHERE id=? AND kind='requests' AND ministry=?",
            data["requestId"],
            ministry,
        )
        if not resource or json.loads(resource["data"])["status"] != "Aprovado":
            raise ApiError("Selecione um pedido aprovado do mesmo ministério.")
        if data["area"].casefold() != json.loads(resource["data"])["area"].casefold():
            raise ApiError("A categoria da despesa deve corresponder à categoria aprovada.")
        sql = """INSERT INTO records(id,kind,ministry,data,budget_key,updated) SELECT ?,?,?,?,?,? WHERE ? <=
        (SELECT json_extract(data,'$.amount') FROM records WHERE id=? AND kind='requests' AND json_extract(data,'$.status')='Aprovado')
        - (SELECT coalesce(sum(json_extract(data,'$.amount')),0) FROM records WHERE kind='expenses' AND json_extract(data,'$.requestId')=? AND id<>?)
        ON CONFLICT(id) DO UPDATE SET ministry=excluded.ministry,data=excluded.data,budget_key=excluded.budget_key,updated=excluded.updated"""
        params = params + (
            data["amount"],
            data["requestId"],
            data["requestId"],
            identifier,
        )
    # The write and its audit entry share one database transaction.
    log_sql = "INSERT INTO audit(id,user,action,target,time,detail) SELECT ?,?,?,?,?,? WHERE changes()>0"
    before = json.loads(old["data"]) if old else None
    details = {"before": before, "after": data} if kind in FINANCIAL else {"kind": kind}
    results = await db.batch(
        [
            (sql, params),
            (
                log_sql,
                (
                    secrets.token_hex(16),
                    user["id"],
                    ("editou " if old else "cadastrou ") + kind,
                    identifier,
                    now_ms(),
                    dump(details),
                ),
            ),
        ]
    )
    if not results[0]["changes"]:
        raise ApiError("O valor supera o saldo aprovado do pedido.", 409)
    return {"ok": True, "id": identifier}


def create_app(database=None, serve_static=True):
    app = FastAPI(title="Nova Cidade", docs_url=None, redoc_url=None, openapi_url=None)
    if database:
        app.state.database = database

    @app.middleware("http")
    async def secure(request, call_next):
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("Request failed")
            response = JSONResponse(
                {"error": "Serviço indisponível. Tente novamente."}, status_code=503
            )
        headers = {
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "same-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
            "X-Robots-Tag": "noindex, nofollow, noarchive",
        }
        if request.url.scheme == "https":
            headers["Strict-Transport-Security"] = "max-age=31536000"
        for key, value in headers.items():
            response.headers[key] = value
        return response

    @app.get("/api/system")
    async def get_state(request: Request):
        try:
            return await state(request)
        except ApiError as e:
            return JSONResponse({"error": e.message}, status_code=e.status)

    @app.post("/api/system")
    async def mutate(request: Request):
        try:
            expected = (
                setting(request, "APP_ORIGIN")
                or f"{request.url.scheme}://{request.url.netloc}"
            )
            if request.headers.get("origin") != expected:
                raise ApiError("Origem inválida.", 403)
            if not request.headers.get("content-type", "").startswith(
                "application/json"
            ):
                raise ApiError("Formato inválido.", 415)
            raw = b""
            async for chunk in request.stream():
                raw += chunk
                if len(raw) > 50000:
                    raise ApiError("Solicitação muito grande.", 413)
            body = json.loads(raw)
            if not isinstance(body, dict):
                raise ApiError("Solicitação inválida.")
            result = await handle(request, body)
            return result
        except ApiError as e:
            return JSONResponse({"error": e.message}, status_code=e.status)
        except (ValidationError, ValueError, TypeError, KeyError):
            return JSONResponse(
                {
                    "error": "Revise os campos: valores, datas, justificativas e itens obrigatórios."
                },
                status_code=400,
            )
        except Exception as e:
            if "UNIQUE constraint" in str(e):
                return JSONResponse(
                    {"error": "Este cadastro já existe. Revise os dados."},
                    status_code=409,
                )
            logger.exception("Mutation failed")
            return JSONResponse(
                {"error": "Não foi possível salvar. Tente novamente."}, status_code=503
            )

    @app.get("/{path:path}")
    async def frontend(path: str, request: Request):
        if path.startswith("api/") or path in {"openapi.json", "docs", "redoc"}:
            return Response(status_code=404)
        env = request.scope.get("env")
        if env:
            response = await env.ASSETS.fetch("https://assets.local/" + path)
            return Response(
                content=bytes(await response.bytes()),
                status_code=response.status,
                headers=dict(response.headers),
            )
        # Local production preview serves the same frontend build as the Worker.
        root = Path(__file__).parent.parent / "dist"
        file = (root / path).resolve()
        if not file.is_relative_to(root.resolve()):
            return Response(status_code=404)
        if not file.is_file():
            file = root / "index.html"
        if not file.exists():
            return Response(
                "Execute npm run build para gerar a interface.", status_code=503
            )
        import mimetypes

        return Response(
            file.read_bytes(),
            media_type=mimetypes.guess_type(str(file))[0] or "application/octet-stream",
        )

    return app
