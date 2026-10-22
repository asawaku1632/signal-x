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

// Keep the isolated comparator suite covered by the established PR workflow.
// This invokes only offline tests: no API key, network, or production writes.
test("research-only reference comparison suite passes (18 cases)", async () => {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types", "--test",
    "tests/jquants-reference-compare.test.mjs",
    "tests/jquants-reference-compare-route.test.mjs",
  ], { cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join("\n"));
  assert.match(result.stdout, /# pass 18(?:\r?\n|$)/);
  assert.match(result.stdout, /# fail 0(?:\r?\n|$)/);
});
