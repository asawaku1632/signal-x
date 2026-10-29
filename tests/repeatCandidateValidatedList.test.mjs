import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page = readFileSync("app/admin/repeat-candidate-risk/page.tsx","utf8");
test("date-screened values are used consistently in statistics and list", () => {
 assert.ok(page.includes("const all = verifiedRows"));
 assert.ok(page.includes("verifiedRows.filter"));
 assert.ok(page.includes("日付不整合で除外"));
});
