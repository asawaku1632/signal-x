import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { detectChartPatterns } = await import(
  pathToFileURL(resolve(root, "app/lib/chartPatternEngine.ts")).href
);

const part2Ids = new Set([
  "pattern001",
  "pattern009",
  "pattern013",
  "pattern016",
  "pattern017",
]);

function candle(time, open, high, low, close, volume = 100) {
  return { time, open, high, low, close, volume };
}

function boundedTrend(length, upperAt, lowerAt, volume = 100) {
  return Array.from({ length }, (_, index) => {
    const high = upperAt(index);
    const low = lowerAt(index);
    const middle = (high + low) / 2;
    const close = middle + (index % 2 === 0 ? 0.18 : -0.18);
    return candle(index, close - 0.12, high, low, close, volume);
  });
}

function risingPole(length = 12, start = 100, end = 108) {
  return Array.from({ length }, (_, index) => {
    const close = start + ((end - start) * index) / (length - 1);
    return candle(index, close - 0.35, close + 0.55, close - 0.65, close, 110);
  });
}

const descendingChannel = boundedTrend(
  30,
  (index) => 110 - index * 0.4,
  (index) => 100 - index * 0.4
);
descendingChannel.push(candle(30, 97.8, 99.7, 97.4, 99.2, 180));

const fallingWedge = boundedTrend(
  30,
  (index) => 112 - index * 0.55,
  (index) => 100 - index * 0.25
);
fallingWedge.push(candle(30, 95.3, 96.8, 94.9, 96.2, 180));

const pullbackBounce = [
  ...risingPole(10, 100, 109),
  ...Array.from({ length: 7 }, (_, offset) => {
    const close = 108 - offset * 0.42;
    return candle(10 + offset, close + 0.2, close + 0.65, close - 0.55, close, 90);
  }),
  candle(17, 105.8, 108.2, 105.5, 107.8, 160),
];

const bullFlag = [
  ...risingPole(),
  ...Array.from({ length: 10 }, (_, offset) => {
    const high = 109 - offset * 0.24;
    const low = 106 - offset * 0.24;
    const close = (high + low) / 2;
    return candle(12 + offset, close + 0.1, high, low, close, 85);
  }),
  candle(22, 106.2, 108, 105.9, 107.2, 170),
];

const bullPennant = [
  ...risingPole(),
  ...Array.from({ length: 10 }, (_, offset) => {
    const high = 109 - offset * 0.25;
    const low = 104 + offset * 0.2;
    const close = (high + low) / 2;
    return candle(12 + offset, close - 0.08, high, low, close, 80);
  }),
  candle(22, 106.3, 108, 106, 107.2, 170),
];

const positiveFixtures = new Map([
  ["pattern009", descendingChannel],
  ["pattern001", fallingWedge],
  ["pattern013", pullbackBounce],
  ["pattern016", bullFlag],
  ["pattern017", bullPennant],
]);

const suppressedFormationIds = new Map([
  ["pattern001", ["pattern009", "pattern041"]],
  ["pattern013", ["pattern006", "pattern034"]],
  ["pattern016", ["pattern034"]],
  ["pattern017", ["pattern042"]],
]);

for (const [id, candles] of positiveFixtures) {
  const detected = detectChartPatterns(candles);
  assert.ok(
    detected.some((pattern) => pattern.id === id),
    `${id} was not detected: ${JSON.stringify(detected)}`
  );
  for (const suppressedId of suppressedFormationIds.get(id) ?? []) {
    assert.ok(
      !detected.some((pattern) => pattern.id === suppressedId),
      `${id} must suppress ${suppressedId}: ${JSON.stringify(detected)}`
    );
  }
}

const flatMarket = Array.from({ length: 40 }, (_, index) =>
  candle(index, 100, 100.5, 99.5, 100, 100)
);

const unconfirmedWedge = fallingWedge.slice(0, -1);
unconfirmedWedge.push(candle(30, 94.9, 95.7, 94.5, 95.2, 170));

const wickOnlyChannel = descendingChannel.slice(0, -1);
wickOnlyChannel.push(candle(30, 97.8, 100.2, 97.4, 98, 180));

