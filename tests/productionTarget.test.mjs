import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const doc = fs.readFileSync("docs/production-target.md", "utf8");

test("Android production target is explicitly pinned", () => {
  assert.match(doc, /signal-x-ppjg\.vercel\.app/);
  assert.match(doc, /Vercel project: `signal-x-ppjg`/);
  assert.match(doc, /Do not use that project/);
});
