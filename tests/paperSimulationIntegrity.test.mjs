import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assessPaperMarketGate, assessPaperStockQuote, isMarketSessionPaperEntry } from "../app/lib/simulationIntegrity.ts";
import { getSwingDecision } from "../app/lib/swingDecision.ts";

const at = (s) => new Date(s);
const fresh = "2026-11-02T00:06:00Z";

test("2026-11-01 Sunday post-earnings quote cannot become a realizable 4613-yen fill", () => {
  const stamp = at("2026-11-01T12:40:13Z"); // 21:40 JST Sunday
  assert.equal(isMarketSessionPaperEntry(stamp.toISOString()), false);
  assert.equal(assessPaperMarketGate(stamp, stamp.toISOString()).reason, "MARKET_CLOSED");
});

test("JPX holiday and weekend are closed even if a new scan timestamp appears", () => {
  for (const stamp of ["2026-11-03T00:10:00Z", "2026-11-07T00:10:00Z"]) {
    assert.equal(assessPaperMarketGate(at(stamp), stamp).reason, "MARKET_CLOSED");
  }
});

test("Monday before 09:05 does not create a pretend 09:00 execution", () => {
  assert.equal(assessPaperMarketGate(at("2026-11-02T00:03:00Z"), "2026-11-02T00:02:00Z").reason, "WAIT_FIRST_FIVE_MINUTES");
});

test("fresh same-session data after 09:05 is reference-only eligible", () => {
  assert.equal(assessPaperMarketGate(at("2026-11-02T00:07:00Z"), fresh).ok, true);
  assert.equal(isMarketSessionPaperEntry("2026-11-02T00:10:00Z"), true);
});

test("missing, stale, future and previous-day scans fail closed", () => {
  assert.equal(assessPaperMarketGate(at("2026-11-02T00:09:00Z"), fresh).reason, "SCAN_MISSING_OR_STALE");
  assert.equal(assessPaperMarketGate(at("2026-11-02T00:07:00Z"), null).reason, "SCAN_MISSING_OR_STALE");
  assert.equal(assessPaperMarketGate(at("2026-11-02T00:07:00Z"), "2026-11-02T00:08:00Z").reason, "SCAN_MISSING_OR_STALE");
  assert.equal(assessPaperMarketGate(at("2026-11-02T00:07:00Z"), "2026-10-30T06:25:00Z").reason, "SCAN_MISSING_OR_STALE");
});

test("lunch break and 15:25 auction boundary do not allow reference fills", () => {
  assert.equal(assessPaperMarketGate(at("2026-11-02T02:40:00Z"), "2026-11-02T02:39:00Z").reason, "MARKET_CLOSED");
  assert.equal(assessPaperMarketGate(at("2026-11-02T06:26:00Z"), "2026-11-02T06:25:00Z").reason, "CLOSING_AUCTION");
});

test("stale scan and 7.28% hypothetical gain do not issue EXIT based on old AI=0", () => {
  const input = { currentPrice: 4949, entryPrice: 4613, aiPower: 0, changePercent: -1.28 };
  const unverified = getSwingDecision({ ...input, marketDataFresh: false });
  assert.equal(unverified.status, "DATA_WAIT");
  assert.equal(unverified.pnlPercent !== null && unverified.pnlPercent > 7, true);
  assert.equal(getSwingDecision({ ...input, marketDataFresh: true }).status, "EXIT");
  assert.equal(getSwingDecision({ ...input, aiPower: null, marketDataFresh: true }).status, "TAKE_PROFIT_WATCH");
});


test("a new snapshot with old underlying price is NOT a valid paper fill", () => {
  const now = at("2026-11-02T00:20:00Z");
  const saved = "2026-11-02T00:19:00Z";
  const intraday = (bar, source = "intraday") => ({
    code: "5333", price: 4949, dataSource: source, latestBarTimestamp: Date.parse(bar)/1000,
  });
  assert.equal(assessPaperStockQuote(now, saved, intraday("2026-10-30T06:25:00Z")).reason, "SOURCE_BAR_UNVERIFIED");
  assert.equal(assessPaperStockQuote(now, saved, intraday("2026-11-02T00:10:00Z", "daily_fallback")).reason, "SOURCE_BAR_UNVERIFIED");
  assert.equal(assessPaperStockQuote(now, saved, intraday("2026-11-02T00:10:00Z")).ok, true);
  assert.equal(assessPaperStockQuote(now, saved, intraday("2026-11-02T00:10:00Z", "intraday")).ok, true);
  assert.equal(assessPaperStockQuote(now, saved, {price:4949, dataSource:"intraday"}).reason, "SOURCE_BAR_UNVERIFIED");
  assert.equal(assessPaperStockQuote(now, saved, intraday("2026-11-02T00:30:00Z")).reason, "SOURCE_BAR_UNVERIFIED");
  assert.equal(assessPaperStockQuote(now, saved, intraday("2026-11-01T23:50:00Z")).reason, "SOURCE_BAR_UNVERIFIED");
});

test("UI does not reuse purchase-time score or quietly hide off-session fills", () => {
  const ui = readFileSync("app/simulation/page.tsx", "utf8");
  assert.doesNotMatch(ui, /aiPower:s\?\.score\?\?s\?\.aiPower\?\?t\.aiScore/);
  assert.match(ui, /isMarketSessionPaperEntry\(selected\.startedAt\)/);
  assert.match(ui, /marketDataFresh:!!s&&assessPaperStockQuote/);
  assert.match(ui, /setScanUpdatedAt/);
});

test("server rejects stale and off-session paper buys AND sells", () => {
  const api = readFileSync("app/api/paper-trades/route.ts", "utf8");
  assert.match(api, /assessPaperStockQuote\(new Date\(\),snapshot\?\.updatedAt\?\?null,stock\)/);
  assert.match(api, /verifiedSimulatedQuote\(code,entryPrice\)/);
  assert.match(api, /verifiedSimulatedQuote\(opened\.code,exitPrice\)/);
});
