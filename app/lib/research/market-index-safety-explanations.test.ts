import test from "node:test";
import assert from "node:assert/strict";
import { explainResearchSafetyFindings } from "./market-index-safety-explanations.ts";
import type { ResearchSafetyAudit } from "./market-index-safety-audit.ts";
const base: ResearchSafetyAudit = {
  mode: "research_only", state: "blocked", mayFetch: false,
  mayPersist: false, maySchedule: false, mayUseInProduction: false, findings: [],
};
test("explanations never authorize data access", () => {
  const x = explainResearchSafetyFindings({ ...base, findings: ["CONNECTION_LICENSE"] });
  assert.equal(x.actionsEnabled, false);
  assert.equal(x.decision, "blocked");
  assert.equal(x.entries[0].description, "契約証拠の独立確認が必要です");
});
test("deduplicates, sorts, and bounds finding entries", () => {
  const findings = Array.from({ length: 150 }, (_, i) => "UNKNOWN_" + i);
  const x = explainResearchSafetyFindings({ ...base, findings: [...findings, "UNKNOWN_0"] });
  assert.equal(x.total, 100);
  assert.equal(new Set(x.entries.map(z => z.code)).size, 100);
});
test("rejects unsafe free-form strings instead of echoing private content", () => {
  const x = explainResearchSafetyFindings({ ...base, findings: ["someone@example.com", "<script>alert(1)</script>", "LICENSE_CUSTOM"] });
  assert.equal(x.total, 1);
  assert.equal(x.entries[0].description, "契約・利用範囲の確認が必要です");
});
test("handles missing findings as a blocked research-only result", () => {
  const x = explainResearchSafetyFindings({ ...base, findings: null as unknown as string[] });
  assert.equal(x.total, 0);
  assert.equal(x.actionsEnabled, false);
});
