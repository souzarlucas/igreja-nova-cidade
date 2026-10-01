"use client";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Plus,
  FileCheck,
  ShieldCheck,
  LockKeyhole,
  X,
  Trash2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
type Row = { id: string; ministry: string; [key: string]: any };
type User = {
  id: string;
  name: string;
  role: string;
  ministry: string;
  canFinance: boolean;
  isOwner: boolean;
  financeAccess: boolean;
};
export const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (value || 0) / 100,
  );
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
const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
const sum = (rows: Row[]) => rows.reduce((total, row) => total + row.amount, 0);
export function financialSummary(
  data: Record<string, Row[]>,
  year: number,
  month: number,
  ministry: string,
) {
  const selected = (row: Row) => !ministry || row.ministry === ministry;
  const period = (row: Row) =>
    selected(row) &&
    Number(row.date.slice(0, 4)) === year &&
    (!month || Number(row.date.slice(5, 7)) === month);
  const incomes = (data.incomes || []).filter(period),
    expenses = (data.expenses || []).filter(period),
    requests = (data.requests || []).filter(period);
  const budgets = (data.budgets || []).filter(
    (b) => selected(b) && b.year === year && b.month === month,
  );
  const income = sum(incomes),
    spent = sum(expenses);
  const remaining = (r: Row) =>
    Math.max(
      0,
      r.amount - sum((data.expenses || []).filter((e) => e.requestId === r.id)),
    );
  const yearBudgets = (data.budgets || []).filter(
    (b) => selected(b) && b.year === year,
  );
  const keys = Array.from(
    new Set(yearBudgets.map((b) => `${b.ministry}|${b.area.toLowerCase()}`)),
  );
  let budget = 0,
    committedSpent = 0,
    reserved = 0,
    availableBudget = 0;
  for (const key of keys) {
    const limits = yearBudgets.filter(
      (b) =>
        `${b.ministry}|${b.area.toLowerCase()}` === key &&
        (b.month === 0 || (month && b.month === month)),
    );
    const preferred =
      limits.find((b) => month && b.month === month) ||
      limits.find((b) => b.month === 0);
    if (!preferred) continue;
    const totals = limits.map((b) => {
      const matches = (r: Row) =>
        r.ministry === b.ministry &&
        r.area.toLowerCase() === b.area.toLowerCase() &&
        Number(r.date.slice(0, 4)) === year &&
        (!b.month || Number(r.date.slice(5, 7)) === b.month);
      const used = sum((data.expenses || []).filter(matches));
      const reservedAmount = (data.requests || [])
        .filter((r) => matches(r) && r.status === "Aprovado")
        .reduce((total, r) => total + remaining(r), 0);
      return {
        row: b,
        used,
        reservedAmount,
        available: b.amount - used - reservedAmount,
      };
    });
    const current = totals.find((t) => t.row.id === preferred.id)!;
    budget += preferred.amount;
    committedSpent += current.used;
    reserved += current.reservedAmount;
    availableBudget += Math.min(...totals.map((t) => t.available));
  }
  return {
    incomes,
    expenses,
    requests,
    budgets,
    income,
    spent,
    budget,
    committedSpent,
    reserved,
    net: income - spent,
    availableBudget,
    cash:
      sum((data.incomes || []).filter(selected)) -
      sum((data.expenses || []).filter(selected)),
    remaining,
  };
}
export function FinanceStats({
  summary: s,
}: {
  summary: ReturnType<typeof financialSummary>;
}) {
  return (
    <div className="stats finance-stats">
      <Metric
        label="Entradas no período"
        value={money(s.income)}
        icon={<ArrowDownLeft />}
        tone="green"
      />
      <Metric
        label="Saídas no período"
        value={money(s.spent)}
        icon={<ArrowUpRight />}
        tone="red"
      />
      <Metric
        label="Resultado do período"
        value={money(s.net)}
        icon={<Wallet />}
        tone={s.net < 0 ? "red" : "green"}
        detail={
          s.net > 0
            ? "Entrou mais do que saiu"
            : s.net < 0
              ? "Saiu mais do que entrou"
              : "Entradas e saídas equilibradas"
        }
      />
      <Metric
        label="Saldo acumulado"
        value={money(s.cash)}
        icon={<Wallet />}
        tone="purple"
        detail="Todas as entradas menos todas as saídas"
      />
    </div>
  );
}
function Metric({
  label,
  value,
  icon,
  tone,
  detail,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
  detail?: string;
}) {
  return (
    <section className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <div className={"stat-icon " + tone}>{icon}</div>
      </div>
      <strong className="stat-value">{value}</strong>
      {detail && <small>{detail}</small>}
    </section>
  );
}
export function CashFlow({
  data,
  year,
  ministry,
}: {
  data: Record<string, Row[]>;
  year: number;
  ministry: string;
}) {
  const points = months.map((name, i) => ({
    month: name.slice(0, 3),
    Entradas:
      sum(
        (data.incomes || []).filter(
          (r) =>
            r.date.startsWith(`${year}-${String(i + 1).padStart(2, "0")}`) &&
            (!ministry || r.ministry === ministry),
        ),
      ) / 100,
    Saídas:
      sum(
        (data.expenses || []).filter(
          (r) =>
            r.date.startsWith(`${year}-${String(i + 1).padStart(2, "0")}`) &&
            (!ministry || r.ministry === ministry),
        ),
      ) / 100,
  }));
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Entradas e saídas</h2>
          <p>A movimentação financeira em {year}</p>
        </div>
      </div>
      <div className="flow-chart">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={points}
            margin={{ left: 4, right: 16, top: 10, bottom: 0 }}
          >
            <CartesianGrid stroke="#edf0f4" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${v / 1000} mil` : String(v))}
            />
            <Tooltip
              formatter={(v) => money(Number(v) * 100)}
              cursor={{ fill: "#f7f8fb" }}
            />
            <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
            <Bar dataKey="Entradas" fill="#41a486" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Saídas" fill="#b98088" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
export function FinancialView({
  data,
  user,
  year,
  month,
  ministry,
  onOpen,
  onMutate,
  busy,
}: {
  data: Record<string, Row[]>;
  user: User;
  year: number;
  month: number;
  ministry: string;
  onOpen: (kind: string, row?: Row) => void;
  onMutate: (body: any) => Promise<boolean>;
  busy: boolean;
}) {
  const [tab, setTab] = useState("overview"),
    [review, setReview] = useState<{ row: Row; decision: string } | null>(null);
  const s = financialSummary(data, year, month, ministry);
  const name = (id: string) =>
    (data.ministries || []).find((m) => m.id === id)?.name ||
    (!id ? "Gestão geral da igreja" : "Ministério");
  const expired = user.role === "ministry" && Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Manaus", day: "numeric" }).format(new Date())) > (data.settings?.[0]?.deadline || 10);
  const manageBudgets = ["admin", "treasury"].includes(user.role);
  const write = manageBudgets || (user.role === "ministry" && !expired),
    approve = ["admin", "treasury", "presbytery"].includes(user.role),
    requester = ["admin", "ministry"].includes(user.role) && !expired;
  const categories: Record<string, number> = {};
  for (const row of s.expenses)
    for (const item of row.items || [
      { category: row.area || "Geral", amount: row.amount },
    ])
      categories[item.category] =
        (categories[item.category] || 0) + item.amount;
  const byCategory = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const pending = s.requests.filter((r) => r.status === "Pendente");
  return (
    <>
      <div className="scope-banner">
        <ShieldCheck size={18} />
        <span>
          {["admin", "treasury", "presbytery"].includes(user.role)
            ? "Financeiro da igreja · acesso autorizado"
            : "Financeiro do seu ministério · acesso autorizado"}
        </span>
        <small>Acesso controlado pelo administrador principal</small>
      </div>
      <FinanceStats summary={s} />
      <div className="finance-tabs" role="tablist">
        {[
          ["overview", "Visão financeira"],
          ["transactions", "Entradas e saídas"],
          ["budgets", "Orçamentos"],
          ["requests", "Pedidos de recursos"],
        ].map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "selected" : ""}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
            {key === "requests" && pending.length > 0 && (
              <span className="count">{pending.length}</span>
            )}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="overview-grid">
            <CashFlow data={data} year={year} ministry={ministry} />
            <section className="panel">
              <div className="panel-heading">
                <h2>Compromissos do orçamento</h2>
              </div>
              <div className="budget-kpis">
                <div>
                  <span>Orçamento autorizado</span>
                  <strong>{money(s.budget)}</strong>
                </div>
                <div>
                  <span>Despesas no orçamento vigente</span>
                  <strong>{money(s.committedSpent)}</strong>
                </div>
                <div>
                  <span>Aprovado, ainda não gasto</span>
                  <strong>{money(s.reserved)}</strong>
                </div>
                <div className={s.availableBudget < 0 ? "negative" : ""}>
                  <span>Disponível para novos pedidos</span>
                  <strong>{money(s.availableBudget)}</strong>
                </div>
              </div>
              <p className="finance-note">
                Pedidos aprovados reservam orçamento. Sem limite mensal, usa-se
                o anual. Quando ambos existem, o disponível respeita os dois
                limites. Apenas despesas realizadas reduzem o caixa.
              </p>
            </section>
          </div>
          <div className="overview-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Onde os recursos estão sendo usados</h2>
              </div>
              {byCategory.length ? (
                byCategory.map(([category, amount]) => (
                  <div className="ministry-budget" key={category}>
                    <div>
                      <strong>{category}</strong>
                      <span>
                        {money(amount)} ·{" "}
                        {s.spent ? ((amount / s.spent) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="progress">
                      <i
                        style={{
                          width: (s.spent ? (amount / s.spent) * 100 : 0) + "%",
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <Empty text="Sem despesas no período" />
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Sinais para a gestão</h2>
              </div>
              <div className="insights">
                {s.net < 0 ? (
                  <div className="insight red">
                    <strong>Saídas acima das entradas</strong>
                    <p>
                      Diferença de {money(-s.net)}. Revise despesas recorrentes
                      e compromissos antes de aprovar novos pedidos.
                    </p>
                  </div>
                ) : (
                  <div className="insight green">
                    <strong>
                      {s.net > 0 ? "Resultado positivo" : "Período equilibrado"}
                    </strong>
                    <p>
                      {s.net > 0
                        ? `Há ${money(s.net)} de resultado positivo no período. Confira os compromissos antes de realocar recursos.`
                        : "Registre as movimentações para acompanhar a evolução."}
                    </p>
                  </div>
                )}
                {s.availableBudget < 0 && (
                  <div className="insight amber">
                    <strong>Orçamento comprometido acima do limite</strong>
                    <p>
                      Revisão necessária de {money(-s.availableBudget)} entre
                      gastos e reservas aprovadas.
                    </p>
                  </div>
                )}
                {byCategory[0] && (
                  <div className="insight">
                    <strong>Maior concentração: {byCategory[0][0]}</strong>
                    <p>
                      {money(byCategory[0][1])} em despesas. Abra os lançamentos
                      para revisar os itens e suas justificativas.
                    </p>
                  </div>
                )}
                {pending.length > 0 && (
                  <div className="insight">
                    <strong>
                      {pending.length} pedido(s) aguardando análise
                    </strong>
                    <p>
                      Avalie objetivos, prioridades e disponibilidade por área
                      antes de decidir.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
          <MinistryBreakdown
            data={data}
            year={year}
            month={month}
            ministry={
              ["admin", "treasury", "presbytery"].includes(user.role)
                ? ministry
                : user.ministry
            }
          />
        </>
      )}
      {tab === "transactions" && (
        <>
          <div className="finance-actions">
            {write && (
              <>
                <button className="secondary" onClick={() => onOpen("incomes")}>
                  <Plus size={17} />
                  Registrar entrada
                </button>
                <button className="primary" onClick={() => onOpen("expenses")}>
                  <Plus size={17} />
                  Registrar saída
                </button>
              </>
            )}
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>Movimentações do período</h2>
              <p>
                Cada saída contém uma justificativa e seus itens detalhados.
              </p>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Ministério / área</th>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...s.incomes.map((r) => ({ ...r, kind: "incomes" }) as Row),
                    ...s.expenses.map(
                      (r) => ({ ...r, kind: "expenses" }) as Row,
                    ),
                  ]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.name}</strong>
                          <small>
                            {r.kind === "expenses"
                              ? r.justification
                              : r.category}
                          </small>
                        </td>
                        <td>
                          {name(r.ministry)}
                          <small>{r.area || r.category}</small>
                        </td>
                        <td>{fmtDate(r.date)}</td>
                        <td>
                          <span
                            className={
                              "badge " +
                              (r.kind === "incomes" ? "green" : "red")
                            }
                          >
                            {r.kind === "incomes" ? "Entrada" : "Saída"}
                          </span>
                        </td>
                        <td>{money(r.amount)}</td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => onOpen(r.kind, r)}
                          >
                            {write ? "Detalhar / editar" : "Detalhar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!s.incomes.length && !s.expenses.length && (
                <Empty text="Nenhuma movimentação registrada" />
              )}
            </div>
          </section>
        </>
      )}
      {tab === "budgets" && (
        <>
          <div className="finance-actions">
            {manageBudgets && (
              <button className="primary" onClick={() => onOpen("budgets")}>
                <Plus size={17} />
                Definir orçamento por área
              </button>
            )}
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>Orçamento por ministério e área</h2>
              <p>Os limites mensais e anuais são separados e não se somam.</p>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Ministério</th>
                    <th>Área</th>
                    <th>Período</th>
                    <th>Autorizado</th>
                    <th>Gasto</th>
                    <th>Utilizado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(data.budgets || [])
                    .filter(
                      (b) =>
                        b.year === year &&
                        (!ministry || b.ministry === ministry),
                    )
                    .map((b) => {
                      const used = sum(
                        (data.expenses || []).filter(
                          (e) =>
                            e.ministry === b.ministry &&
                            e.area.toLowerCase() === b.area.toLowerCase() &&
                            Number(e.date.slice(0, 4)) === b.year &&
                            (!b.month ||
                              Number(e.date.slice(5, 7)) === b.month),
                        ),
                      );
                      return (
                        <tr key={b.id}>
                          <td>{name(b.ministry)}</td>
                          <td>{b.area}</td>
                          <td>
                            {b.month ? months[b.month - 1] : "Anual"} / {b.year}
                          </td>
                          <td>{money(b.amount)}</td>
                          <td>{money(used)}</td>
                          <td className={used > b.amount ? "negative" : ""}>
                            {b.amount
                              ? ((used / b.amount) * 100).toFixed(1) + "%"
                              : "Sem limite"}
                          </td>
                          <td>
                            {manageBudgets && (
                              <button
                                className="text-button"
                                onClick={() => onOpen("budgets", b)}
                              >
                                Editar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {!(data.budgets || []).length && (
                <Empty text="Orçamentos ainda não definidos" />
              )}
            </div>
          </section>
        </>
      )}
      {tab === "requests" && (
        <>
          <div className="finance-actions">
            {requester && (
              <button className="primary" onClick={() => onOpen("requests")}>
                <Plus size={17} />
                Solicitar recursos
              </button>
            )}
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>Pedidos de recursos</h2>
              <p>
                Justificativa, objetivo e itens são obrigatórios. O autor não
                aprova seu próprio pedido.
              </p>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Pedido / ministério</th>
                    <th>Prioridade</th>
                    <th>Previsto para</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {s.requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                        <small>
                          {name(r.ministry)} · {r.createdByName}
                        </small>
                      </td>
                      <td>{r.priority}</td>
                      <td>{fmtDate(r.date)}</td>
                      <td>{money(r.amount)}</td>
                      <td>
                        <span
                          className={
                            "badge " +
                            (
                              {
                                Pendente: "amber",
                                Aprovado: "green",
                                Rejeitado: "red",
                              } as Record<string, string>
                            )[r.status]
                          }
                        >
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="text-button"
                            onClick={() => onOpen("requests", r)}
                          >
                            Detalhes
                          </button>
                          {approve &&
                            r.status === "Pendente" &&
                            r.createdBy !== user.id && (
                              <>
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    setReview({ row: r, decision: "Aprovado" })
                                  }
                                >
                                  Aprovar
                                </button>
                                <button
                                  className="text-button negative"
                                  onClick={() =>
                                    setReview({ row: r, decision: "Rejeitado" })
                                  }
                                >
                                  Rejeitar
                                </button>
                              </>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!s.requests.length && (
                <Empty text="Nenhum pedido neste período" />
              )}
            </div>
          </section>
        </>
      )}
      {review && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true">
            <div className="panel-heading">
              <h2>
                {review.decision === "Aprovado" ? "Aprovar" : "Rejeitar"} pedido
              </h2>
              <button aria-label="Fechar" onClick={() => setReview(null)}>
                <X />
              </button>
            </div>
            <form
              className="form-body"
              onSubmit={async (e) => {
                e.preventDefault();
                const comment = String(
                  new FormData(e.currentTarget).get("comment"),
                );
                if (
                  await onMutate({
                    action: "decideRequest",
                    id: review.row.id,
                    decision: review.decision,
                    comment,
                  })
                )
                  setReview(null);
              }}
            >
              <h3>
                {review.row.name} · {money(review.row.amount)}
              </h3>
              <p className="finance-note">{review.row.justification}</p>
              <ul className="item-review">
                {review.row.items.map((i: any, index: number) => (
                  <li key={index}>
                    <span>
                      {i.description} · {i.category}
                    </span>
                    <strong>{money(i.amount)}</strong>
                  </li>
                ))}
              </ul>
              <label>
                {review.decision === "Rejeitado"
                  ? "Motivo da rejeição"
                  : "Observação da aprovação"}
                <textarea
                  name="comment"
                  rows={3}
                  required={review.decision === "Rejeitado"}
                  minLength={review.decision === "Rejeitado" ? 10 : undefined}
                  maxLength={4000}
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setReview(null)}
                >
                  Cancelar
                </button>
                <button disabled={busy} className="primary">
                  Confirmar decisão
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
function MinistryBreakdown({
  data,
  year,
  month,
  ministry,
}: {
  data: Record<string, Row[]>;
  year: number;
  month: number;
  ministry: string;
}) {
  const ids = Array.from(
    new Set([
      ...(data.ministries || []).map((m) => m.id),
      ...(data.incomes || []).map((r) => r.ministry),
      ...(data.expenses || []).map((r) => r.ministry),
    ]),
  ).filter((id) => !ministry || id === ministry);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Distribuição por ministério</h2>
        <p>
          Entradas, gastos e compromissos separados para cada área de atuação.
        </p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Ministério</th>
              <th>Entradas</th>
              <th>Saídas</th>
              <th>Resultado</th>
              <th>Orçamento</th>
              <th>Reservado</th>
              <th>Disponível</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const scoped = Object.fromEntries(
                Object.entries(data).map(([k, rows]) => [
                  k,
                  rows.filter((r) => r.ministry === id),
                ]),
              );
              const s = financialSummary(scoped, year, month, "");
              return (
                <tr key={id}>
                  <td>
                    {(data.ministries || []).find((m) => m.id === id)?.name ||
                      "Gestão geral da igreja"}
                  </td>
                  <td>{money(s.income)}</td>
                  <td>{money(s.spent)}</td>
                  <td className={s.net < 0 ? "negative" : ""}>
                    {money(s.net)}
                  </td>
                  <td>{money(s.budget)}</td>
                  <td>{money(s.reserved)}</td>
                  <td>{money(s.availableBudget)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export function FinancialForm({
  kind,
  row,
  data,
  user,
  year,
  month,
  busy,
  onSave,
  onClose,
}: {
  kind: string;
  row?: Row;
  data: Record<string, Row[]>;
  user: User;
  year: number;
  month: number;
  busy: boolean;
  onSave: (payload: { ministry: string; data: any }) => Promise<void>;
  onClose: () => void;
}) {
  const [ministry, setMinistry] = useState(
      row?.ministry || user.ministry || "",
    ),
    [items, setItems] = useState<
      { description: string; category: string; amount: string }[]
    >(
      (row?.items || [{ description: "", category: "", amount: 0 }]).map(
        (i: any) => ({ ...i, amount: String(i.amount / 100) }),
      ),
    );
  const expired =
    user.role === "ministry" &&
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Manaus",
        day: "numeric",
      }).format(new Date()),
    ) > (data.settings?.[0]?.deadline || 10);
  const write =
    kind === "requests"
      ? !row && !expired && ["admin", "ministry"].includes(user.role)
      : ["admin", "treasury"].includes(user.role) ||
        (user.role === "ministry" && !expired && ["expenses", "incomes"].includes(kind));
  const itemized = ["expenses", "requests"].includes(kind),
    total = items.reduce(
      (s, i) => s + Math.round(Number(i.amount || 0) * 100),
      0,
    );
  const changeItem = (i: number, key: string, value: string) =>
    setItems(
      items.map((r, index) => (index === i ? { ...r, [key]: value } : r)),
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        const payload: any = { ...f };
        delete payload.ministry;
        if (kind === "budgets") {
          payload.year = Number(payload.year);
          payload.month = Number(payload.month);
        }
        if (itemized) {
          payload.amount = total;
          payload.items = items.map((i) => ({
            ...i,
            amount: Math.round(Number(i.amount) * 100),
          }));
        } else payload.amount = Math.round(Number(payload.amount) * 100);
        await onSave({ ministry, data: payload });
      }}
    >
      <div className="form-body">
        {expired && (
          <div className="scope-banner">
            O prazo de lançamento terminou. Seu acesso está em consulta.
          </div>
        )}
        {row?.status && (
          <div className="request-summary">
            <span className="badge blue">{row.status}</span>
            <p>
              Enviado por {row.createdByName}
              {row.decidedByName && ` · Decisão de ${row.decidedByName}`}
            </p>
            {row.decisionComment && <p>{row.decisionComment}</p>}
          </div>
        )}
        <fieldset className="form-grid" disabled={busy || !write}>
          <label className="wide">
            Ministério / destino
            <select
              name="ministry"
              value={ministry}
              onChange={(e) => setMinistry(e.target.value)}
              required={kind === "requests"}
            >
              {["admin", "treasury", "presbytery"].includes(user.role) && (
                <option value="">
                  {kind === "requests"
                    ? "Selecione um ministério"
                    : "Gestão geral da igreja"}
                </option>
              )}
              {(data.ministries || [])
                .filter(
                  (m) =>
                    ["admin", "treasury", "presbytery"].includes(user.role) ||
                    m.id === user.ministry,
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
          {kind === "budgets" ? (
            <>
              <label>
                Ano
                <input
                  name="year"
                  type="number"
                  min={2020}
                  max={2100}
                  defaultValue={row?.year || year}
                  required
                />
              </label>
              <label>
                Período
                <select name="month" defaultValue={row?.month ?? month}>
                  <option value="0">Anual</option>
                  {months.map((m, i) => (
                    <option value={i + 1} key={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Área / centro de custo
                <input
                  name="area"
                  defaultValue={row?.area || ""}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
              <label>
                Orçamento (R$)
                <input
                  name="amount"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={(row?.amount || 0) / 100}
                  required
                />
              </label>
            </>
          ) : (
            <>
              <label className="wide">
                {kind === "requests" ? "Título do pedido" : "Descrição"}
                <input
                  name="name"
                  defaultValue={row?.name || ""}
                  required
                  minLength={2}
                  maxLength={160}
                />
              </label>
              <label>
                {kind === "requests" ? "Data prevista" : "Data da movimentação"}
                <input
                  name="date"
                  type="date"
                  defaultValue={
                    row?.date || new Date().toLocaleDateString("en-CA")
                  }
                  required
                />
              </label>
              {kind === "incomes" ? (
                <>
                  <label>
                    Categoria
                    <input
                      name="category"
                      defaultValue={row?.category || ""}
                      placeholder="Ex.: ofertas, doações, saldo inicial"
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Valor de entrada (R$)
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      min="0.01"
                      defaultValue={(row?.amount || 0) / 100}
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Área / centro de custo
                    <input
                      name="area"
                      defaultValue={row?.area || ""}
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <label className="wide">
                    Evento relacionado
                    <select name="event" defaultValue={row?.event || ""}>
                      <option value="">Sem evento vinculado</option>
                      {(data.events || [])
                        .filter((e) => e.ministry === ministry)
                        .map((e) => (
                          <option value={e.id} key={e.id}>
                            {e.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {kind === "requests" ? (
                    <>
                      <label>
                        Prioridade
                        <select
                          name="priority"
                          defaultValue={row?.priority || "Normal"}
                        >
                          <option>Normal</option>
                          <option>Alta</option>
                          <option>Baixa</option>
                        </select>
                      </label>
                      <label className="wide">
                        Objetivo e resultado esperado
                        <textarea
                          name="objective"
                          rows={3}
                          minLength={10}
                          maxLength={4000}
                          defaultValue={row?.objective || ""}
                          required
                        />
                      </label>
                    </>
                  ) : (
                    <label className="wide">
                      Pedido aprovado vinculado
                      <select
                        name="requestId"
                        defaultValue={row?.requestId || ""}
                      >
                        <option value="">Despesa avulsa</option>
                        {(data.requests || [])
                          .filter(
                            (r) =>
                              r.ministry === ministry &&
                              r.status === "Aprovado",
                          )
                          .map((r) => (
                            <option value={r.id} key={r.id}>
                              {r.name} · {money(r.amount)}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  {kind === "expenses" && (
                    <label className="wide">
                      Como o gasto foi realizado
                      <textarea
                        name="executionDetails"
                        rows={3}
                        minLength={10}
                        maxLength={4000}
                        defaultValue={row?.executionDetails || ""}
                        placeholder="Informe onde comprou ou contratou, como pagou e como os recursos foram utilizados."
                        required
                      />
                    </label>
                  )}
                  <label className="wide">
                    {kind === "requests" ? "Por que precisa de dinheiro da igreja?" : "Em que gastou e por quê?"}
                    <textarea
                      name="justification"
                      rows={3}
                      minLength={kind === "requests" ? 20 : 10}
                      maxLength={4000}
                      defaultValue={row?.justification || ""}
                      required
                    />
                  </label>
                </>
              )}
              {kind !== "requests" && (
                <label className="wide">
                  Observações
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={row?.notes || ""}
                    maxLength={4000}
                  />
                </label>
              )}
            </>
          )}
          {itemized && (
            <div className="wide line-items">
              <h3>Itens separados</h3>
              {items.map((item, i) => (
                <div className="item-editor" key={i}>
                  <label>
                    Descrição
                    <input
                      aria-label={`Descrição do item ${i + 1}`}
                      value={item.description}
                      onChange={(e) =>
                        changeItem(i, "description", e.target.value)
                      }
                      minLength={2}
                      maxLength={200}
                      required
                    />
                  </label>
                  <label>
                    Categoria
                    <input
                      aria-label={`Categoria do item ${i + 1}`}
                      value={item.category}
                      onChange={(e) =>
                        changeItem(i, "category", e.target.value)
                      }
                      minLength={2}
                      maxLength={100}
                      required
                    />
                  </label>
                  <label>
                    Valor (R$)
                    <input
                      aria-label={`Valor do item ${i + 1}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => changeItem(i, "amount", e.target.value)}
                      required
                    />
                  </label>
                  {items.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remover item ${i + 1}`}
                      onClick={() => setItems(items.filter((_, n) => n !== i))}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              {write && items.length < 50 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setItems([
                      ...items,
                      { description: "", category: "", amount: "0" },
                    ])
                  }
                >
                  <Plus size={16} />
                  Adicionar item
                </button>
              )}
              <div className="item-total">
                Total dos itens <strong>{money(total)}</strong>
              </div>
            </div>
          )}
        </fieldset>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Fechar
          </button>
          {write && (
            <button className="primary" disabled={busy}>
              {busy
                ? "Salvando…"
                : kind === "requests"
                  ? "Enviar pedido"
                  : "Salvar"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
export function AccountForm({
  row,
  data,
  busy,
  onSave,
  onClose,
}: {
  row?: Row;
  data: Record<string, Row[]>;
  busy: boolean;
  onSave: (payload: any) => Promise<void>;
  onClose: () => void;
}) {
  const [role, setRole] = useState(row?.role || "member"),
    [allowed, setAllowed] = useState(!!row?.financeAccess);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        await onSave({
          ...f,
          role,
          financeAccess: role === "admin" ? true : allowed,
        });
      }}
    >
      <div className="form-body">
        <div className="scope-banner">
          <LockKeyhole size={18} />
          <span>Somente o administrador principal escolhe os acessos.</span>
        </div>
        <fieldset className="form-grid" disabled={busy}>
          <label>
            Nome
            <input
              name="name"
              defaultValue={row?.name || ""}
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <label>
            E-mail
            <input
              name="email"
              type="email"
              defaultValue={row?.email || ""}
              required
              maxLength={200}
            />
          </label>
          {!row && (
            <label className="wide">
              Senha inicial (mínimo 12 caracteres)
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
          )}
          <label>
            Perfil
            <select
              name="role"
              value={role}
              disabled={!!row?.isOwner}
              onChange={(e) => {
                setRole(e.target.value);
                setAllowed(false);
              }}
            >
              {Object.entries({
                member: "Membro",
                ministry: "Ministério",
                treasury: "Tesouraria",
                presbytery: "Presbitério",
                admin: "Admin",
              }).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ministério
            <select
              name="ministry"
              defaultValue={row?.ministry || ""}
              required={["member", "ministry"].includes(role)}
            >
              <option value="">
                {["member", "ministry"].includes(role)
                  ? "Selecione"
                  : "Sem vínculo específico"}
              </option>
              {(data.ministries || []).map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          {role === "admin" ? (
            <p className="wide finance-note">
              Este perfil tem acesso operacional completo. Apenas sua conta
              principal poderá gerenciar autorizações.
            </p>
          ) : (
            <label className="wide checkbox-label">
              <input
                type="checkbox"
                checked={allowed}
                onChange={(e) => setAllowed(e.target.checked)}
              />
              <span>
                Autorizar acesso ao financeiro
                <small>
                  {["member", "ministry"].includes(role)
                    ? "Consulta somente do ministério vinculado."
                    : "Acesso à área financeira da igreja, conforme as operações do perfil."}
                </small>
              </span>
            </label>
          )}
        </fieldset>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button disabled={busy} className="primary">
            Salvar usuário
          </button>
        </div>
      </div>
    </form>
  );
}
export function UserAccess({
  accounts,
  data,
  busy,
  onOpen,
  onMutate,
}: {
  accounts: Row[];
  data: Record<string, Row[]>;
  busy: boolean;
  onOpen: (kind: string, row?: Row) => void;
  onMutate: (body: any) => Promise<boolean>;
}) {
  const name = (id: string) =>
    (data.ministries || []).find((m) => m.id === id)?.name || "Igreja";
  const roles: Record<string, string> = {
    admin: "Admin",
    treasury: "Tesouraria",
    presbytery: "Presbitério",
    ministry: "Ministério",
    member: "Membro",
  };
  return (
    <section className="panel spaced">
      <div className="panel-heading">
        <div>
          <h2>Usuários e autorizações individuais</h2>
          <p>
            Criar um perfil não libera o financeiro. Somente você autoriza cada
            pessoa.
          </p>
        </div>
        <button className="primary" onClick={() => onOpen("user")}>
          <Plus size={17} />
          Novo usuário
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Perfil / vínculo</th>
              <th>Acesso financeiro</th>
              <th>Conta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.name}</strong>
                  <small>
                    {a.email}
                    {a.isOwner ? " · Administrador principal" : ""}
                  </small>
                </td>
                <td>
                  {roles[a.role]}
                  <small>{name(a.ministry)}</small>
                </td>
                <td>
                  <span className={"badge " + (a.canFinance ? "green" : "red")}>
                    {a.canFinance ? "Autorizado" : "Bloqueado"}
                  </span>
                  {a.role !== "admin" && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        onMutate({
                          action: "setFinanceAccess",
                          id: a.id,
                          allowed: !a.financeAccess,
                        })
                      }
                    >
                      {a.financeAccess ? "Bloquear" : "Liberar"}
                    </button>
                  )}
                </td>
                <td>{a.active ? "Ativa" : "Desativada"}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="text-button"
                      onClick={() => onOpen("updateUser", a)}
                    >
                      Editar
                    </button>
                    <button
                      className="text-button"
                      onClick={() => onOpen("password", a)}
                    >
                      Redefinir senha
                    </button>
                    {!a.isOwner &&
                      (a.active ? (
                        <button
                          className="text-button negative"
                          onClick={() => onOpen("disableUser", a)}
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          className="text-button"
                          onClick={() =>
                            onMutate({ action: "enableUser", id: a.id })
                          }
                        >
                          Reativar
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <FileCheck size={28} />
      <strong>{text}</strong>
      <p>Os indicadores serão atualizados conforme os lançamentos.</p>
    </div>
  );
}
