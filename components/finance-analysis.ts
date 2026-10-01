type Entry = { id?: string; ministry: string; date: string; amount: number; area?: string };
type Ledger = { incomes?: Entry[]; expenses?: Entry[] };
const total = (rows: Entry[]) => rows.reduce((sum, row) => sum + row.amount, 0);
export function analyzeFinances(data: Ledger, year: number, month: number, ministry: string) {
  const scoped = (rows: Entry[] = []) => rows.filter(r => !ministry || r.ministry === ministry);
  const incomes = scoped(data.incomes), expenses = scoped(data.expenses);
  const period = (rows: Entry[], y: number, m: number) => rows.filter(r => Number(r.date.slice(0,4)) === y && (!m || Number(r.date.slice(5,7)) === m));
  const currentIncome = period(incomes, year, month), currentExpense = period(expenses, year, month);
  const previousYear = month === 1 || !month ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month ? month - 1 : 0;
  const previousIncome = period(incomes, previousYear, previousMonth), previousExpense = period(expenses, previousYear, previousMonth);
  const income = total(currentIncome), spent = total(currentExpense), net = income - spent;
  const categoryTotals = new Map<string, { name: string; amount: number }>();
  for (const row of currentExpense) {
    const name = row.area?.trim() || 'Sem categoria';
    const key = name.toLocaleLowerCase('pt-BR');
    const value = categoryTotals.get(key) || { name, amount: 0 };
    value.amount += row.amount; categoryTotals.set(key, value);
  }
  const categories = [...categoryTotals.values()].sort((a,b) => b.amount - a.amount);
  const monthly = Array.from({length:12}, (_,i) => {
    const incoming = period(incomes, year, i+1), outgoing = period(expenses, year, i+1);
    const recorded = incoming.length + outgoing.length > 0;
    return { month: i+1, recorded, income: recorded ? total(incoming) : null, spent: recorded ? total(outgoing) : null, net: recorded ? total(incoming)-total(outgoing) : null };
  });
  const recordedMonths = monthly.filter(m => m.recorded);
  const deficitMonths = recordedMonths.filter(m => (m.net || 0) < 0);
  const peaks = (field: 'income'|'spent') => recordedMonths.length ? recordedMonths.reduce((best, row) => (row[field] || 0) > (best[field] || 0) ? row : best).month : null;
  return { income, spent, net, categories, monthly, deficitMonths, peakIncome: peaks('income'), peakExpense: peaks('spent'), hasCurrent: currentIncome.length+currentExpense.length>0, hasPrevious: previousIncome.length+previousExpense.length>0, previousYear, previousMonth, incomeDelta: income-total(previousIncome), spentDelta: spent-total(previousExpense), previousIncome: total(previousIncome), previousSpent: total(previousExpense), deficit: Math.max(0,-net), coverage: spent ? income/spent*100 : null, reductionPercent: spent && net<0 ? -net/spent*100 : 0 };
}
