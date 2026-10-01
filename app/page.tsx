"use client";
import {
  FinanceStats,
  CashFlow,
  FinancialView,
  FinancialForm,
  AccountForm,
  UserAccess,
  financialSummary,
} from "../components/finance";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Church,
  Wallet,
  Settings,
  LogOut,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  X,
  Menu,
  ClipboardList,
} from "lucide-react";
type Row = { id: string; ministry: string; [key: string]: any };
type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  ministry: string;
  active: number;
  canFinance: boolean;
  financeAccess: boolean;
  isOwner: boolean;
};
const roles: Record<string, string> = {
  admin: "Administrador",
  presbytery: "Presbitério",
  member: "Membro",
  treasury: "Tesouraria",
  ministry: "Ministério",
};
const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (v || 0) / 100,
  );
const dates = (v: string) =>
  v ? new Date(v.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const today = () => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const v = (t: string) => p.find((x) => x.type === t)?.value;
  return `${v("year")}-${v("month")}-${v("day")}`;
};
const status = (e: Row) =>
  e.status !== "Concluído" && (e.end || e.date).slice(0, 10) < today()
    ? "Atrasado"
    : e.status;
const colors: Record<string, string> = {
  Programado: "blue",
  Concluído: "green",
  "Em andamento": "amber",
  Atrasado: "red",
};
const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const nav = [
  ["dashboard", "Visão geral", LayoutDashboard],
  ["events", "Eventos", ClipboardList],
  ["calendar", "Calendário", CalendarDays],
  ["ministries", "Ministérios", Church],
  ["members", "Membros", Users],
  ["finance", "Financeiro", Wallet],
  ["settings", "Configurações", Settings],
] as const;
const fields: Record<
  string,
  {
    key: string;
    label: string;
    type?: string;
    required?: boolean;
    options?: string[];
  }[]
