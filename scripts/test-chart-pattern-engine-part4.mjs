import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { detectChartPatterns } = await import(
  pathToFileURL(resolve(root, "app/lib/chartPatternEngine.ts")).href
);

const part4Ids = new Set([
  "pattern019",
  "pattern023",
  "pattern024",
  "pattern027",
  "pattern028",
]);

function candle(time, open, high, low, close, volume = 100) {
  return { time, open, high, low, close, volume };
}

function simpleCandle(time, close, volume = 100) {
  return candle(time, close - 0.25, close + 0.4, close - 0.4, close, volume);
}

function ema(values, period) {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let result = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let index = period; index < values.length; index++) {
    result = (values[index] - result) * multiplier + result;
  }
  return result;
}

const boxBreakout = Array.from({ length: 20 }, (_, index) => {
  const close = index % 2 === 0 ? 103.8 : 96.2;
  return candle(index, close, 105, 95, close, 100);
});
boxBreakout.push(candle(20, 104.2, 106.5, 104, 106, 150));

const convergenceBounce = Array.from({ length: 77 }, (_, index) =>
  simpleCandle(index, 100 + Math.sin(index * 0.6) * 0.12)
);
convergenceBounce.push(
  simpleCandle(77, 100.2),
  simpleCandle(78, 101),
  candle(79, 101.1, 103.4, 100.9, 103, 150)
);

const longTermBase = Array.from({ length: 78 }, (_, index) =>
  simpleCandle(index, 80 + index * 0.2)
);
const baseCloses = longTermBase.map((item) => item.close);
const touchAverage = ema(baseCloses, 75);
assert.notEqual(touchAverage, null);
const touchClose = touchAverage * 1.003;
const touch = candle(78, touchClose + 0.15, touchClose + 0.45, touchAverage * 0.999, touchClose, 95);
const currentAverage = ema([...baseCloses, touchClose], 75);
assert.notEqual(currentAverage, null);
const bounceClose = Math.max(touch.high * 1.01, currentAverage * 1.01);
const longTermBounce = [
  ...longTermBase,
  touch,
  candle(79, bounceClose - 0.8, bounceClose + 0.35, bounceClose - 1, bounceClose, 150),
];

const day = 24 * 60 * 60;
const dailyGap = Array.from({ length: 24 }, (_, index) =>
  candle(index * day, 99.8, 100.5, 99.2, 100, 100)
);
dailyGap.push(candle(24 * day, 102, 104, 101.7, 103.2, 145));

const hour = 60 * 60;
const intradayHistory = Array.from({ length: 20 }, (_, index) =>
  candle(index * hour, 99.8, 100.4, 99.5, 100, 100)
);
const sessionStart = intradayHistory[intradayHistory.length - 1].time + 8 * hour;
const openingSurge = [
  ...intradayHistory,
  candle(sessionStart, 100, 101.4, 99.8, 101, 160),
  candle(sessionStart + hour, 101, 102.7, 100.8, 102.3, 165),
  candle(sessionStart + 2 * hour, 102.2, 104, 102, 103.6, 170),
];

const positiveFixtures = new Map([
  ["pattern019", boxBreakout],
  ["pattern023", convergenceBounce],
  ["pattern024", longTermBounce],
  ["pattern027", dailyGap],
  ["pattern028", openingSurge],
]);

