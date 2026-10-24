import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rule = fs.readFileSync("docs/no-production-direct-edit.md", "utf8");
test("operations rule requires branch and Preview before Production", () => {
  assert.match(rule, /implement on a branch/);
  assert.match(rule, /verify Preview/);
  assert.match(rule, /signal-x-ppjg/);
});
