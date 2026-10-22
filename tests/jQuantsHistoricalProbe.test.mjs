import test from "node:test";
import assert from "node:assert/strict";
import { probeJQuantsHistoricalDailyBar } from "../app/lib/research/jQuantsHistoricalProbe.mjs";

test("missing key never calls provider", async () => {
  const result = await probeJQuantsHistoricalDailyBar({ apiKey: "", code: "3996", date: "2026-07-01", fetchImpl: () => { throw Error("called"); } });
  assert.equal(result.status, "KEY_NOT_CONFIGURED");
});
test("probe uses API key header and never returns price or credentials", async () => {
  const result = await probeJQuantsHistoricalDailyBar({
    apiKey: "test-secret", code: "3996", date: "2026-07-01",
    fetchImpl: async (url, options) => {
      assert.equal(url.searchParams.get("code"), "39960");
      assert.equal(options.headers["x-api-key"], "test-secret");
      return { ok: true, status: 200, json: async () => ({ data: [{ Code: "39960", Date: "2026-07-01", C: 250 }] }) };
    },
  });
  assert.deepEqual(result, { status: "HISTORICAL_BAR_PRESENT", priceVerified: false, publishableReturn: false });
});
test("rejects provider rate limits and ambiguous bars", async () => {
  const args = { apiKey: "test-secret", code: "3996", date: "2026-07-01" };
  assert.equal((await probeJQuantsHistoricalDailyBar({ ...args, fetchImpl: async () => ({ status: 429, ok: false }) })).status, "RATE_LIMITED");
  assert.equal((await probeJQuantsHistoricalDailyBar({ ...args, fetchImpl: async () => ({ status: 200, ok: true, json: async () => ({ data: [] }) }) })).status, "NO_UNAMBIGUOUS_BAR");
});

// Offline comparator is exercised by the established PR workflow without nested node:test execution.
import { compareHistoricalBar } from "../app/lib/research/jquants-reference-compare.ts";
import { readFileSync } from "node:fs";

test("reference comparator matches fixed bar and rejects mismatches", () => {
  const bar = { Code: "39960", Date: "2026-07-01", O: 173, H: 175, L: 173, C: 175, Vo: 7000 };
  assert.equal(compareHistoricalBar(bar), "REFERENCE_MATCH");
  assert.equal(compareHistoricalBar({ ...bar, C: 176 }), "REFERENCE_MISMATCH");
  assert.equal(compareHistoricalBar({ ...bar, Vo: 7001 }), "REFERENCE_MISMATCH");
  assert.equal(compareHistoricalBar({ ...bar, H: null }), "FIELDS_MISSING");
  assert.equal(compareHistoricalBar({ ...bar, Date: "2026-07-02" }), "WRONG_BAR");
  assert.equal(compareHistoricalBar({ ...bar, Code: "39970" }), "WRONG_BAR");
});

test("research comparison API is Preview-only, admin-gated and unverified", () => {
  const route = readFileSync(new URL("../app/api/admin/research/jquants-reference-compare/route.ts", import.meta.url), "utf8");
  assert.match(route, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.match(route, /process\.env\.JQUANTS_RESEARCH_PROBE_ENABLED !== "true"/);
  assert.match(route, /getAdminSession\(\)/);
  assert.match(route, /independentlyCompared:\s*false/);
  assert.match(route, /priceVerified:\s*false/);
  assert.match(route, /publishableReturn:\s*false/);
  assert.doesNotMatch(route, /console\./);
});

// Register the complete 18-case offline suite in the established PR workflow.
// These are module imports, not recursive node:test child processes.
await import("./jquants-reference-compare.test.mjs");
await import("./jquants-reference-compare-route.test.mjs");
