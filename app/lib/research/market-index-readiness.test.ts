import test from "node:test";
import assert from "node:assert/strict";
import { summarizeMarketIndexReadiness } from "./market-index-readiness.ts";

const empty = {
  providerRightsVerified: false,
  licensedEvidenceAuthenticated: false,
  exchangeCalendarAuthenticated: false,
  observedMarketDataValidated: false,
  scheduledCaptureConfigured: false,
  databasePersistenceConfigured: false,
};
test("no evidence blocks all five checks and never enables production", () => {
  const report = summarizeMarketIndexReadiness(empty);
  assert.deepEqual(report.blockers, ["RIGHTS", "CALENDAR", "MARKET_DATA", "SCHEDULE", "RESEARCH_DB"]);
  assert.equal(report.productionEnabled, false);
  assert.equal(report.officialPersistenceEnabled, false);
  assert.equal(report.allIndependentEvidenceVerified, false);
});
test("all caller-supplied flags still cannot authorize production or official persistence", () => {
  const report = summarizeMarketIndexReadiness(Object.fromEntries(
    Object.keys(empty).map(k => [k, true])
  ) as unknown as typeof empty);
  assert.equal(report.blockers.length, 0);
  assert.equal(report.productionEnabled, false);
  assert.equal(report.officialPersistenceEnabled, false);
  assert.equal(report.allIndependentEvidenceVerified, false);
  assert.equal(report.items.length, 5);
});
test("partial evidence leaves the missing checks blocked", () => {
  const report = summarizeMarketIndexReadiness({ ...empty, scheduledCaptureConfigured: true, databasePersistenceConfigured: true });
  assert.deepEqual(report.blockers, ["RIGHTS", "CALENDAR", "MARKET_DATA"]);
});
test("unexpected and truthy nonboolean flags never pass a check", () => {
  const report = summarizeMarketIndexReadiness({
    ...empty, providerRightsVerified: "true", licensedEvidenceAuthenticated: 1,
    exchangeCalendarAuthenticated: "yes", observedMarketDataValidated: {},
  });
  assert.equal(report.blockers.length, 5);
});
