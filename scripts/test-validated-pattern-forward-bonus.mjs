import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

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

const noValidated = calculateValidatedPatternForwardBonus(
  observations,
  new Map([["pattern050", stat({ validationStatus: "PROMISING" })]]),
);
assert.equal(noValidated.applied, false);
assert.equal(noValidated.bonus, 0);

console.log(JSON.stringify({
  status: "PASS",
  validatedBuyBonus: calculateValidatedPatternStatBonus(stat()),
  validatedSellBonus: calculateValidatedPatternStatBonus(
    stat({ direction: "SELL", winRate5d: 71, avgDirectionalReturn5d: 2.2 }),
  ),
  combinedBonus: combined.bonus,
}, null, 2));
