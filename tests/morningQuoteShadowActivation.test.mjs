import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const runner=read("app/lib/research/morningFinalCheckRunner.ts");
const mapper=read("app/lib/research/morningQuoteSafeRecord.ts");
const summary=read("app/lib/research/morningQuoteDiagnosisSummary.mjs");
const sql=read("research/sql/morning_0905_dev_diagnostic_draft.sql");
const gates=read("research/MORNING_0905_SHADOW_ACTIVATION_GATES_20261026.md");

test("existing runner has no shadow database writer or new endpoint",()=>{
 assert.doesNotMatch(runner,/morning_quote_research|quote_diagnostics|safeMorningQuoteRecord|summarizeMorningQuoteDiagnostics/);
 assert.match(runner,/const MAX_CODES=5/);
 assert.match(runner,/const claim=await pool\.query\(/);
});
test("research-only modules cannot request or persist upstream data",()=>{
 for(const [name,source] of [["mapper",mapper],["summary",summary]]){
  assert.doesNotMatch(source,/\bfetch\s*\(|\bpool\.query\s*\(|\bconsole\.|\bprocess\.env\b|\baxios\b/i,name);
 }
});
test("schema is private and clients are denied",()=>{
 assert.match(sql,/create schema if not exists morning_quote_research/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on schema morning_quote_research from public, anon, authenticated/);
 assert.match(sql,/revoke all on morning_quote_research\.quote_diagnostics from public, anon, authenticated/);
 assert.doesNotMatch(sql,/\bgrant\b/i);
});
test("activation requires licensing, isolation, authorization, and quality validation",()=>{
 for(const requirement of ["Data rights","Deployment isolation","Access control","Capture contract","Data quality","Retention"]){
  assert.ok(gates.includes(requirement),requirement);
 }
 assert.match(gates,/Do not do this without a reviewed architecture and explicit approval/);
});