> = {
  ministries: [
    { key: "name", label: "Nome do ministério", required: true },
    { key: "leader", label: "Líder responsável" },
    { key: "area", label: "Área" },
    { key: "description", label: "Descrição e informações", type: "textarea" },
    { key: "email", label: "E-mail", type: "email" },
    { key: "phone", label: "Telefone" },
  ],
  members: [
    { key: "name", label: "Nome completo", required: true },
    { key: "email", label: "E-mail", type: "email" },
    { key: "phone", label: "Telefone" },
    { key: "position", label: "Função no ministério" },
    { key: "birth", label: "Data de nascimento", type: "date" },
    { key: "notes", label: "Informações adicionais", type: "textarea" },
  ],
  events: [
    { key: "name", label: "Nome do evento", required: true },
    { key: "description", label: "Descrição do evento", type: "textarea" },
    { key: "objective", label: "Objetivo", type: "textarea" },
    { key: "responsible", label: "Responsável", required: true },
    { key: "team", label: "Equipe responsável" },
    { key: "location", label: "Local" },
    { key: "date", label: "Data de início", type: "date", required: true },
    { key: "time", label: "Horário (opcional)", type: "time" },
    { key: "end", label: "Término", type: "datetime-local" },
    { key: "amount", label: "Valor previsto (R$)", type: "money" },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["Programado", "Em andamento", "Concluído", "Atrasado"],
    },
  ],
  budgets: [
    { key: "year", label: "Ano", type: "number", required: true },
    { key: "month", label: "Período", type: "period" },
    { key: "area", label: "Área" },
    { key: "amount", label: "Orçamento (R$)", type: "money", required: true },
  ],
  expenses: [
    { key: "name", label: "Descrição da despesa", required: true },
    { key: "date", label: "Data", type: "date", required: true },
    {
      key: "amount",
      label: "Valor realizado (R$)",
      type: "money",
      required: true,
    },
    { key: "event", label: "Evento relacionado", type: "event" },
    { key: "area", label: "Área" },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  user: [
    { key: "name", label: "Nome", required: true },
    { key: "email", label: "E-mail", type: "email", required: true },
    {
      key: "password",
      label: "Senha inicial (mínimo 12 caracteres)",
      type: "password",
      required: true,
    },
    { key: "role", label: "Perfil", type: "role" },
  ],
};
export default function App() {
  const [user, setUser] = useState<Account | null>(null),
    [data, setData] = useState<Record<string, Row[]>>({}),
    [accounts, setAccounts] = useState<Account[]>([]),
    [audit, setAudit] = useState<Row[]>([]),
    [setup, setSetup] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [view, setView] = useState("dashboard"),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState<{ kind: string; row?: Row } | null>(null),
    [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1),
    [year, setYear] = useState(new Date().getFullYear()),
    [filterStatus, setFilterStatus] = useState(""),
    [responsible, setResponsible] = useState(""),
    [ministry, setMinistry] = useState(""),
    [query, setQuery] = useState("");
  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/system");
      const b = (await r.json()) as {
        error?: string;
        user: Account | null;
        setup: boolean;
        data: Record<string, Row[]>;
        users: Account[];
        audit: Row[];
      };
      if (!r.ok) throw Error(b.error || "Falha ao carregar");
      setUser(b.user);
      setSetup(b.setup);
      setData(b.data || {});
      setAccounts(b.users || []);
      setAudit(b.audit || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => reload(), 300000);
    const refresh = () => reload();
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [user?.id, reload]);
  useEffect(() => {
    if (
      user &&
      ((view === "finance" && !user.canFinance) ||
        (view === "settings" && user.role !== "admin") ||
        (view === "members" && !["admin", "ministry"].includes(user.role)))
    )
      setView("dashboard");
  }, [user, view]);
  useEffect(() => {
    if (!user) return;
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: unknown,
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "navigate_church_section",
            description:
              "Abra uma seção da gestão da igreja, sem alterar registros.",
            inputSchema: {
              type: "object",
              properties: {
                section: {
                  type: "string",
                  enum: [
                    "dashboard",
                    "events",
                    "calendar",
                    "ministries",
                    "members",
                    "finance",
                    "settings",
                  ],
                },
              },
              required: ["section"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute(input: unknown) {
              const section = (input as { section?: string })?.section;
              if (
                !nav.some((n) => n[0] === section) ||
                (section === "settings" && user.role !== "admin") ||
                (section === "finance" && !user.canFinance) ||
                (section === "members" &&
                  !["admin", "ministry"].includes(user.role))
              )
                throw Error("Seção não permitida");
              if (section === "calendar" && !month)
                setMonth(new Date().getMonth() + 1);
              setView(section!);
              return { section };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [user, month]);

  async function mutate(b: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(j.error || "Falha ao salvar");
      await reload();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const ministries = data.ministries || [],
    events = data.events || [],
    expenses = data.expenses || [],
    budgets = data.budgets || [];
  const ministryName = (id: string) =>
    ministries.find((m) => m.id === id)?.name || "Ministério";
  const deadline = data.settings?.[0]?.deadline || 10;
  const closed =
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Manaus",
        day: "numeric",
      }).format(new Date()),
    ) > deadline;
  const editable = (kind: string) =>
    user?.role === "admin" ||
    (user?.role === "treasury" &&
      user.canFinance &&
      ["budgets", "expenses", "incomes"].includes(kind)) ||
    (user?.role === "ministry" &&
      !closed &&
      (kind === "events" || (kind === "requests" && user.canFinance)));
  const selectedEvents = events.filter(
    (e) =>
      (!month || Number(e.date.slice(5, 7)) === month) &&
      Number(e.date.slice(0, 4)) === year &&
      (!filterStatus || status(e) === filterStatus) &&
      (!responsible || e.responsible === responsible) &&
      (!ministry || e.ministry === ministry) &&
      (!query ||
        [e.name, e.responsible, e.team]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const spending = expenses.filter(
    (e) =>
      Number(e.date.slice(0, 4)) === year &&
      (!month || Number(e.date.slice(5, 7)) === month) &&
      (!ministry || e.ministry === ministry),
  );
  const annualSpend = expenses
    .filter(
      (e) =>
        Number(e.date.slice(0, 4)) === year &&
        (!ministry || e.ministry === ministry),
    )
    .reduce((s, e) => s + e.amount, 0);
  const annualBudget = budgets
    .filter(
      (b) =>
        b.year === year &&
        b.month === 0 &&
        (!ministry || b.ministry === ministry),
    )
    .reduce((s, b) => s + b.amount, 0);
  const periodBudget = budgets
    .filter(
      (b) =>
        b.year === year &&
        b.month === month &&
        (!ministry || b.ministry === ministry),
    )
    .reduce((s, b) => s + b.amount, 0);
  const budget = month ? periodBudget : annualBudget,
    spent = spending.reduce((s, e) => s + e.amount, 0),
    percent = budget ? (spent / budget) * 100 : 0;
  const planned = selectedEvents.filter(
      (e) => status(e) === "Programado",
    ).length,
    done = selectedEvents.filter((e) => status(e) === "Concluído").length,
    late = selectedEvents.filter((e) => status(e) === "Atrasado").length;
  function navigate(v: string) {
    if (v === "calendar" && !month) setMonth(new Date().getMonth() + 1);
    setView(v);
    setQuery("");
    setMobile(false);
  }
  const badge = (s: string) => (
    <span className={"badge " + colors[s]}>{s}</span>
  );
  const eventTable = () => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Evento / ministério</th>
            <th>Responsável</th>
            <th>Data</th>
            <th>Previsto</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {selectedEvents.map((e) => (
            <tr key={e.id}>
              <td>
                <strong>{e.name}</strong>
                <small>{ministryName(e.ministry)}</small>
              </td>
              <td>{e.responsible}</td>
              <td>
                {dates(e.date)}
                <small>{e.time || "Sem horário definido"}</small>
              </td>
              <td>{e.amount === undefined ? "Restrito" : money(e.amount)}</td>
              <td>{badge(status(e))}</td>
              <td>
                <button
                  className="text-button"
                  onClick={() => setModal({ kind: "events", row: e })}
                >
                  {editable("events") ? "Editar" : "Detalhes"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!selectedEvents.length && (
        <Empty
          text="Nenhum evento neste período"
          detail="Cadastre uma atividade ou ajuste os filtros para encontrá-la."
        />
      )}
    </div>
  );
  if (loading) return <div className="loading">Carregando Nova Cidade…</div>;
  if (!user)
    return (
      <div className="login-page">
        <div className="login-brand">
          <div className="brand-mark">
            <Church size={30} />
          </div>
          <h1>
            Servir com propósito.
            <br />
            Planejar com cuidado.
          </h1>
          <p>Igreja de Cristo em Nova Cidade</p>
          <div className="login-caption">
            GESTÃO DE MINISTÉRIOS E ATIVIDADES
          </div>
        </div>
        <div className="login-side">
          <div className="login-card">
            <span className="eyebrow">NOVA CIDADE</span>
            <h2>
              {setup ? "Configure o primeiro acesso" : "Bem-vindo de volta"}
            </h2>
            <p>
              {setup
                ? "Crie a conta administradora para começar."
                : "Acesse o planejamento e a gestão da igreja."}
            </p>
            {error && (
              <div role="alert" className="alert">
                {error}
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                await mutate({ ...f, action: setup ? "setup" : "login" });
              }}
            >
              {setup && (
                <label>
                  Nome
                  <input name="name" required />
                </label>
              )}
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  minLength={setup ? 12 : 1}
                  maxLength={128}
                  autoComplete={setup ? "new-password" : "current-password"}
                  required
                />
              </label>
              {setup && (
                <label>
                  Código de configuração
                  <input name="token" type="password" required />
                  <small>Use o código privado entregue ao administrador.</small>
                </label>
              )}
              <button disabled={busy} className="primary full">
                {busy
                  ? "Aguarde…"
                  : setup
                    ? "Criar conta administradora"
                    : "Entrar"}
              </button>
            </form>
            <div className="login-security">
              <ShieldCheck size={16} /> Acesso restrito aos usuários autorizados
            </div>
          </div>
        </div>
      </div>
    );
  return (
    <div className="app">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <div className="brand-mark">
            <Church size={23} />
          </div>
          <div>
            <strong>Nova Cidade</strong>
            <span>Igreja de Cristo</span>
          </div>
        </a>
        <div className="sidebar-label">GESTÃO DA IGREJA</div>
        <nav>
          {nav
            .filter(
              ([id]) =>
                (id !== "settings" || user.role === "admin") &&
                (id !== "finance" || user.canFinance) &&
                (id !== "members" || ["admin", "ministry"].includes(user.role)),
            )
            .map(([id, label, Icon]) => (
              <button
                key={id}
                className={view === id ? "nav-item active" : "nav-item"}
                onClick={() => navigate(id)}
              >
                <Icon size={19} />
                {label}
                {id === "events" && events.length > 0 && (
                  <span className="nav-count">{events.length}</span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="church-note">
            <Church size={20} />
            <p>
              Igreja de Cristo
              <br />
              <strong>em Nova Cidade</strong>
            </p>
          </div>
          <div className="user">
            <span className="avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{roles[user.role]}</small>
            </div>
            <button
              aria-label="Sair"
              onClick={() => mutate({ action: "logout" })}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <button
            className="mobile-menu"
            aria-label="Menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Gestão da igreja <span>/</span>{" "}
            <strong>{nav.find((n) => n[0] === view)?.[1]}</strong>
          </div>
          <div className="header-right">
            <span className="secure">
              <ShieldCheck size={15} /> Acesso seguro
            </span>
            <span className="header-avatar">{user.name.charAt(0)}</span>
          </div>
        </header>
        <main>
          {error && (
            <div role="alert" className="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Fechar aviso">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="success">
              {notice}
              <button onClick={() => setNotice("")} aria-label="Fechar aviso">
                <X size={16} />
              </button>
            </div>
          )}
          {user.role === "ministry" && (
            <div className="deadline">
              {closed
                ? "Período encerrado · acesso em consulta"
                : "Lançamentos abertos"}{" "}
              · Prazo até o dia {deadline} de cada mês
            </div>
          )}
          <div className="page-title">
            <div>
              <span className="eyebrow">
                {view === "dashboard"
                  ? "PLANEJAMENTO E CUIDADO"
                  : "IGREJA DE CRISTO EM NOVA CIDADE"}
              </span>
              <h1>
                {view === "dashboard"
                  ? "Visão geral"
                  : nav.find((n) => n[0] === view)?.[1]}
              </h1>
              <p>
                {
                  (
                    {
                      dashboard: "Tudo o que estamos construindo, juntos.",
                      events:
                        "Planeje e acompanhe as atividades dos ministérios.",
                      calendar: "A agenda da igreja, em um só lugar.",
                      ministries:
                        "Organização, pessoas e propósito de cada ministério.",
                      members: "As pessoas que fazem parte desta missão.",
                      finance:
                        "Acompanhe os recursos e cuide de cada investimento.",
                      settings:
                        "Gerencie os acessos e os prazos de planejamento.",
                    } as Record<string, string>
                  )[view]
                }
              </p>
            </div>
            {["events", "ministries", "members"].includes(view) &&
              editable(view) && (
                <button
                  className="primary"
                  onClick={() => setModal({ kind: view })}
                >
                  <Plus size={18} />
                  {view === "events"
                    ? "Novo evento"
                    : view === "ministries"
                      ? "Novo ministério"
                      : "Novo membro"}
                </button>
              )}
            {view === "dashboard" && editable("events") && (
              <button
                className="primary"
                onClick={() => setModal({ kind: "events" })}
              >
                <Plus size={18} />
                Novo evento
              </button>
            )}
          </div>
          {["dashboard", "events", "calendar", "finance"].includes(view) && (
            <div className="filters">
              <div className="period-picker">
                <CalendarDays size={17} />
                <select
                  aria-label="Mês"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {view !== "calendar" && <option value="0">Todo o ano</option>}
                  {months.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Ano"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {Array.from(
                    { length: 11 },
                    (_, i) => new Date().getFullYear() - 3 + i,
                  ).map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </div>
              <select
                aria-label="Ministério"
                disabled={
                  view === "finance" &&
                  !["admin", "treasury", "presbytery"].includes(user.role)
                }
                value={
                  view === "finance" &&
                  !["admin", "treasury", "presbytery"].includes(user.role)
                    ? user.ministry
                    : ministry
                }
                onChange={(e) => setMinistry(e.target.value)}
              >
                <option value="">Todos os ministérios</option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {view !== "finance" && (
                <>
                  <select
                    aria-label="Status"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">Todos os status</option>
                    {Object.keys(colors).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Responsável"
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                  >
                    <option value="">Todos os responsáveis</option>
                    {Array.from(new Set(events.map((e) => e.responsible))).map(
                      (s) => (
                        <option key={s}>{s}</option>
                      ),
                    )}
                  </select>
                </>
              )}
              <button
                className="text-button"
                onClick={() => {
                  setMinistry("");
                  setFilterStatus("");
                  setResponsible("");
                  setQuery("");
                }}
              >
                Limpar filtros
              </button>
            </div>
          )}
          {view === "dashboard" && (
            <>
              <div className="stats-grid">
                {[
                  ["Eventos programados", planned, "blue"],
                  ["Eventos concluídos", done, "green"],
                  ["Eventos atrasados", late, "red"],
                  [
                    "Em andamento",
                    selectedEvents.filter((e) => status(e) === "Em andamento")
                      .length,
                    "amber",
                  ],
                ].map(([label, value, color]) => (
                  <section className="stat-card" key={label}>
                    <span className={`stat-icon ${color}`}>
                      <CalendarDays size={21} />
                    </span>
                    <p>{label}</p>
                    <h2>{value}</h2>
                    <small>No período selecionado</small>
                  </section>
                ))}
              </div>
              {user.canFinance ? (
                <>
                  <FinanceStats
                    summary={financialSummary(
                      data,
                      year,
                      month,
                      ["admin", "treasury", "presbytery"].includes(user.role)
                        ? ministry
                        : user.ministry,
                    )}
                  />
                  <CashFlow
                    data={data}
                    year={year}
                    ministry={
                      ["admin", "treasury", "presbytery"].includes(user.role)
                        ? ministry
                        : user.ministry
                    }
                  />
                  <div className="finance-actions">
                    <button
                      className="text-button"
                      onClick={() => navigate("finance")}
                    >
                      Abrir financeiro <ArrowUpRight size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="scope-banner spaced">
                  <ShieldCheck size={19} />
                  <span>
                    Seu acesso inclui as atividades da igreja. Informações
                    financeiras dependem de autorização individual do
                    administrador principal.
                  </span>
                </div>
              )}
              <section className="panel spaced">
                <div className="panel-heading">
                  <div>
                    <h2>Atividades do período</h2>
                    <p>Planejamento e acompanhamento dos ministérios</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("calendar")}
                  >
                    Abrir calendário
                  </button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Atividade</th>
                        <th>Ministério</th>
                        <th>Responsável</th>
                        <th>Data</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEvents.slice(0, 10).map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => setModal({ kind: "events", row: e })}
                        >
                          <td>
                            <strong>{e.name}</strong>
                          </td>
                          <td>{ministryName(e.ministry)}</td>
                          <td>{e.responsible}</td>
                          <td>{dates(e.date)}</td>
                          <td>
                            <span className={`badge ${colors[status(e)]}`}>
                              {status(e)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!selectedEvents.length && (
                    <div className="empty">
                      Nenhuma atividade neste período.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
          {view === "events" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  Atividades{" "}
                  <span className="count">{selectedEvents.length}</span>
                </h2>
                <div className="search">
                  <Search size={17} />
                  <input
                    placeholder="Buscar evento ou equipe"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
              {eventTable()}
            </section>
          )}
          {view === "calendar" && (
            <section className="panel calendar">
              <div className="panel-heading">
                <h2>
                  {months[month - 1]} <span className="muted">{year}</span>
                </h2>
                <div className="calendar-actions">
                  <button
                    aria-label="Mês anterior"
                    onClick={() => {
                      if (month === 1) {
                        setMonth(12);
                        setYear(year - 1);
                      } else setMonth(month - 1);
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setMonth(new Date().getMonth() + 1);
                      setYear(new Date().getFullYear());
                    }}
                  >
                    Hoje
                  </button>
                  <button
                    aria-label="Próximo mês"
                    onClick={() => {
                      if (month === 12) {
                        setMonth(1);
                        setYear(year + 1);
                      } else setMonth(month + 1);
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
              <div className="calendar-grid">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((s) => (
                  <div className="weekday" key={s}>
                    {s}
                  </div>
                ))}
                {Array.from(
                  { length: new Date(year, month - 1, 1).getDay() },
                  (_, i) => (
                    <div key={"blank" + i} className="day blank" />
                  ),
                )}
                {Array.from(
                  { length: new Date(year, month, 0).getDate() },
                  (_, i) => {
                    const date = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                    return (
                      <div
                        key={date}
                        className={"day " + (date === today() ? "today" : "")}
                      >
                        <span className="day-number">{i + 1}</span>
                        {selectedEvents
                          .filter((e) => e.date === date)
                          .map((e) => (
                            <button
                              key={e.id}
                              className={"calendar-event " + colors[status(e)]}
                              onClick={() =>
                                setModal({ kind: "events", row: e })
                              }
                            >
                              <strong>
                                {e.time && e.time + " · "}
                                {e.name}
                              </strong>
                              <span>{e.responsible}</span>
                            </button>
                          ))}
                      </div>
                    );
                  },
                )}
              </div>
              <div className="calendar-legend">
                {Object.keys(colors).map((s) => (
                  <span key={s}>{badge(s)}</span>
                ))}
              </div>
            </section>
          )}
          {["ministries", "members"].includes(view) && (
            <>
              <div className="list-toolbar">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar"
                    placeholder={
                      view === "ministries"
                        ? "Buscar ministério"
                        : "Buscar membro"
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                {view === "members" && (
                  <select
                    aria-label="Ministério"
                    value={ministry}
                    onChange={(e) => setMinistry(e.target.value)}
                  >
                    <option value="">Todos os ministérios</option>
                    {ministries.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {view === "ministries" ? (
                <div className="ministry-grid">
                  {ministries
                    .filter((m) =>
                      m.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((m, i) => (
                      <section key={m.id} className="panel ministry-card">
                        <div className={"ministry-icon tone" + (i % 4)}>
                          <Church size={23} />
                        </div>
                        <h2>{m.name}</h2>
                        <p>{m.description || "Informações do ministério"}</p>
                        <div className="ministry-meta">
                          <span>Responsável</span>
                          <strong>{m.leader || "A definir"}</strong>
                        </div>
                        <div className="ministry-meta">
                          <span>Área</span>
                          <strong>{m.area || "A definir"}</strong>
                        </div>
                        <div className="ministry-card-footer">
                          <span>
                            {
                              (data.members || []).filter(
                                (v) => v.ministry === m.id,
                              ).length
                            }{" "}
                            membros
                          </span>
                          <button
                            className="text-button"
                            onClick={() =>
                              setModal({ kind: "ministries", row: m })
                            }
                          >
                            {editable("ministries") ? "Editar" : "Detalhes"}
                          </button>
                        </div>
                      </section>
                    ))}
                </div>
              ) : (
                <section className="panel table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Membro</th>
                        <th>Ministério</th>
                        <th>Função</th>
                        <th>Contato</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.members || [])
                        .filter(
                          (m) =>
                            (!ministry || m.ministry === ministry) &&
                            m.name.toLowerCase().includes(query.toLowerCase()),
                        )
                        .map((m) => (
                          <tr key={m.id}>
                            <td>
                              <strong>{m.name}</strong>
                            </td>
                            <td>{ministryName(m.ministry)}</td>
                            <td>{m.position || "—"}</td>
                            <td>{m.email || m.phone || "—"}</td>
                            <td>
                              <button
                                className="text-button"
                                onClick={() =>
                                  setModal({ kind: "members", row: m })
                                }
                              >
                                {editable("members") ? "Editar" : "Detalhes"}
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </section>
              )}
              {!(data[view] || []).length && (
                <section className="panel">
                  <Empty
                    text={
                      view === "ministries"
                        ? "Nenhum ministério cadastrado"
                        : "Nenhum membro cadastrado"
                    }
                    detail="Use o botão de cadastro para começar."
                  />
                </section>
              )}
            </>
          )}
          {view === "finance" && user.canFinance && (
            <FinancialView
              data={data}
              user={user}
              year={year}
              month={month}
              ministry={
                ["admin", "treasury", "presbytery"].includes(user.role)
                  ? ministry
                  : user.ministry
              }
              onOpen={(kind, row) => setModal({ kind, row })}
              onMutate={mutate}
              busy={busy}
            />
          )}
          {view === "settings" && user.role === "admin" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Prazo de lançamento</h2>
                    <p>
                      Após o prazo, o perfil Ministério terá acesso somente para
                      consulta.
                    </p>
                  </div>
                </div>
                <form
                  className="settings-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await mutate({
                        action: "save",
                        kind: "settings",
                        data: {
                          deadline: Number(
                            new FormData(e.currentTarget).get("deadline"),
                          ),
                        },
                      })
                    )
                      setNotice("Prazo atualizado.");
                  }}
                >
                  <label>
                    Permitir lançamentos até o dia
                    <input
                      name="deadline"
                      type="number"
                      min="1"
                      max="31"
                      defaultValue={deadline}
                      required
                    />
                  </label>
                  <button disabled={busy} className="primary">
                    Salvar prazo
                  </button>
                </form>
              </section>
              {user.isOwner && (
                <UserAccess
                  accounts={accounts}
                  data={data}
                  busy={busy}
                  onOpen={(kind, row) => setModal({ kind, row })}
                  onMutate={mutate}
                />
              )}
              <section className="panel spaced">
                <div className="panel-heading">
                  <h2>Registro de alterações</h2>
                  <p>Últimas 50 operações</p>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Usuário</th>
                        <th>Ação</th>
                        <th>Data e hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.map((a) => (
                        <tr key={a.id}>
                          <td>{a.name}</td>
                          <td>{a.action}</td>
                          <td>
                            {new Date(a.time).toLocaleString("pt-BR", {
                              timeZone: "America/Manaus",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          <footer>
            IGREJA DE CRISTO EM NOVA CIDADE{" "}
            <span>Planejamento com propósito.</span>
          </footer>
        </main>
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="modal"
          >
            <div className="panel-heading">
              <h2 id="modal-title">
                {modal.kind === "password"
                  ? "Redefinir senha"
                  : modal.kind === "disableUser"
                    ? "Desativar usuário"
                    : (modal.row ? "Detalhes de " : "Cadastrar ") +
                      (
                        {
                          ministries: "ministério",
                          members: "membro",
                          events: "evento",
                          budgets: "orçamento",
                          expenses: "despesa",
                          incomes: "entrada",
                          requests: "pedido de recursos",
                          updateUser: "usuário",
                          user: "usuário",
                        } as Record<string, string>
                      )[modal.kind]}
              </h2>
              <button aria-label="Fechar" onClick={() => setModal(null)}>
                <X size={21} />
              </button>
            </div>
            {error && (
              <div role="alert" className="alert">
                {error}
              </div>
            )}
            {["user", "updateUser"].includes(modal.kind) ? (
              <AccountForm
                row={modal.row}
                data={data}
                busy={busy}
                onClose={() => setModal(null)}
                onSave={async (values) => {
                  if (
                    await mutate({
                      action: modal.kind,
                      id: modal.row?.id,
                      data: values,
                    })
                  )
                    setModal(null);
                }}
              />
            ) : ["budgets", "expenses", "incomes", "requests"].includes(
                modal.kind,
              ) ? (
              <FinancialForm
                kind={modal.kind}
                row={modal.row}
                data={data}
                user={user}
                year={year}
                month={month}
                busy={busy}
                onClose={() => setModal(null)}
                onSave={async (values) => {
                  if (
                    await mutate({
                      action: "save",
                      kind: modal.kind,
                      id: modal.row?.id,
                      ...values,
                    })
                  )
                    setModal(null);
                }}
              />
            ) : modal.kind === "disableUser" ? (
              <div className="form-body">
                <p>
                  Desativar o acesso de {modal.row?.name}? As sessões abertas
                  serão encerradas.
                </p>
                <div className="form-actions">
                  <button className="secondary" onClick={() => setModal(null)}>
                    Cancelar
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await mutate({
                          action: "disableUser",
                          id: modal.row?.id,
                        })
                      ) {
                        setModal(null);
                        setNotice("Usuário desativado.");
                      }
                    }}
                  >
                    Desativar
                  </button>
                </div>
              </div>
            ) : (
              <form
                key={modal.kind + (modal.row?.id || "new")}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  const payload: Record<string, any> = { ...f };
                  delete payload.ministry;
                  for (const field of fields[modal.kind] || [])
                    if (
                      ["money", "number", "period"].includes(field.type || "")
                    )
                      payload[field.key] =
                        field.type === "money"
                          ? Math.round(Number(payload[field.key] || 0) * 100)
                          : Number(payload[field.key]);
                  const ok = await mutate(
                    modal.kind === "password"
                      ? {
                          action: "password",
                          id: modal.row?.id,
                          password: f.password,
                        }
                      : modal.kind === "user"
                        ? {
                            action: "user",
                            data: { ...payload, ministry: f.ministry || "" },
                          }
                        : {
                            action: "save",
                            kind: modal.kind,
                            id: modal.row?.id,
                            ministry: f.ministry || "",
                            data: payload,
                          },
                  );
                  if (ok) {
                    setModal(null);
                    setNotice("Informações salvas com sucesso.");
                  }
                }}
              >
                <div className="form-body">
                  <fieldset
                    disabled={
                      busy ||
                      !(
                        modal.kind === "user" ||
                        modal.kind === "password" ||
                        (editable(modal.kind) &&
                          (user.role !== "ministry" ||
                            !modal.row ||
                            modal.row.ministry === user.ministry))
                      )
                    }
                    className="form-grid"
                  >
                    {[
                      "members",
                      "events",
                      "budgets",
                      "expenses",
                      "user",
                    ].includes(modal.kind) && (
                      <label className="wide">
                        Ministério
                        <select
                          name="ministry"
                          defaultValue={
                            modal.row?.ministry || user.ministry || ""
                          }
                          required={modal.kind !== "user"}
                        >
                          {user.role !== "ministry" && (
                            <option value="">Selecione um ministério</option>
                          )}
                          {ministries
                            .filter(
                              (m) =>
                                user.role !== "ministry" ||
                                m.id === user.ministry,
                            )
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    {(modal.kind === "password"
                      ? [
                          {
                            key: "password",
                            label: "Nova senha (mínimo 12 caracteres)",
                            type: "password",
                            required: true,
                          },
                        ]
                      : (fields[modal.kind] || []).filter(
                          (f) => f.key !== "amount" || user.canFinance,
                        )
                    )
                      .filter(
                        (field) =>
                          field.key !== "amount" ||
                          !modal.row ||
                          modal.row.amount !== undefined,
                      )
                      .map((field) => (
                        <label
                          key={field.key}
                          className={field.type === "textarea" ? "wide" : ""}
                        >
                          {field.label}
                          {field.type === "textarea" ? (
                            <textarea
                              name={field.key}
                              rows={3}
                              maxLength={4000}
                              defaultValue={modal.row?.[field.key] || ""}
                            />
                          ) : ["select", "period", "event", "role"].includes(
                              field.type || "",
                            ) ? (
                            <select
                              name={field.key}
                              defaultValue={
                                modal.row?.[field.key] ??
                                (field.type === "select"
                                  ? "Programado"
                                  : field.type === "role"
                                    ? "ministry"
                                    : field.type === "period"
                                      ? month
                                      : "")
                              }
                            >
                              <>
                                {field.type === "select" &&
                                  field.options?.map((s) => (
                                    <option key={s}>{s}</option>
                                  ))}
                                {field.type === "period" && (
                                  <>
                                    <option value="0">Orçamento anual</option>
                                    {months.map((m, i) => (
                                      <option key={m} value={i + 1}>
                                        {m}
                                      </option>
                                    ))}
                                  </>
                                )}
                                {field.type === "event" && (
                                  <>
                                    <option value="">
                                      Sem evento vinculado
                                    </option>
                                    {events.map((e) => (
                                      <option key={e.id} value={e.id}>
                                        {e.name} · {ministryName(e.ministry)}
                                      </option>
                                    ))}
                                  </>
                                )}
                                {field.type === "role" &&
                                  Object.entries(roles).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                              </>
                            </select>
                          ) : (
                            <input
                              name={field.key}
                              type={
                                field.type === "money"
                                  ? "number"
                                  : field.type || "text"
                              }
                              step={field.type === "money" ? "0.01" : undefined}
                              min={
                                field.type === "money"
                                  ? 0
                                  : field.key === "year"
                                    ? 2020
                                    : undefined
                              }
                              minLength={
                                field.type === "password" ? 12 : undefined
                              }
                              maxLength={
                                field.type === "password"
                                  ? 128
                                  : field.type === "text" || !field.type
                                    ? 160
                                    : undefined
                              }
                              required={field.required}
                              defaultValue={
                                modal.row?.[field.key] !== undefined
                                  ? field.type === "money"
                                    ? modal.row[field.key] / 100
                                    : modal.row[field.key]
                                  : field.key === "year"
                                    ? year
                                    : field.type === "money"
                                      ? 0
                                      : field.key === "date"
                                        ? today()
                                        : ""
                              }
                            />
                          )}
                        </label>
                      ))}
                  </fieldset>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setModal(null)}
                    >
                      Fechar
                    </button>
                    {(modal.kind === "user" ||
                      modal.kind === "password" ||
                      (editable(modal.kind) &&
                        (user.role !== "ministry" ||
                          !modal.row ||
                          modal.row.ministry === user.ministry))) && (
                      <button disabled={busy} className="primary">
                        {busy ? "Salvando…" : "Salvar"}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
  tone,
  detail,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: string;
  detail: string;
}) {
  return (
    <section className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <div className={"stat-icon " + tone}>{icon}</div>
      </div>
      <strong className="stat-value">{value}</strong>
      <small>{detail}</small>
    </section>
  );
}
function Empty({ text, detail }: { text: string; detail: string }) {
  return (
    <div className="empty">
      <CalendarDays size={28} />
      <strong>{text}</strong>
      <p>{detail}</p>
    </div>
  );
}
