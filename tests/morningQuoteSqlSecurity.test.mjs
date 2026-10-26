import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL("../research/sql/morning_0905_dev_diagnostic_draft.sql",import.meta.url),"utf8");
const normalized=sql.replace(/--[^\n]*/g,"").toLowerCase();

test("diagnostic table lives in a dedicated non-public schema",()=>{
  assert.match(normalized,/create schema if not exists morning_quote_research/);
  assert.match(normalized,/create table if not exists morning_quote_research\.quote_diagnostics/);
  assert.doesNotMatch(normalized,/create table(?: if not exists)? public\./);
});
test("deny-by-default schema and table privileges",()=>{
  assert.match(normalized,/revoke all on schema morning_quote_research from public, anon, authenticated/);
  assert.match(normalized,/revoke all on morning_quote_research\.quote_diagnostics from public, anon, authenticated/);
  assert.match(normalized,/revoke all on sequence morning_quote_research\.quote_diagnostics_id_seq from public, anon, authenticated/);
  assert.match(normalized,/alter table morning_quote_research\.quote_diagnostics enable row level security/);
});
test("draft does not grant client access or create permissive policies",()=>{
  assert.doesNotMatch(normalized,/\bgrant\s+/);
  assert.doesNotMatch(normalized,/\bcreate\s+policy\b/);
  assert.doesNotMatch(normalized,/\bsecurity\s+definer\b/);
});
test("draft contains no ticker, OHLCV, token, or user columns",()=>{
  const fields=[...normalized.matchAll(/^\s*([a-z][a-z0-9_]*)\s+(?:bigint|date|text|integer|boolean|timestamptz)\b/gm)].map(x=>x[1]);
  assert.deepEqual(fields,["id","research_run_date","stage","reason","http_status_class","timestamp_count","has_0900","has_0905","classifier_version","recorded_at"]);
});
test("failure reason and count are bounded",()=>{
  assert.match(normalized,/check \(timestamp_count between 0 and 75\)/);
  assert.match(normalized,/check \(reason in \(/);
  assert.match(normalized,/check \(length\(classifier_version\) between 1 and 32\)/);
});
