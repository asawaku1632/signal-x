import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/lib/learning/trendPullbackReversal.ts", import.meta.url), "utf8");
const start = source.indexOf("WITH pending AS (");
const end = source.indexOf("`,[targetDate])", start);
assert.ok(start >= 0 && end > start, "Cannot locate TPR outcome SQL");
const sql = source.slice(start, end);

test("outcomes use one, three and five distinct trading dates", () => {
  assert.match(sql, /DISTINCT ON\s*\(d\.date\)/);
  for (const day of [1, 3, 5]) assert.match(sql, new RegExp("rn=" + day));
});
test("outcomes never overwrite existing forward returns", () => {
  for (const day of [1, 3, 5]) {
    assert.match(sql, new RegExp("result_" + day + "d=COALESCE\\(h\\.result_" + day + "d,"));
  }
});
test("outcomes only use prices through target date", () => {
  assert.match(sql, /d\.date<=\$1::date::text/);
});
