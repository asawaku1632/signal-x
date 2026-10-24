import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const purpose = fs.readFileSync("docs/branch-purpose.md", "utf8");

test("follow-up branch is preview-first", () => {
  assert.match(purpose, /Preview-verified before merge/);
  assert.match(purpose, /does not authorize a Production promotion/);
});
