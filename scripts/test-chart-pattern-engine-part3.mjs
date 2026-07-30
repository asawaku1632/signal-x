import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { detectChartPatterns } = await import(
  pathToFileURL(resolve(root, "app/lib/chartPatternEngine.ts")).href
);

const part3Ids = new Set([
  "pattern004",
  "pattern005",
  "pattern007",
  "pattern008",
  "pattern015",
]);

function candle(time, close, volume = 100, body = 0.3) {
  const open = close - body;
  return {
    time,
    open,
    high: Math.max(open, close) + 0.35,
    low: Math.min(open, close) - 0.35,
    close,
    volume,
  };
}

function fromCloses(closes, volumes = []) {
  return closes.map((close, index) =>
    candle(index, close, volumes[index] ?? 100)
  );
}

const squeezeCloses = Array.from({ length: 90 }, (_, index) => {
  if (index < 50) return 100 + Math.sin(index * 0.9) * 3;
  const progress = (index - 50) / 39;
  const amplitude = 2.2 - progress * 2;
  return 100 + Math.sin(index * 1.2) * amplitude;
});
const squeeze = fromCloses(squeezeCloses);

const expansionBase = Array.from({ length: 69 }, (_, index) => {
  if (index < 40) return 100 + Math.sin(index * 0.8) * 2.8;
  return 100 + Math.sin(index * 1.1) * 0.18;
});
const expansion = fromCloses([...expansionBase, 106], [
  ...Array(69).fill(100),
  140,
]);
expansion[69] = { ...expansion[69], open: 100, high: 106.4, low: 99.7 };

const perfectOrder = fromCloses(
  Array.from({ length: 90 }, (_, index) => 80 + index * 0.45)
);

const breakdownCloses = [
  ...Array.from({ length: 78 }, (_, index) => 80 + index * 0.32),
  101,
  96,
  91,
  86,
];
const perfectOrderBreakdown = fromCloses(breakdownCloses, [
  ...Array(81).fill(100),
  170,
]);

const reversalCloses = [
  ...Array.from({ length: 77 }, (_, index) => 120 - index * 0.28),
  101,
  105,
  109,
  113,
  117,
];
const earlyReversal = fromCloses(reversalCloses, [
  ...Array(81).fill(100),
  160,
]);

const positiveFixtures = new Map([
  ["pattern004", squeeze],
  ["pattern005", expansion],
  ["pattern007", perfectOrder],
  ["pattern008", perfectOrderBreakdown],
  ["pattern015", earlyReversal],
]);

const suppressions = new Map([
  ["pattern004", ["pattern045"]],
  ["pattern007", ["pattern046"]],
]);

for (const [id, candles] of positiveFixtures) {
  const detected = detectChartPatterns(candles);
  assert.ok(
    detected.some((pattern) => pattern.id === id),
    `${id} was not detected: ${JSON.stringify(detected)}`
  );
  for (const suppressedId of suppressions.get(id) ?? []) {
    assert.ok(
      !detected.some((pattern) => pattern.id === suppressedId),
      `${id} must suppress ${suppressedId}: ${JSON.stringify(detected)}`
    );
  }
}

const flatMarket = fromCloses(Array(70).fill(100));

const insufficientSqueeze = fromCloses(
  Array.from({ length: 70 }, (_, index) => 100 + Math.sin(index * 0.9) * 2)
);

const insufficientExpansion = fromCloses([
  ...expansionBase,
  100.35,
], [...Array(69).fill(100), 140]);

const noVolumeExpansion = fromCloses([
  ...expansionBase,
  106,
], Array(70).fill(100));
noVolumeExpansion[69] = {
  ...noVolumeExpansion[69],
  open: 100,
  high: 106.4,
  low: 99.7,
};

const orderedOnly = fromCloses([
  ...Array.from({ length: 70 }, (_, index) => 80 + index * 0.45),
  ...Array(20).fill(111),
]);

const fakeBreakout = fromCloses(
  Array.from({ length: 70 }, (_, index) => 100 + Math.sin(index * 0.9))
);
fakeBreakout[fakeBreakout.length - 1] = {
  ...fakeBreakout[fakeBreakout.length - 1],
  open: 100,
  high: 104,
  low: 99.7,
  close: 100.05,
  volume: 160,
};

