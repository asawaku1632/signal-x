import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = ["app/lib/relatedLearning.ts", "app/lib/marketLearning.ts"];
const quoteColumns = ["nikkei", "topix", "usd_jpy", "vix"];

for (const path of files) {
  test(`${path}: NULL market quote upserts preserve previously stored values`, () => {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    for (const column of quoteColumns) {
      assert.match(source, new RegExp(`\\b${column}\\s*=\\s*COALESCE\\(EXCLUDED\\.${column},\\s*market_learning_logs\\.${column}\\)`));
      assert.doesNotMatch(source, new RegExp(`\\b${column}\\s*=\\s*EXCLUDED\\.${column}\\s*,`));
    }
  });
}
