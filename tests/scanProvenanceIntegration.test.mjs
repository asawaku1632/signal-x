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
  assert.match(source, /ON CONFLICT DO NOTHING/);
  assert.doesNotMatch(source, /ON CONFLICT \(snapshot_key, scan_generated_at, code\) DO NOTHING/);
  assert.match(sql, /REVOKE ALL ON scan_provenance_research\.shadow_capture_test FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /CREATE POLICY shadow_writer_insert/);
  assert.match(sql, /GRANT INSERT ON scan_provenance_research\.shadow_capture_test TO scan_provenance_writer/);
  assert.doesNotMatch(sql, /GRANT (?:UPDATE|DELETE|TRUNCATE|SELECT) ON scan_provenance_research\.shadow_capture_test TO scan_provenance_writer/i);
  assert.match(source, /INSERT INTO scan_provenance_research\.shadow_capture_test/);
  assert.doesNotMatch(source, /INSERT INTO public\.ai_power_scan_provenance_shadow/);
});
test("no unverified learning timestamp is represented as verified", () => {
  assert.match(source, /learningAsOf: null/);
});

test("shadow uses a dedicated bounded pool and never falls back to DATABASE_URL", () => {
  const db = readFileSync(new URL("../app/lib/learning/scanProvenanceDb.ts", import.meta.url), "utf8");
  assert.match(source, /getScanProvenancePool\(\)/);
  assert.match(source, /await shadowPool\.query\(/);
  assert.match(db, /process\.env\.SCAN_PROVENANCE_DATABASE_URL/);
  assert.doesNotMatch(db, /process\.env\.DATABASE_URL/);
  assert.match(db, /if \(!connectionString\) return null/);
  assert.match(db, /connectionTimeoutMillis: 1000/);
  assert.match(db, /statement_timeout: 1500/);
});
