import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Static contract regression on the existing production source. This test
// documents an unsafe upsert until a separately approved production fix.
// It never imports the application, executes SQL, or calls a market provider.
const sourceUrl=new URL("../../app/lib/learning/patternForwardLearning.ts",import.meta.url);
test("research audit detects mutable initial entry price in existing forward capture",async()=>{
 const source=await readFile(sourceUrl,"utf8");
 const save=source.slice(source.indexOf("export async function savePatternForwardObservations"),source.indexOf("export async function updatePatternForwardOutcomes"));
 assert.match(save,/ON CONFLICT \(trade_date, code, pattern_id\) DO UPDATE SET/);
 assert.match(save,/entry_price = EXCLUDED\.entry_price/);
});
test("future result updater does not directly overwrite original entry price",async()=>{
 const source=await readFile(sourceUrl,"utf8");
 const update=source.slice(source.indexOf("export async function updatePatternForwardOutcomes"),source.indexOf("export async function refreshPatternForwardStats"));
 assert.match(update,/UPDATE pattern_forward_observations p/);
 assert.doesNotMatch(update,/SET\s+entry_price\s*=/);
});
