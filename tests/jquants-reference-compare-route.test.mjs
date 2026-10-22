import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/admin/research/jquants-reference-compare/route.ts", import.meta.url), "utf8");

test("research comparison remains Preview-only and opt-in", () => {
  assert.match(route, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.match(route, /process\.env\.JQUANTS_RESEARCH_PROBE_ENABLED !== "true"/);
});
test("requires an authenticated administrator", () => {
  assert.match(route, /getAdminSession\(\)/);
  assert.match(route, /if \(!isAdmin\).*ADMIN_REQUIRED/);
});
test("never marks manual fixture as independently verified", () => {
  assert.match(route, /independentlyCompared:\s*false/);
  assert.match(route, /priceVerified:\s*false/);
  assert.match(route, /publishableReturn:\s*false/);
});
test("J-Quants secret remains server-side", () => {
  assert.match(route, /process\.env\.JQUANTS_API_KEY/);
  assert.match(route, /"x-api-key": process\.env\.JQUANTS_API_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_JQUANTS/);
});
test("does not persist or log provider response", () => {
  assert.doesNotMatch(route, /console\./);
  assert.doesNotMatch(route, /\.insert\(|\.upsert\(|\.update\(/);
});
