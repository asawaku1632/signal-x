import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const next = fs.readFileSync("docs/next-step.md", "utf8");
test("next step targets signal-x-ppjg Preview", () => assert.match(next, /signal-x-ppjg/));
