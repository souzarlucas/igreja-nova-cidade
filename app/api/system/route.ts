import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  digest,
  hashPassword,
  verifyPassword,
  launchAllowed,
  canWrite,
} from "../../../lib/security";
const kinds = [
  "ministries",
  "members",
  "events",
  "budgets",
  "expenses",
  "settings",
];
type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  ministry: string;
  password: string;
  active: number;
};
const userSchema = z.object({
  email: z
    .string()
    .email()
    .max(200)
    .transform((s) => s.toLowerCase()),
  name: z.string().min(2).max(120),
  password: z.string().min(12).max(128),
  role: z.enum(["admin", "presbytery", "treasury", "ministry"]),
  ministry: z.string().max(100).default(""),
});
const schemas: Record<string, z.ZodTypeAny> = {
  ministries: z.object({
    name: z.string().min(2).max(120),
    leader: z.string().max(120),
    area: z.string().max(100),
    description: z.string().max(4000),
    email: z.string().max(200),
    phone: z.string().max(40),
  }),
  members: z.object({
    name: z.string().min(2).max(120),
    email: z.string().max(200),
    phone: z.string().max(40),
    position: z.string().max(100),
    birth: z.string().max(20),
    notes: z.string().max(4000),
  }),
  events: z.object({
    name: z.string().min(2).max(160),
    description: z.string().max(4000),
    objective: z.string().max(4000),
    responsible: z.string().min(2).max(120),
    team: z.string().max(1000),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().max(5),
    end: z.string().max(16),
    location: z.string().max(200),
    amount: z.number().int().min(0).max(100000000000),
    status: z.enum(["Programado", "Em andamento", "Concluído", "Atrasado"]),
  }),
  budgets: z.object({
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(0).max(12),
    area: z.string().max(100),
    amount: z.number().int().min(0).max(100000000000),
  }),
  expenses: z.object({
    name: z.string().min(2).max(160),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount: z.number().int().min(1).max(100000000000),
    event: z.string().max(100),
    area: z.string().max(100),
    notes: z.string().max(4000),
  }),
  settings: z.object({ deadline: z.number().int().min(1).max(31) }),
};
function db() {
  if (!env.DB) throw new Error("Banco indisponível");
  return env.DB;
}
function reply(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      ...headers,
    },
  });
}
async function current(r: Request) {
  const token = r.headers
    .get("cookie")
    ?.match(/(?:^|; )church_session=([^;]+)/)?.[1];
  if (!token) return null;
  return await db()
    .prepare(
      "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.active=1",
    )
    .bind(await digest(token), Date.now())
    .first<User>();
}
function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    ministry: u.ministry,
    active: u.active,
  };
}
async function log(u: User, action: string, target: string) {
  await db()
    .prepare(
      "INSERT INTO audit (id,user,action,target,time) VALUES (?,?,?,?,?)",
    )
    .bind(crypto.randomUUID(), u.id, action, target, Date.now())
    .run();
}
export async function GET(r: Request) {
  try {
    const u = await current(r);
    if (!u)
      return reply({
        user: null,
        setup: !(await db().prepare("SELECT id FROM users LIMIT 1").first()),
      });
    const rows = await db()
      .prepare("SELECT * FROM records")
      .all<{ id: string; kind: string; ministry: string; data: string }>();
    const data: Record<string, unknown[]> = Object.fromEntries(
      kinds.map((k) => [k, []]),
    );
    for (const row of rows.results) {
      if (
        u.role === "ministry" &&
        row.kind !== "events" &&
        row.kind !== "settings" &&
        row.ministry !== u.ministry &&
        row.id !== u.ministry
      )
        continue;
      const value = {
        id: row.id,
        ministry: row.ministry,
        ...JSON.parse(row.data),
      };
      if (
        u.role === "ministry" &&
        row.kind === "events" &&
        row.ministry !== u.ministry
      )
        delete value.amount;
      data[row.kind]?.push(value);
    }
    const people = ["admin", "presbytery"].includes(u.role)
      ? (
          await db()
            .prepare("SELECT id,email,name,role,ministry,active FROM users")
            .all()
        ).results
      : [];
    const history = ["admin", "presbytery"].includes(u.role)
      ? (
          await db()
            .prepare(
              "SELECT a.*,u.name FROM audit a LEFT JOIN users u ON a.user=u.id ORDER BY time DESC LIMIT 50",
            )
            .all()
        ).results
      : [];
    return reply({ user: publicUser(u), data, users: people, audit: history });
  } catch (e) {
    console.error("load failed", e);
    return reply(
      { error: "Não foi possível carregar os dados. Tente novamente." },
      503,
    );
  }
}
export async function POST(r: Request) {
  try {
    if (r.headers.get("origin") !== new URL(r.url).origin)
      return reply({ error: "Origem inválida." }, 403);
    if (!r.headers.get("content-type")?.startsWith("application/json"))
      return reply({ error: "Formato inválido." }, 415);
    const raw = await r.text();
    if (raw.length > 20000)
      return reply({ error: "Solicitação muito grande." }, 413);
    const b = JSON.parse(raw);
    const d = db();
    if (b.action === "setup" || b.action === "login") {
      const email = z.string().email().max(200).parse(b.email).toLowerCase();
      const password = z.string().min(1).max(128).parse(b.password);
      if (b.action === "setup") {
        const secret = (env as unknown as Record<string, string>).SETUP_TOKEN;
        if (!secret || b.token !== secret)
          return reply({ error: "Código de configuração inválido." }, 403);
        const input = userSchema.parse({ ...b, role: "admin", ministry: "" });
        const result = await d
          .prepare(
            "INSERT INTO users (id,email,name,role,ministry,password,active) SELECT ?,?,?,'admin','',?,1 WHERE NOT EXISTS (SELECT 1 FROM users)",
          )
          .bind(
            crypto.randomUUID(),
            input.email,
            input.name,
            await hashPassword(input.password),
          )
          .run();
        if (!result.meta.changes)
          return reply(
            { error: "A configuração inicial já foi concluída." },
            409,
          );
      }
      const key = await digest(
        email + "|" + (r.headers.get("cf-connecting-ip") || "local"),
      );
      const attempt = await d
        .prepare("SELECT * FROM attempts WHERE key=?")
        .bind(key)
        .first<{ count: number; until: number }>();
      if (attempt && attempt.until > Date.now() && attempt.count >= 5)
        return reply({ error: "Muitas tentativas. Aguarde 15 minutos." }, 429);
      const u = await d
        .prepare("SELECT * FROM users WHERE email=? AND active=1")
        .bind(email)
        .first<User>();
      const valid = await verifyPassword(
        password,
        u?.password ||
          "invalid:0000000000000000000000000000000000000000000000000000000000000000",
      );
      if (!u || !valid) {
        await d
          .prepare(
            "INSERT INTO attempts (key,count,until) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=?",
          )
          .bind(key, Date.now() + 900000, Date.now(), Date.now() + 900000)
          .run();
        return reply({ error: "E-mail ou senha inválidos." }, 401);
      }
      await d.prepare("DELETE FROM attempts WHERE key=?").bind(key).run();
      const token = crypto.randomUUID() + crypto.randomUUID();
      await d
        .prepare("DELETE FROM sessions WHERE expires<?")
        .bind(Date.now())
        .run();
      await d
        .prepare("INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)")
        .bind(await digest(token), u.id, Date.now() + 8 * 3600000)
        .run();
      await log(u, "login", u.id);
      return reply({ ok: true }, 200, {
        "Set-Cookie": `church_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${new URL(r.url).protocol === "https:" ? "; Secure" : ""}`,
      });
    }
    const u = await current(r);
    if (!u) return reply({ error: "Faça login para continuar." }, 401);
    if (b.action === "logout") {
      const t = r.headers
        .get("cookie")
        ?.match(/(?:^|; )church_session=([^;]+)/)?.[1];
      if (t)
        await d
          .prepare("DELETE FROM sessions WHERE token=?")
          .bind(await digest(t))
          .run();
      return reply({ ok: true }, 200, {
        "Set-Cookie":
          "church_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      });
    }
    if (b.action === "user") {
      if (!["admin", "presbytery"].includes(u.role))
        return reply({ error: "Acesso restrito." }, 403);
      const input = userSchema.parse(b.data);
      if (
        input.role === "ministry" &&
        !(await d
          .prepare("SELECT id FROM records WHERE id=? AND kind='ministries'")
          .bind(input.ministry)
          .first())
      )
        return reply({ error: "Selecione um ministério válido." }, 400);
      const id = crypto.randomUUID();
      await d
        .prepare(
          "INSERT INTO users (id,email,name,role,ministry,password,active) VALUES (?,?,?,?,?,?,1)",
        )
        .bind(
          id,
          input.email,
          input.name,
          input.role,
          input.ministry,
          await hashPassword(input.password),
        )
        .run();
      await log(u, "criou usuário", id);
      return reply({ ok: true });
    }
    if (b.action === "disableUser") {
      if (!["admin", "presbytery"].includes(u.role) || b.id === u.id)
        return reply({ error: "Operação não permitida." }, 403);
      await d.batch([
        d.prepare("UPDATE users SET active=0 WHERE id=?").bind(b.id),
        d.prepare("DELETE FROM sessions WHERE user_id=?").bind(b.id),
      ]);
      await log(u, "desativou usuário", b.id);
      return reply({ ok: true });
    }
    if (b.action === "password") {
      if (!["admin", "presbytery"].includes(u.role))
        return reply({ error: "Acesso restrito." }, 403);
      const password = z.string().min(12).max(128).parse(b.password);
      await d.batch([
        d
          .prepare("UPDATE users SET password=? WHERE id=?")
          .bind(await hashPassword(password), b.id),
        d.prepare("DELETE FROM sessions WHERE user_id=?").bind(b.id),
      ]);
      await log(u, "redefiniu senha", b.id);
      return reply({ ok: true });
    }
    if (
      b.action !== "save" ||
      !kinds.includes(b.kind) ||
      !canWrite(u.role, b.kind)
    )
      return reply(
        { error: "Você não tem permissão para esta operação." },
        403,
      );
    const input = schemas[b.kind].parse(b.data);
    let ministry = z
      .string()
      .max(100)
      .parse(b.ministry || "");
    if (u.role === "ministry") {
      if (ministry !== u.ministry)
        return reply({ error: "Ministério não permitido." }, 403);
      const setting = await d
        .prepare("SELECT data FROM records WHERE kind='settings' LIMIT 1")
        .first<{ data: string }>();
      if (!launchAllowed(setting ? JSON.parse(setting.data).deadline : 10))
        return reply(
          {
            error: "O prazo de lançamento terminou. O acesso está em consulta.",
          },
          403,
        );
    }
    if (
      ["members", "events", "budgets", "expenses"].includes(b.kind) &&
      !(await d
        .prepare("SELECT id FROM records WHERE id=? AND kind='ministries'")
        .bind(ministry)
        .first())
    )
      return reply({ error: "Selecione um ministério válido." }, 400);
    if (b.kind === "events" && input.end && input.end.slice(0, 10) < input.date)
      return reply({ error: "O término deve ser posterior ao início." }, 400);
    if (
      b.kind === "expenses" &&
      input.event &&
      !(await d
        .prepare(
          "SELECT id FROM records WHERE id=? AND kind='events' AND ministry=?",
        )
        .bind(input.event, ministry)
        .first())
    )
      return reply(
        { error: "O evento deve pertencer ao mesmo ministério." },
        400,
      );
    const id =
      b.kind === "settings"
        ? "settings"
        : z
            .string()
            .max(100)
            .parse(b.id || crypto.randomUUID());
    const old = await d
      .prepare("SELECT ministry,kind FROM records WHERE id=?")
      .bind(id)
      .first<{ ministry: string; kind: string }>();
    if (
      old &&
      (old.kind !== b.kind ||
        (u.role === "ministry" && old.ministry !== u.ministry))
    )
      return reply({ error: "Operação não permitida." }, 403);
    if (b.kind === "budgets") {
      const conflict = await d
        .prepare(
          "SELECT id FROM records WHERE kind='budgets' AND ministry=? AND json_extract(data,'$.year')=? AND json_extract(data,'$.month')=? AND id<>?",
        )
        .bind(ministry, input.year, input.month, id)
        .first();
      if (conflict)
        return reply(
          {
            error:
              "Já existe orçamento para este ministério e período. Edite o existente.",
          },
          409,
        );
    }
    await d
      .prepare(
        "INSERT INTO records (id,kind,ministry,data,budget_key,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ministry=excluded.ministry,data=excluded.data,budget_key=excluded.budget_key,updated=excluded.updated",
      )
      .bind(
        id,
        b.kind,
        ministry,
        JSON.stringify(input),
        b.kind === "budgets"
          ? ministry + ":" + input.year + ":" + input.month
          : null,
        Date.now(),
      )
      .run();
    await log(u, old ? "editou " + b.kind : "cadastrou " + b.kind, id);
    return reply({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError)
      return reply(
        {
          error:
            "Revise os campos obrigatórios. Senhas devem ter pelo menos 12 caracteres.",
        },
        400,
      );
    console.error("mutation failed", e);
    return reply(
      {
        error: "Não foi possível salvar. Verifique os dados e tente novamente.",
      },
      500,
    );
  }
}
