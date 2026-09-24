import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const gate = fs.readFileSync("docs/release-gate.md", "utf8");

test("release gate requires the Android production Vercel project", () => {
  assert.match(gate, /Vercel project is `signal-x-ppjg`/);
  assert.match(gate, /Preview deployment/);
  assert.match(gate, /last known-good deployment/);
});