const nonParallelDescendingMove = boundedTrend(
  30,
  (index) => 111 - index * 0.2,
  (index) => 100 - index * 0.5
);
nonParallelDescendingMove.push(candle(30, 105.2, 106.7, 104.8, 106.4, 170));

const ordinaryPullback = [
  ...risingPole(10, 100, 103),
  ...Array.from({ length: 7 }, (_, offset) => {
    const close = 102.8 - offset * 0.15;
    return candle(10 + offset, close + 0.1, close + 0.4, close - 0.35, close, 90);
  }),
  candle(17, 102, 103.2, 101.8, 103, 150),
];

const weakNoVolumeBreakout = descendingChannel.slice(0, -1);
weakNoVolumeBreakout.push(candle(30, 97.8, 98.4, 97.5, 98.08, 0));

const wedgeChannelBoundary = boundedTrend(
  30,
  (index) => 111 - index * 0.45,
  (index) => 100 - index * 0.36
);
wedgeChannelBoundary.push(candle(30, 97.6, 99, 97.2, 98.7, 170));

const negativeFixtures = new Map([
  ["横ばい相場", flatMarket],
  ["ブレイク未確定", unconfirmedWedge],
  ["上ヒゲだけ上抜けて終値は内側", wickOnlyChannel],
  ["収束していない下降チャネル", nonParallelDescendingMove],
  ["急騰していない通常の押し目", ordinaryPullback],
  ["出来高なしの弱いブレイク", weakNoVolumeBreakout],
  ["下降ウェッジと下降チャネルの境界例", wedgeChannelBoundary],
]);

for (const [name, candles] of negativeFixtures) {
  const falsePositives = detectChartPatterns(candles).filter((pattern) =>
    part2Ids.has(pattern.id)
  );
  assert.deepEqual(falsePositives, [], `${name}: ${JSON.stringify(falsePositives)}`);
}

const engineSource = readFileSync(
  resolve(root, "app/lib/chartPatternEngine.ts"),
  "utf8"
);
const catalogSource = readFileSync(
  resolve(root, "app/lib/chartPatternCatalog.ts"),
  "utf8"
);
const prePart2Ids = [
  "pattern002", "pattern003", "pattern006", "pattern010", "pattern011",
  "pattern012", "pattern014", "pattern018", "pattern020", "pattern021",
  "pattern022", "pattern025", "pattern026", "pattern029", "pattern030",
  "pattern031", "pattern032", "pattern033", "pattern034", "pattern035",
  "pattern036", "pattern037", "pattern038", "pattern039", "pattern040",
  "pattern041", "pattern042", "pattern043", "pattern044", "pattern045",
  "pattern046", "pattern047",
];
const engineIds = [...engineSource.matchAll(/id:\s*"(pattern\d{3})"/g)].map(
  (match) => match[1]
);
const catalogIds = [...catalogSource.matchAll(/id:\s*"(pattern\d{3})",\s*name:/g)].map(
  (match) => match[1]
);
const engineIdSet = new Set(engineIds);
const catalogIdSet = new Set(catalogIds);
assert.equal(prePart2Ids.filter((id) => !engineIdSet.has(id)).length, 0);
assert.equal(prePart2Ids.filter((id) => !catalogIdSet.has(id)).length, 0);
assert.equal([...part2Ids].filter((id) => !engineIdSet.has(id)).length, 0);
assert.equal([...part2Ids].filter((id) => !catalogIdSet.has(id)).length, 0);
assert.equal(engineIdSet.size, 47);
assert.equal(catalogIdSet.size, 47);
assert.equal(catalogIds.length, 47);
assert.deepEqual([...engineIdSet].sort(), [...catalogIdSet].sort());

console.log(JSON.stringify({
  positiveFixtures: [...positiveFixtures.keys()],
  negativeFixtures: [...negativeFixtures.keys()],
  prePart2PatternIds: prePart2Ids.length,
  part2PatternIds: part2Ids.size,
  enginePatternCount: engineIdSet.size,
  catalogPatternCount: catalogIdSet.size,
  engineCatalogIntegrity: "PASS",
}, null, 2));
