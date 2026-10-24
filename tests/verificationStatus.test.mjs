import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const status = fs.readFileSync("docs/verification-status.md", "utf8");
test("branch is not treated as production-approved before Preview", () => {
  assert.match(status, /Preview build\/tests/);
  assert.match(status, /chart freshness implementation remains a separate pending change/);
});
