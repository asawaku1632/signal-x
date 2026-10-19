import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSwingHistoricalEvidence } from "../app/lib/learning/swingEvidenceAdvisory.ts";

function sample({ dates = 7, d3 = -1.4, d5 = -0.99, n3 = 341, n5 = 179 } = {}) {
  return {
    status: "CANDIDATE", count: 606, distinctDates: dates,
    outcomes: [
      { days: 1, checked: 504, averageReturnPercent: 0.3 },
      { days: 3, checked: n3, averageReturnPercent: d3 },
      { days: 5, checked: n5, averageReturnPercent: d5 },
    ],
  };
}

test("negative 3/5-day evidence produces an early caution, not an approval", () => {
  const result = summarizeSwingHistoricalEvidence(sample());
  assert.equal(result.status, "CAUTION");
  assert.equal(result.enoughHistory, false);
  assert.equal(result.horizons[0].averageReturnPercent, -1.4);
  assert.equal(result.horizons[1].checked, 179);
});

test("positive but short history remains collecting", () => {
  assert.equal(summarizeSwingHistoricalEvidence(sample({ d3: 0.5, d5: 1.1 })).status, "COLLECTING");
});

test("adequate positive reference history is never labeled as a buy approval", () => {
  const result = summarizeSwingHistoricalEvidence(sample({ dates: 20, d3: 0.3, d5: 0.2, n5: 220 }));
  assert.equal(result.status, "REFERENCE");
  assert.equal(result.enoughHistory, true);
});

test("null, zero completed or missing outcomes never become a 0-percent success", () => {
  const result = summarizeSwingHistoricalEvidence(sample({ n3: 0, d3: 0, n5: 0, d5: null }));
  assert.equal(result.status, "NO_DATA");
  assert.equal(result.horizons[0].averageReturnPercent, null);
  assert.equal(result.horizons[1].averageReturnPercent, null);
  assert.equal(summarizeSwingHistoricalEvidence(null).status, "NO_DATA");
});

test("small negative slices do not support a categorical warning", () => {
  const result = summarizeSwingHistoricalEvidence(sample({ n3: 2, n5: 2 }));
  assert.equal(result.status, "COLLECTING");
});
