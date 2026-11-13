import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/lib/scanSnapshot.ts", import.meta.url), "utf8");
const sql = readFileSync(new URL("../docs/research/scan-provenance-shadow-proposed-schema.sql", import.meta.url), "utf8");

test("shadow writer remains disabled by default and only captures main scan", () => {
  assert.match(source, /key !== SCAN_SNAPSHOT_KEY \|\| process\.env\.SCAN_PROVENANCE_SHADOW_ENABLED !== "true"/);
});
test("shadow write failure is isolated from scan response", () => {
  assert.match(source, /await recordScanProvenanceShadow\(key, stocks, payload\.updatedAt!\)/);
  assert.match(source, /\.catch\(\(error\) => console\.error\("scan provenance shadow capture failed:", error\)\)/);
});
test("shadow data is append-only, deduplicated and not publicly granted", () => {
  assert.match(source, /ON CONFLICT \(snapshot_key, scan_generated_at, code\) DO NOTHING/);
  assert.match(sql, /REVOKE ALL ON public\.ai_power_scan_provenance_shadow FROM anon, authenticated/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(sql, /CREATE POLICY/i);
});
test("no unverified learning timestamp is represented as verified", () => {
  assert.match(source, /learningAsOf: null/);
});