const suppressions = new Map([
  ["pattern019", ["pattern003", "pattern018", "pattern037"]],
  ["pattern023", ["pattern014"]],
  ["pattern024", ["pattern006"]],
  ["pattern028", ["pattern027", "pattern018"]],
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

const flatMarket = Array.from({ length: 80 }, (_, index) =>
  simpleCandle(index * day, 100)
);

const fakeBox = boxBreakout.slice(0, -1);
fakeBox.push(candle(20, 104, 106.5, 103.8, 104.8, 150));

const unconfirmedBox = boxBreakout.slice(0, -1);
unconfirmedBox.push(candle(20, 104.5, 105.6, 104, 105.2, 150));

const noVolumeBox = boxBreakout.slice(0, -1);
noVolumeBox.push(candle(20, 104.2, 106.5, 104, 106, 100));

const existingBox = Array.from({ length: 30 }, (_, index) => {
  const close = index % 2 === 0 ? 103.8 : 96.2;
  return candle(index, close, 105, 95, close, 100);
});
existingBox.push(candle(30, 104.2, 106.5, 104, 106, 100));
assert.ok(detectChartPatterns(existingBox).some((pattern) => pattern.id === "pattern037"));

const temporaryCross = Array.from({ length: 82 }, (_, index) =>
  simpleCandle(index, index < 81 ? 80 + index * 0.25 : 88, index === 81 ? 170 : 100)
);

const weakOpeningSurge = [
  ...intradayHistory,
  candle(sessionStart, 100, 100.9, 99.8, 100.6, 160),
  candle(sessionStart + hour, 100.6, 101.5, 100.4, 101.2, 165),
  candle(sessionStart + 2 * hour, 101.2, 102.2, 101, 102, 170),
];

const weakOpeningDrop = [
  ...intradayHistory,
  candle(sessionStart, 100, 100.2, 99.3, 99.5, 160),
  candle(sessionStart + hour, 99.5, 99.8, 99, 99.2, 165),
  candle(sessionStart + 2 * hour, 99.2, 99.5, 98.7, 99, 170),
];

const negativeFixtures = new Map([
  ["横ばい", flatMarket],
  ["ダマシ", fakeBox],
  ["ブレイク未確定", unconfirmedBox],
  ["出来高不足", noVolumeBox],
  ["似ている既存パターン", existingBox],
  ["一時的クロス", temporaryCross],
  ["急騰不足", weakOpeningSurge],
  ["急落不足", weakOpeningDrop],
]);

for (const [name, candles] of negativeFixtures) {
  const falsePositives = detectChartPatterns(candles).filter((pattern) =>
    part4Ids.has(pattern.id)
  );
  assert.deepEqual(falsePositives, [], `${name}: ${JSON.stringify(falsePositives)}`);
}

const engineSource = readFileSync(resolve(root, "app/lib/chartPatternEngine.ts"), "utf8");
const catalogSource = readFileSync(resolve(root, "app/lib/chartPatternCatalog.ts"), "utf8");
const previousIds = [
  "pattern001", "pattern002", "pattern003", "pattern004", "pattern005",
  "pattern006", "pattern007", "pattern008", "pattern009", "pattern010",
  "pattern011", "pattern012", "pattern013", "pattern014", "pattern015",
  "pattern016", "pattern017", "pattern018", "pattern020", "pattern021",
  "pattern022", "pattern025", "pattern026", "pattern029", "pattern030",
  "pattern031", "pattern032", "pattern033", "pattern034", "pattern035",
  "pattern036", "pattern037", "pattern038", "pattern039", "pattern040",
  "pattern041", "pattern042", "pattern043", "pattern044", "pattern045",
  "pattern046", "pattern047",
];
assert.equal(previousIds.filter((id) => !engineSource.includes(`id: "${id}"`)).length, 0);

const engineIds = [...engineSource.matchAll(/id:\s*"(pattern\d{3})"/g)].map((match) => match[1]);
const catalogIds = [...catalogSource.matchAll(/id:\s*"(pattern\d{3})",\s*name:/g)].map((match) => match[1]);
assert.equal(new Set(engineIds).size, 47);
assert.equal(new Set(catalogIds).size, 47);
assert.equal(catalogIds.length, 47);

console.log(JSON.stringify({
  positiveFixtures: [...positiveFixtures.keys()],
  negativeFixtures: [...negativeFixtures.keys()],
  previousPatternIds: previousIds.length,
  enginePatternCount: new Set(engineIds).size,
  catalogPatternCount: new Set(catalogIds).size,
}, null, 2));
