import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const source = await readFile(new URL('../components/finance-analysis.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {analyzeFinances} = await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
const row = (ministry,date,amount,area='Custo fixo')=>({ministry,date,amount,area});
test('deficit, required adjustment, category totals and cross-year changes remain scoped',()=>{
 const data={incomes:[row('own','2025-12-10',20000),row('own','2026-01-10',10000),row('other','2026-01-10',999999)],expenses:[row('own','2025-12-10',10000),row('own','2026-01-10',12000),row('own','2026-01-15',3000,'custo FIXO'),row('other','2026-01-10',888888)]};
 const a=analyzeFinances(data,2026,1,'own');
 assert.equal(a.net,-5000);assert.equal(a.deficit,5000);assert.equal(a.incomeDelta,-10000);assert.equal(a.spentDelta,5000);assert.equal(a.previousYear,2025);assert.equal(a.previousMonth,12);assert.equal(a.categories.length,1);assert.equal(a.categories[0].amount,15000);assert.equal(a.reductionPercent,5000/15000*100);assert.equal(a.coverage,10000/15000*100);assert.equal(a.deficitMonths.length,1);
 assert.equal(a.monthly[1].recorded,false);assert.equal(a.monthly[1].net,null);
});
test('annual comparison, monthly peaks and surplus use actual records only',()=>{
 const data={incomes:[row('a','2025-01-01',10000),row('a','2026-01-01',20000),row('a','2026-02-01',10000)],expenses:[row('a','2026-01-01',5000),row('a','2026-02-01',15000)]};
 const a=analyzeFinances(data,2026,0,'');
 assert.equal(a.net,10000);assert.equal(a.deficit,0);assert.equal(a.incomeDelta,20000);assert.equal(a.previousMonth,0);assert.equal(a.peakIncome,1);assert.equal(a.peakExpense,2);assert.equal(a.deficitMonths[0].month,2);assert.equal(a.categories[0].amount,20000);
});
test('empty periods and zero income avoid false trends, false equilibrium and division by zero',()=>{
 const empty=analyzeFinances({},2026,10,'a');assert.equal(empty.hasCurrent,false);assert.equal(empty.hasPrevious,false);assert.equal(empty.coverage,null);assert.equal(empty.peakIncome,null);
 const a=analyzeFinances({expenses:[row('a','2026-10-01',1000)]},2026,10,'a');assert.equal(a.coverage,0);assert.equal(a.reductionPercent,100);assert.equal(a.hasPrevious,false);assert.equal(a.deficit,1000);
});
