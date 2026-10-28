import test from "node:test";
import assert from "node:assert/strict";
import { immutablePatternForwardInsertSql as insert, immutablePatternForwardResultUpdateSql as update } from "../../app/lib/learning/immutablePatternForwardSqlResearch.mjs";
test("prospective SQL is insert-once and never replaces observed features",()=>{
 assert.match(insert,/ON CONFLICT \(trade_date, code, pattern_id\) DO NOTHING/);
 assert.doesNotMatch(insert,/EXCLUDED\.entry_price|DO UPDATE/);
});
test("future result-only SQL cannot overwrite initial price or previous outcome",()=>{
 assert.match(update,/return_5d IS NULL AND outcome_5d_date IS NULL/);
 assert.doesNotMatch(update,/SET\s+entry_price|SET\s+direction|EXCLUDED/);
});