const temporaryCrossCloses = [
  ...Array.from({ length: 81 }, (_, index) => 80 + index * 0.3),
  89,
];
const temporaryCross = fromCloses(temporaryCrossCloses, [
  ...Array(81).fill(100),
  170,
]);

const negativeFixtures = new Map([
  ["横ばい", flatMarket],
  ["BB収縮不足", insufficientSqueeze],
  ["BB拡大不足", insufficientExpansion],
  ["出来高不足", noVolumeExpansion],
  ["移動平均だけ並んでいるケース", orderedOnly],
  ["ダマシブレイク", fakeBreakout],
  ["一時的クロスのみ", temporaryCross],
]);

for (const [name, candles] of negativeFixtures) {
  const falsePositives = detectChartPatterns(candles).filter((pattern) =>
    part3Ids.has(pattern.id)
  );
  assert.deepEqual(falsePositives, [], `${name}: ${JSON.stringify(falsePositives)}`);
}

const strongExpansion = fromCloses([...expansionBase, 106], [
  ...Array(69).fill(100),
  220,
]);
strongExpansion[69] = {
  ...strongExpansion[69],
  open: 100,
  high: 106.4,
  low: 99.7,
};
const strongExpansionDetected = detectChartPatterns(strongExpansion);
assert.ok(strongExpansionDetected.some((pattern) => pattern.id === "pattern043"));
assert.ok(!strongExpansionDetected.some((pattern) => pattern.id === "pattern005"));

const engineSource = readFileSync(
  resolve(root, "app/lib/chartPatternEngine.ts"),
  "utf8"
);
const catalogSource = readFileSync(
  resolve(root, "app/lib/chartPatternCatalog.ts"),
  "utf8"
);
const prePart3Ids = [
  "pattern001", "pattern002", "pattern003", "pattern006", "pattern009",
  "pattern010", "pattern011", "pattern012", "pattern013", "pattern014",
  "pattern016", "pattern017", "pattern018", "pattern020", "pattern021",
  "pattern022", "pattern025", "pattern026", "pattern029", "pattern030",
  "pattern031", "pattern032", "pattern033", "pattern034", "pattern035",
  "pattern036", "pattern037", "pattern038", "pattern039", "pattern040",
  "pattern041", "pattern042", "pattern043", "pattern044", "pattern045",
  "pattern046", "pattern047",
];
assert.equal(
  prePart3Ids.filter((id) => !engineSource.includes(`id: "${id}"`)).length,
  0
);

const engineIds = [...engineSource.matchAll(/id:\s*"(pattern\d{3})"/g)].map(
  (match) => match[1]
);
const catalogIds = [
  ...catalogSource.matchAll(/id:\s*"(pattern\d{3})",\s*name:/g),
].map((match) => match[1]);
const engineIdSet = new Set(engineIds);
const catalogIdSet = new Set(catalogIds);
assert.equal(prePart3Ids.filter((id) => !engineIdSet.has(id)).length, 0);
assert.equal(prePart3Ids.filter((id) => !catalogIdSet.has(id)).length, 0);
assert.equal([...part3Ids].filter((id) => !engineIdSet.has(id)).length, 0);
assert.equal([...part3Ids].filter((id) => !catalogIdSet.has(id)).length, 0);
assert.equal(engineIdSet.size, 47);
assert.equal(catalogIdSet.size, 47);
assert.equal(catalogIds.length, 47);
assert.deepEqual([...engineIdSet].sort(), [...catalogIdSet].sort());

console.log(JSON.stringify({
  positiveFixtures: [...positiveFixtures.keys()],
  negativeFixtures: [...negativeFixtures.keys()],
  strongBreakoutPrecedence: "pattern043 > pattern005",
  prePart3PatternIds: prePart3Ids.length,
  part3PatternIds: part3Ids.size,
  enginePatternCount: engineIdSet.size,
  catalogPatternCount: catalogIdSet.size,
  engineCatalogIntegrity: "PASS",
}, null, 2));
