import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const module = await import(
  pathToFileURL(resolve(process.cwd(), "app/lib/learning/patternForwardBonus.ts")).href
);

const {
  calculateValidatedPatternStatBonus,
  calculateValidatedPatternForwardBonus,
} = module;

function stat(overrides = {}) {
  return {
    patternId: "pattern050",
    patternName: "赤三兵",
    direction: "BUY",
    sampleCount: 80,
    completed1dCount: 80,
    completed3dCount: 75,
    completed5dCount: 70,
    winRate1d: 62,
    winRate3d: 64,
    winRate5d: 66,
    avgDirectionalReturn1d: 0.4,
    avgDirectionalReturn3d: 0.8,
    avgDirectionalReturn5d: 1.2,
    medianDirectionalReturn5d: 0.7,
    avgRawReturn1d: 0.4,
    avgRawReturn3d: 0.8,
    avgRawReturn5d: 1.2,
    distinctCodes: 40,
    distinctDates: 22,
    validationStatus: "VALIDATED",
    statusReason: "Forward 5-day validation criteria passed",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

assert.equal(calculateValidatedPatternStatBonus(stat()), 4);
assert.equal(
  calculateValidatedPatternStatBonus(
    stat({ direction: "SELL", winRate5d: 71, avgDirectionalReturn5d: 2.2 }),
  ),
  -6,
);
assert.equal(
  calculateValidatedPatternStatBonus(stat({ validationStatus: "PROMISING" })),
  0,
);
assert.equal(
  calculateValidatedPatternStatBonus(stat({ direction: "NEUTRAL" })),
  0,
);

const observations = [
  {
    id: "pattern050",
    name: "赤三兵",
    direction: "BUY",
    confidence: 84,
    score: 24,
  },
  {
    id: "pattern049",
    name: "上げ三法",
    direction: "BUY",
    confidence: 82,
    score: 25,
  },
];

const statsMap = new Map([
  ["pattern050", stat()],
  [
    "pattern049",
    stat({
      patternId: "pattern049",
      patternName: "上げ三法",
      winRate5d: 62,
      avgDirectionalReturn5d: 0.7,
    }),
  ],
]);

const combined = calculateValidatedPatternForwardBonus(observations, statsMap);
assert.equal(combined.applied, true);
assert.equal(combined.matchedValidatedCount, 2);
assert.equal(combined.bonus, 5);
assert.equal(combined.patternId, "pattern050");

// Regression: a validated statistic must never be applied when the
// observation's direction differs, even when the pattern ID matches.
const directionMismatch = calculateValidatedPatternForwardBonus(
  [{ id: "pattern050", name: "赤三兵", direction: "SELL", confidence: 80, score: 20 }],
  new Map([["pattern050", stat({ direction: "BUY" })]]),
);
assert.equal(directionMismatch.applied, false);
assert.equal(directionMismatch.bonus, 0);

// Neutral and collecting patterns must never affect AI POWER.
const neutralObservation = calculateValidatedPatternForwardBonus(
  [{ id: "pattern050", name: "赤三兵", direction: "NEUTRAL", confidence: 80, score: 20 }],
  new Map([["pattern050", stat({ direction: "NEUTRAL" })]]),
);
assert.equal(neutralObservation.applied, false);
assert.equal(neutralObservation.bonus, 0);

const noValidated = calculateValidatedPatternForwardBonus(
  observations,
  new Map([["pattern050", stat({ validationStatus: "PROMISING" })]]),
);
assert.equal(noValidated.applied, false);
assert.equal(noValidated.bonus, 0);

// Source-level regression: the database loader must exclude pattern IDs whose
// observed directions disagree with the pooled stats direction.
// This test is offline: it never connects to Supabase or runs a real trade.
const loaderSource = readFileSync(
  resolve(process.cwd(), "app/lib/learning/patternForwardLearning.ts"),
  "utf8",
);
const validatedLookup = loaderSource.split(
  "export async function getValidatedPatternForwardStatsMap(",
)[1];
assert.ok(validatedLookup, "validated stats lookup must exist");
assert.match(validatedLookup, /validation_status\s*=\s*'VALIDATED'/);
assert.match(validatedLookup, /NOT EXISTS\s*\(/);
assert.match(validatedLookup, /observation\.pattern_id\s*=\s*pattern_forward_stats\.pattern_id/);
assert.match(validatedLookup, /observation\.direction\s+IS DISTINCT FROM\s+pattern_forward_stats\.direction/);

// Validation thresholds must count only completed, directionally scored
// five-day observations, not pending detections on unrelated dates/stocks.
const refreshSource = loaderSource.split(
  "export async function refreshPatternForwardStats(): Promise<void> {",
)[1]?.split("function numberOrNull(")[0];
assert.ok(refreshSource, "pattern stats refresh must exist");
assert.match(refreshSource, /COUNT\(DISTINCT direction\)\s*>\s*1\s+THEN 'COLLECTING'/);
assert.match(refreshSource, /COUNT\(DISTINCT code\) FILTER \(WHERE return_5d IS NOT NULL AND success_5d IS NOT NULL\) >= 30/);
assert.match(refreshSource, /COUNT\(DISTINCT trade_date\) FILTER \(WHERE return_5d IS NOT NULL AND success_5d IS NOT NULL\) >= 15/);
assert.match(refreshSource, /COUNT\(DISTINCT code\) FILTER \(WHERE return_5d IS NOT NULL AND success_5d IS NOT NULL\) >= 15/);
assert.match(refreshSource, /COUNT\(DISTINCT trade_date\) FILTER \(WHERE return_5d IS NOT NULL AND success_5d IS NOT NULL\) >= 8/);

console.log(JSON.stringify({
  status: "PASS",
  validatedBuyBonus: calculateValidatedPatternStatBonus(stat()),
  validatedSellBonus: calculateValidatedPatternStatBonus(
    stat({ direction: "SELL", winRate5d: 71, avgDirectionalReturn5d: 2.2 }),
  ),
  combinedBonus: combined.bonus,
}, null, 2));
