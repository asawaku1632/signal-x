import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { detectChartPatterns } = await import(
  pathToFileURL(resolve(root, "app/lib/chartPatternEngine.ts")).href
);

const part1Definitions = new Map([
  ["pattern010", "上ヒゲ失速"],
  ["pattern011", "高値切り下げ下落"],
  ["pattern012", "急騰後失速"],
  ["pattern025", "初動陽線"],
  ["pattern026", "出来高先行急騰"],
]);

function candle(time, open, high, low, close, volume = 100) {
  return { time, open, high, low, close, volume };
}

const upperWickStall = [
  candle(0, 100, 101, 99, 100),
  candle(1, 100, 102, 99.5, 101),
  candle(2, 101, 103, 100.5, 102),
  candle(3, 102, 104, 101.5, 103),
  candle(4, 103, 105, 102.5, 104),
  candle(5, 104, 106, 103.5, 105),
  candle(6, 105, 110, 103.8, 104.2, 180),
];

const lowerHighDecline = Array.from({ length: 12 }, (_, index) => {
  const center = 112 - index * 1.05;
  const close = index === 11 ? 98.2 : center - 0.3;
  return candle(index, center + 0.2, center + 1, close - 0.6, close, index === 11 ? 170 : 100);
});

const surgeStall = [
  candle(0, 100, 101, 99, 100),
  candle(1, 100, 101, 99.5, 100.2),
  candle(2, 100.2, 101, 99.8, 100.3),
  candle(3, 100.3, 101, 100, 100.4),
  candle(4, 100.4, 104, 100, 103.5),
  candle(5, 103.5, 108, 103, 107),
  candle(6, 107, 112, 106.5, 111),
  candle(7, 111, 113, 109, 112),
  candle(8, 112, 112.5, 109, 110),
  candle(9, 110, 111, 108, 109),
  candle(10, 109, 110, 107, 108),
  candle(11, 108, 109, 105, 106, 180),
];

const initialBullishCandle = [
  candle(0, 102, 102.5, 101, 101.5),
  candle(1, 101.5, 102, 100.8, 101.2),
  candle(2, 101.2, 101.8, 100.5, 101),
  candle(3, 101, 101.5, 100.3, 100.8),
  candle(4, 100.8, 101.4, 100.2, 100.7),
  candle(5, 100.7, 101.3, 100.1, 100.6),
  candle(6, 100.6, 101.2, 100, 100.5),
  candle(7, 100.5, 101.1, 99.9, 100.4),
  candle(8, 100.3, 104, 100.1, 103.5, 190),
];

const volumeLedSurge = [
  ...Array.from({ length: 10 }, (_, index) => {
    const close = index % 2 === 0 ? 100 : 100.15;
    return candle(index, 100, 100.5, 99.6, close, 100);
  }),
  candle(10, 100.1, 100.7, 99.8, 100.3, 220),
  candle(11, 100.3, 102.2, 100.2, 101.8, 150),
];

const positiveFixtures = new Map([
  ["pattern010", upperWickStall],
  ["pattern011", lowerHighDecline],
  ["pattern012", surgeStall],
  ["pattern025", initialBullishCandle],
  ["pattern026", volumeLedSurge],
]);

for (const [id, candles] of positiveFixtures) {
  const detected = detectChartPatterns(candles);
  assert.ok(
    detected.some((pattern) => pattern.id === id && pattern.name === part1Definitions.get(id)),
    `${id} was not detected with its current name: ${JSON.stringify(detected)}`
  );
}

const negativeFixtures = new Map([
  ["pattern010: 上昇不足", [
    ...Array.from({ length: 6 }, (_, index) => candle(index, 100, 101, 99.5, 100)),
    candle(6, 100, 105, 99.5, 100, 180),
  ]],
  ["pattern011: 安値ブレイク未確定", lowerHighDecline.map((item, index) =>
    index === 11 ? candle(11, 101, 102, 100, 101.2, 170) : item
  )],
  ["pattern012: 急騰不足", surgeStall.map((item, index) => {
    const close = 100 + (item.close - 100) * 0.45;
    return candle(index, close + 0.1, close + 0.5, close - 0.5, close, item.volume);
  })],
  ["pattern025: 高値ブレイク不足", initialBullishCandle.map((item, index) =>
    index === 8 ? candle(8, 100.3, 101.2, 100.1, 100.9, 190) : item
  )],
  ["pattern026: 先行出来高不足", volumeLedSurge.map((item, index) =>
    index === 10 ? { ...item, volume: 100 } : item
  )],
]);

for (const [label, candles] of negativeFixtures) {
  const id = label.slice(0, 10);
  const detected = detectChartPatterns(candles);
  assert.ok(
    !detected.some((pattern) => pattern.id === id),
    `${label}: ${JSON.stringify(detected)}`
  );
}

const engineSource = readFileSync(resolve(root, "app/lib/chartPatternEngine.ts"), "utf8");
const catalogSource = readFileSync(resolve(root, "app/lib/chartPatternCatalog.ts"), "utf8");
const engineMap = new Map();
for (const match of engineSource.matchAll(/pushPattern\(patterns,\s*\{([\s\S]*?)\n\s*\}\);/g)) {
  const block = match[1];
  const id = block.match(/id:\s*"(pattern\d{3})"/)?.[1];
  const nameExpression = block.match(
    /name:\s*([\s\S]*?),\s*\n\s*direction(?:\s*:|\s*,)/
  )?.[1];
  if (!id || !nameExpression) continue;
  const names = [...nameExpression.matchAll(/"([^"]+)"/g)]
    .map((item) => item[1])
    .filter((name) => !["BUY", "SELL", "NEUTRAL"].includes(name));
  engineMap.set(id, [...new Set(names)]);
}
const catalogEntries = [...catalogSource.matchAll(
  /id:\s*"(pattern\d{3})",\s*name:\s*"([^"]+)",\s*engineNames:\s*\[([^\]]+)\]/g
)];
const catalogMap = new Map(catalogEntries.map((match) => [
  match[1],
  {
    name: match[2],
    engineNames: [...match[3].matchAll(/"([^"]+)"/g)].map((item) => item[1]),
  },
]));

assert.equal(engineMap.size, 47, "Engine must contain exactly 47 pattern definitions");
assert.equal(catalogEntries.length, 47, "Catalog must contain exactly 47 pattern definitions");
assert.equal(catalogMap.size, 47, "Catalog pattern IDs must be unique");
assert.deepEqual([...engineMap.keys()].sort(), [...catalogMap.keys()].sort());

for (const [id, expectedName] of part1Definitions) {
  assert.ok(engineMap.get(id)?.includes(expectedName), `${id} is missing or renamed in Engine`);
  assert.equal(catalogMap.get(id)?.name, expectedName, `${id} is missing or renamed in Catalog`);
}
for (const [id, engineNames] of engineMap) {
  assert.deepEqual(
    [...(catalogMap.get(id)?.engineNames ?? [])].sort(),
    [...engineNames].sort(),
    `${id} name mismatch`
  );
}

console.log(JSON.stringify({
  positiveFixtures: [...positiveFixtures.keys()],
  negativeFixtures: [...negativeFixtures.keys()],
  part1PatternIds: part1Definitions.size,
  enginePatternCount: engineMap.size,
  catalogPatternCount: catalogMap.size,
  engineCatalogIntegrity: "PASS",
}, null, 2));
