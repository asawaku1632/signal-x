import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("daily provenance table is private and non-retroactive", () => {
  const sql = read("supabase/migrations/20261009_create_daily_result_price_provenance.sql");
  assert.match(sql, /REFERENCES public\.daily_stock_results\(id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL PRIVILEGES[\s\S]*anon, authenticated/);
  assert.doesNotMatch(sql, /INSERT INTO public\.daily_result_price_provenance/i);
});

test("daily results and source metadata are saved together with no fabricated origin", () => {
  const runner = read("app/lib/learning/checkDailyRunner.ts");
  const transaction = runner.indexOf('await client.query("BEGIN")');
  const update = runner.indexOf("await bulkUpdateDailyResults(client, updates)");
  const provenance = runner.indexOf("await saveDailyResultProvenance(client, updates)");
  const commit = runner.indexOf('await client.query("COMMIT")', provenance);
  assert.ok(transaction >= 0 && update > transaction && provenance > update && commit > provenance);
  assert.match(runner, /sourceRowId: String\(row\.source_row_id\)/);
  assert.match(runner, /next_prices\.id AS source_row_id/);
  assert.match(runner, /source\.created_at, target\.result/);
  assert.match(runner, /ON CONFLICT \(daily_result_id\) DO NOTHING/);
  assert.match(runner, /provenanceCount !== updatedCount/);
});

test("admin-only audit is read-only and does not rewrite legacy scores", () => {
  const api = read("app/api/admin/ai-win-rate-audit/route.ts");
  assert.match(api, /getAdminSession/);
  assert.match(api, /if \(!isAdmin\)/);
  assert.match(api, /PRICE_ORIGIN_NOT_RECORDED/);
  assert.match(api, /new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(api, /\bUPDATE\b|\bDELETE\b|\bINSERT\b/);
  const page = read("app/admin/ai-win-rate-audit/page.tsx");
  assert.match(page, /取得元未記録/);
  assert.match(page, /正誤を断定しません/);
});
