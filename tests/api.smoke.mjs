import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://127.0.0.1:8787";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Este teste grava dados fictícios e só pode usar banco local.");
const suffix = Date.now(),
  password = "test-long-password-12345";
async function client() {
  let cookie = "";
  return {
    async post(body, expected = 200, origin = base) {
      const r = await fetch(base + "/api/system", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: cookie,
        },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      assert.equal(r.status, expected, JSON.stringify(j));
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      return j;
    },
    async get() {
      const r = await fetch(base + "/api/system", {
        headers: { Cookie: cookie },
      });
      assert.equal(r.status, 200);
      return r.json();
    },
  };
}
const admin = await client(),
  anonymous = await client();
assert.equal((await anonymous.get()).user, null);
await anonymous.post(
  { action: "save", kind: "settings", data: { deadline: 31 } },
  401,
);
await admin.post({
  action: "setup",
  name: "Admin Teste",
  email: "admin@example.test",
  password,
  token: "local-test-setup-code-only",
});
await admin.post(
  {
    action: "setup",
    name: "Admin Teste",
    email: "second@example.test",
    password,
    token: "local-test-setup-code-only",
  },
  409,
);
await admin.post({ action: "save", kind: "settings", data: { deadline: 31 } });
const save = (c, kind, data, ministry = "", id = undefined, expected = 200) =>
  c.post({ action: "save", kind, data, ministry, id }, expected);
const ministryFields = (name) => ({
  name,
  leader: "Pessoa fictícia",
  area: "Comunidade",
  description: "Registro de teste",
  email: "",
  phone: "",
});
await save(admin, "ministries", ministryFields("Teste A " + suffix));
await save(admin, "ministries", ministryFields("Teste B " + suffix));
let state = await admin.get();
const a = state.data.ministries.find((m) => m.name === "Teste A " + suffix).id,
  b = state.data.ministries.find((m) => m.name === "Teste B " + suffix).id;
const event = {
  name: "Encontro fictício",
  description: "Teste",
  objective: "Verificação",
  responsible: "Responsável teste",
  team: "Equipe teste",
  date: "2026-10-01",
  time: "19:00",
  end: "2026-10-01T21:00",
  location: "Local de teste",
  amount: 50000,
  status: "Programado",
};
await save(admin, "events", event, a);
await save(admin, "events", { ...event, name: "Outro encontro" }, b);
await save(
  admin,
  "members",
  {
    name: "Membro fictício B",
    email: "",
    phone: "",
    position: "",
    birth: "",
    notes: "",
  },
  b,
);
await save(
  admin,
  "budgets",
  { year: 2026, month: 10, area: "Comunidade", amount: 100000 },
  a,
);
await save(
  admin,
  "budgets",
  { year: 2026, month: 10, area: "Comunidade", amount: 250000 },
  b,
);
await save(
  admin,
  "budgets",
  { year: 2026, month: 10, area: "Comunidade", amount: 99999 },
  a,
  undefined,
  409,
);
await save(
  admin,
  "expenses",
  {
    name: "Despesa teste",
    date: "2026-10-01",
    amount: 25000,
    event: "",
    area: "Comunidade",
    notes: "",
  },
  a,
);
for (const role of ["ministry", "treasury", "presbytery"])
  await admin.post({
    action: "user",
    data: {
      name: "Teste " + role,
      email: role + "@example.test",
      password,
      role,
      ministry: role === "ministry" ? a : "",
    },
  });
const ministry = await client();
await ministry.post({
  action: "login",
  email: "ministry@example.test",
  password,
});
const own = await ministry.get();
assert.equal(own.data.budgets.length, 1);
assert.equal(own.data.budgets[0].ministry, a);
assert.equal(own.data.members.length, 0);
assert.equal(own.users.length, 0);
assert.equal(own.audit.length, 0);
assert(!JSON.stringify(own).includes("password"));
assert.equal(own.data.events.find((e) => e.ministry === b).amount, undefined);
await save(
  ministry,
  "expenses",
  {
    name: "Ataque",
    date: "2026-10-01",
    amount: 1,
    event: "",
    area: "",
    notes: "",
  },
  a,
  undefined,
  403,
);
await save(ministry, "events", event, b, undefined, 403);
await save(ministry, "events", { ...event, name: "Ministério autorizado" }, a);
const target = own.data.events.find((e) => e.ministry === b);
await save(ministry, "events", event, a, target.id, 403);
await admin.post({ action: "save", kind: "settings", data: { deadline: 1 } });
await save(ministry, "events", event, a, undefined, 403);
await admin.post({ action: "save", kind: "settings", data: { deadline: 31 } });
const treasury = await client();
await treasury.post({
  action: "login",
  email: "treasury@example.test",
  password,
});
await save(
  treasury,
  "expenses",
  {
    name: "Tesouraria teste",
    date: "2026-10-02",
    amount: 1000,
    event: "",
    area: "Comunidade",
    notes: "",
  },
  a,
);
await save(
  treasury,
  "ministries",
  ministryFields("Não autorizado"),
  "",
  undefined,
  403,
);
const presbytery = await client();
await presbytery.post({
  action: "login",
  email: "presbytery@example.test",
  password,
});
await save(
  presbytery,
  "events",
  { ...event, name: "Admin presbitério teste" },
  a,
);
await admin.post(
  { action: "save", kind: "settings", data: { deadline: 31 } },
  403,
  "https://invalid.example",
);
const brute = await client();
for (let i = 0; i < 5; i++)
  await brute.post(
    { action: "login", email: "nonexistent@example.test", password: "wrong" },
    401,
  );
await brute.post(
  { action: "login", email: "nonexistent@example.test", password: "wrong" },
  429,
);
state = await admin.get();
const id = state.users.find((u) => u.role === "ministry").id;
await admin.post({
  action: "password",
  id,
  password: "replacement-test-password",
});
assert.equal((await ministry.get()).user, null);
await admin.post({ action: "logout" });
assert.equal((await admin.get()).user, null);
console.log(
  "PASS: cadastro, persistência, quatro perfis, isolamento financeiro, prazo, CSRF, bloqueio de login e revogação de sessão.",
);
