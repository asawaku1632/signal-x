import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const incident = fs.readFileSync("docs/incident-2026-09-24.md", "utf8");

test("incident record keeps the verified Android recovery target", () => {
  assert.match(incident, /signal-x-ppjg\.vercel\.app/);
  assert.match(incident, /a1cc86e/);
  assert.match(incident, /restored chart display/);
});
