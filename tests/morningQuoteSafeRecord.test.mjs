import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";

const src=readFileSync(new URL("../app/lib/research/morningQuoteSafeRecord.ts",import.meta.url),"utf8");
const runner=readFileSync(new URL("../app/lib/research/morningFinalCheckRunner.ts",import.meta.url),"utf8");
const sql=readFileSync(new URL("../research/sql/morning_0905_dev_diagnostic_draft.sql",import.meta.url),"utf8");

test("safe record mapper is valid TypeScript",()=>{
  const f=ts.createSourceFile("morningQuoteSafeRecord.ts",src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  assert.deepEqual(f.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText," ")),[]);
});
test("mapper validates ISO date and clamps metadata count",()=>{
  assert.match(src,/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
  assert.match(src,/Math\.min\(75, Math\.max\(0, m\.timestampCount\)\)/);
});
test("mapper never fetches, queries, logs or persists",()=>{
  assert.doesNotMatch(src,/\bfetch\s*\(|\bpool\.query\s*\(|\bconsole\.|\b(insert|update|delete)\s+into\b/i);
});
test("mapper has no identifying or price columns in its returned record",()=>{
  for(const prohibited of ["code:","symbol:","ticker:","open:","high:","low:","close:","volume:","user_id:"])
    assert.ok(!src.includes(prohibited),prohibited);
  assert.match(sql,/create table if not exists morning_quote_research\.quote_diagnostics/);
});
test("existing morning runner remains disconnected from mapper and diagnostic DB",()=>{
  assert.doesNotMatch(runner,/morningQuoteSafeRecord|morning_quote_research|quote_diagnostics/);
  assert.match(runner,/const claim=await pool\.query\(/);
  assert.match(runner,/const snapshots=await Promise\.all\(run\.cohort\.slice\(0,MAX_CODES\)/);
  assert.match(runner,/const MAX_CODES=5/);
});
