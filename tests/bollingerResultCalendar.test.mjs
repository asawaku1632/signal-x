import assert from "node:assert/strict";
import test from "node:test";
import {
  futureCandlesFromDataset,
  inspectBollingerResultCalendar,
  resolveBollingerResultCalendar,
  runBollingerResultBatch,
} from "../app/lib/technicalObservation/bollingerObservationResultRunner.ts";
import { resolveTseTradingDatesAfter } from "../app/lib/technicalObservation/tseMarketCalendar.ts";

const time = (date) => Date.parse(`${date}T00:00:00Z`) / 1_000;
const candle = (date, close = 100) => ({ time: time(date), open: close, high: close + 2,
  low: close - 2, close, volume: 1_000 });
const event = (observationDate = "2026-08-28") => ({ eventId: 35, code: "7203", timeframe: "1D",
  side: "LOWER", sigmaLevel: 2, eventType: "TOUCH", close: 100, observationDate,
  barEndAt: `${observationDate}T06:30:00Z` });
const dataset = (dates) => ({ timeframe: "1D", source: "YAHOO_CHART", range: "2y", interval: "1d",
  firstBarAt: new Date(time(dates[0]) * 1_000).toISOString(),
  lastBarAt: new Date(time(dates.at(-1)) * 1_000).toISOString(), candleCount: dates.length,
  status: "COMPLETE", complete: true, candles: dates.map((date, index) => candle(date, 100 + index)) });
const fullDates = ["2026-08-28", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"];
const batch = (value) => ({ concurrency: 1, requested: 1, unique: 1,
  settled: [{ status: "fulfilled", value: { code: "7203", dataset: value } }] });
const database = { async query() { return { rows: [] }; } };

test("2026-08-28 resolves fixed h1, h3, and h5 TSE dates", () => {
  const result = resolveBollingerResultCalendar("2026-08-28");
  assert.equal(result.h1TargetTradeDate, "2026-08-31");
  assert.equal(result.h3TargetTradeDate, "2026-09-02");
  assert.equal(result.h5TargetTradeDate, "2026-09-04");
});

test("calendar skips weekends, a TSE holiday, and consecutive closures", () => {
  assert.equal(resolveTseTradingDatesAfter("2026-08-28", 1)[0], "2026-08-31");
  assert.equal(resolveTseTradingDatesAfter("2026-08-10", 1)[0], "2026-08-12");
  assert.equal(resolveTseTradingDatesAfter("2026-09-18", 1)[0], "2026-09-24");
});

test("calendar handles year-end closure and fails closed at coverage boundaries", () => {
  assert.equal(resolveTseTradingDatesAfter("2026-12-30", 1)[0], "2027-01-04");
  assert.equal(resolveTseTradingDatesAfter("2026-01-05", 1)[0], "2026-01-06");
  assert.throws(() => resolveTseTradingDatesAfter("2027-12-30", 1), /MARKET_CALENDAR_UNAVAILABLE/);
  assert.throws(() => resolveTseTradingDatesAfter("2025-12-30", 1), /MARKET_CALENDAR_UNAVAILABLE/);
});

test("target candle is NOT_READY before 15:40 and usable at 15:40 JST", () => {
  const source = dataset(["2026-08-28", "2026-08-31"]);
  assert.deepEqual(futureCandlesFromDataset(source, event(), new Date("2026-08-31T06:39:59Z")), []);
  assert.deepEqual(futureCandlesFromDataset(source, event(), new Date("2026-08-31T06:40:00Z"))
    .map((item) => item.tradeDate), ["2026-08-31"]);
});

test("missing target candle remains unavailable and cannot shift a later candle into h1", () => {
  const source = dataset(["2026-08-28", "2026-09-01"]);
  const now = new Date("2026-09-01T06:40:00Z");
  const future = futureCandlesFromDataset(source, event(), now);
  assert.deepEqual(future, []);
  assert.equal(inspectBollingerResultCalendar("2026-08-28", future, now).horizons[0].failureKind,
    "TARGET_CANDLE_MISSING");
});

test("provider candle on a non-calendar date fails closed", () => {
  const source = dataset(["2026-08-28", "2026-08-29", "2026-08-31"]);
  assert.throws(() => futureCandlesFromDataset(source, event(), new Date("2026-08-31T06:40:00Z")),
    /RESULT_PROVIDER_CALENDAR_MISMATCH/);
});

test("PREVIEW produces calendar-matched results and never persists", async () => {
  let writes = 0;
  const result = await runBollingerResultBatch({ limit: 1, mode: "PREVIEW",
    now: new Date("2026-09-04T06:40:00Z"), database, selectEvents: async () => [event()],
    fetchBatch: async () => batch(dataset(fullDates)),
    persist: async () => { writes += 1; return { created: 0, existing: 0 }; } });
  assert.equal(result.candidateResults, 3);
  assert.equal(writes, 0);
  assert.deepEqual(result.outcomes[0].completedHorizons, [1, 3, 5]);
  assert.equal(result.resultCalendarDiagnostics[0].horizons.every((item) => item.ready), true);
});
