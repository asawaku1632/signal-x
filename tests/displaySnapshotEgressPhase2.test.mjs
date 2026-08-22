import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(file, "utf8");

function finite(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function selectStocks(stocks, top, filter) {
  const filtered = filter === "market-hot"
    ? stocks.filter((stock) => finite(stock.score ?? stock.aiPower) >= 75)
    : filter === "market-watch"
      ? stocks.filter((stock) => {
          const score = finite(stock.score ?? stock.aiPower);
          return score >= 65 && score < 75;
        })
      : stocks;
  return top ? filtered.slice(0, top) : filtered;
}

const stocks = Array.from({ length: 1200 }, (_, index) => ({
  code: String(1000 + index),
  aiPower: 100 - index / 20,
  rawAiPower: 101 - index / 20,
  score: index % 4 === 0 ? 80 : 70,
  signal: index % 3 === 0 ? "BUY" : index % 3 === 1 ? "SELL" : "WAIT",
  takeProfit: 110 + index,
  stopLoss: 90 + index,
  experience: { rank: index % 10, bonus: index / 100 },
  patterns: [{ type: `pattern-${index % 5}` }],
  bollinger: { position: index / 1200 },
}));

const payload = {
  success: true,
  aiPowerVersion: "same-version",
  notificationSummary: { candidates: stocks.slice(0, 20) },
  stocks,
};

test("top=3 projection preserves the complete public stock objects and metadata", () => {
  const projected = { ...payload, stocks: payload.stocks.slice(0, 3) };
  const before = selectStocks(payload.stocks.slice(0, 1200), 3, null);
  const after = selectStocks(projected.stocks.slice(0, 1200), 3, null);

  assert.deepEqual(after, before);
  assert.deepEqual(projected.notificationSummary, payload.notificationSummary);
  for (const field of [
    "aiPower", "rawAiPower", "score", "signal", "takeProfit", "stopLoss",
    "experience", "patterns", "bollinger",
  ]) {
    assert.deepEqual(after.map((stock) => stock[field]), before.map((stock) => stock[field]));
  }
});

test("limit=100/1000/1200 projection is byte-for-byte data equivalent", () => {
  for (const limit of [100, 1000, 1200]) {
    const before = payload.stocks.slice(0, limit);
    const after = { ...payload, stocks: payload.stocks.slice(0, limit) }.stocks;
    assert.equal(JSON.stringify(after), JSON.stringify(before));
  }
});

test("filtering still sees the same limit-bounded population", () => {
  for (const filter of ["market-hot", "market-watch"]) {
    const before = selectStocks(payload.stocks.slice(0, 100), 20, filter);
    const projected = payload.stocks.slice(0, 100);
    const after = selectStocks(projected, 20, filter);
    assert.deepEqual(after, before);
  }
});

test("individual stock lookup preserves the first exact code match", () => {
  const code = "1542";
  const before = payload.stocks.find((stock) => String(stock.code) === code);
  const after = payload.stocks.filter((stock) => String(stock.code) === code)[0];
  assert.deepEqual(after, before);
});

test("route reuses stale blocking refresh output and preserves failure fallback", () => {
  const route = read("app/api/scan/route.ts");
  const snapshot = read("app/lib/scanSnapshot.ts");
  assert.match(route, /const refreshed = await refreshScanSnapshot/);
  assert.match(route, /snapshot = refreshed \?\? await getLatestScanSnapshot\(\)/);
  assert.match(route, /refreshScanSnapshot\(refreshLimit, snapshot\)/);
  assert.match(snapshot, /existingSnapshot !== undefined/);
  assert.match(snapshot, /return saveDisplaySnapshot\(key, payload, result\.limit\)/);
  assert.match(route, /if \(!snapshot\)/);
  assert.match(route, /status: "loading"/);
  assert.match(route, /insufficient_snapshot_coverage/);
});

test("partial reads preserve JSON order and full consumers remain full reads", () => {
  const display = read("app/lib/displaySnapshot.ts");
  const route = read("app/api/scan/route.ts");
  assert.match(display, /jsonb_agg\(stock\.value ORDER BY stock\.ordinality\)/);
  assert.match(display, /stock\.ordinality <= \$2/);
  assert.match(display, /WHEN jsonb_typeof\(payload->'stocks'\) = 'array'/);
  assert.match(display, /ELSE '\[\]'::jsonb/);
  assert.match(display, /Number\.isFinite\(stockLimit\)/);
  assert.match(route, /blockingConsumer\s*\?\s*null/);
  assert.match(route, /getLatestScanSnapshotSlice\(partialStockLimit\)/);
  assert.match(route, /Math\.min\(limit, snapshot\.payloadStockCount\)/);
});

test("null, missing, non-array, empty, and malformed stocks fail closed", () => {
  const display = read("app/lib/displaySnapshot.ts");
  const route = read("app/api/scan/route.ts");
  assert.match(display, /const fallbackStocks = fallback\?\.payload\?\.stocks/);
  assert.match(display, /Array\.isArray\(fallbackStocks\)/);
  assert.match(route, /!Array\.isArray\(snapshot\.payload\?\.stocks\)/);
  assert.match(route, /snapshot = null/);

  for (const malformed of [null, {}, { stocks: null }, { stocks: {} }, { stocks: [] }]) {
    const candidate = Array.isArray(malformed?.stocks) ? malformed.stocks : [];
    assert.deepEqual(candidate, []);
  }
});

test("save-daily, LINE/ranking, and BB observation inputs remain unchanged", () => {
  const saveDaily = read("app/api/learning/save-daily/route.ts");
  const line = read("app/api/cron/line/route.ts");
  const ranking = read("app/api/ranking/route.ts");
  const bb = read("app/api/cron/bb-observation/route.ts");
  assert.match(saveDaily, /api\/scan\?limit=1000/);
  assert.match(line, /api\/ranking/);
  assert.match(ranking, /api\/scan\?limit=1200/);
  assert.match(bb, /getLatestScanSnapshot/);
});
