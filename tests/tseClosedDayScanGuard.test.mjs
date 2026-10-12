import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  marketScanGuard,
  quoteDateJst,
} from "../app/lib/marketScanGuard.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("2026-10-12 sports day must not run full-market scan even during cash hours", () => {
  for (const iso of ["2026-10-11T15:00:00Z", "2026-10-12T02:00:00Z", "2026-10-12T06:30:00Z", "2026-10-12T14:59:00Z"]) {
    const result = marketScanGuard(new Date(iso));
    assert.equal(result.refreshAllowed, false, iso);
    assert.equal(result.closed, true, iso);
    assert.equal(result.dateJst, "2026-10-12");
  }
});

test("2026-10-13 next trading day is allowed before, during and after trading", () => {
  for (const iso of ["2026-10-12T15:00:00Z", "2026-10-12T23:00:00Z", "2026-10-13T00:00:00Z", "2026-10-13T07:00:00Z"]) {
    const result = marketScanGuard(new Date(iso));
    assert.equal(result.refreshAllowed, true, iso);
    assert.equal(result.closed, false, iso);
    assert.equal(result.dateJst, "2026-10-13");
  }
});

test("weekend closed; normal Friday after close remains allowed", () => {
  assert.equal(marketScanGuard(new Date("2026-10-10T02:00:00Z")).refreshAllowed, false);
  assert.equal(marketScanGuard(new Date("2026-10-11T02:00:00Z")).refreshAllowed, false);
  assert.equal(marketScanGuard(new Date("2026-10-09T07:00:00Z")).refreshAllowed, true);
});

test("outside the JPX calendar range retains prior refresh behavior but marks unknown", () => {
  const guard = marketScanGuard(new Date("2028-01-01T02:00:00Z"));
  assert.equal(guard.refreshAllowed, true);
  assert.equal(guard.closed, false);
  assert.equal(guard.calendarKnown, false);
});

test("stock quote timestamp is a separate JST date, not the scan saved time", () => {
  const fridayClose = Date.parse("2026-10-09T15:30:00+09:00") / 1000;
  assert.equal(quoteDateJst(fridayClose), "2026-10-09");
  assert.equal(quoteDateJst(String(fridayClose)), "2026-10-09");
  assert.equal(quoteDateJst(null), null);
  assert.equal(quoteDateJst(""), null);
  assert.equal(quoteDateJst("bogus"), null);
});

test("all full snapshot refresh callers share the holiday guard before Yahoo runScan", () => {
  const source = read("app/lib/scanSnapshot.ts");
  const guardIndex = source.indexOf("const market = marketScanGuard()");
  const lockIndex = source.indexOf("return runSnapshotRefresh(", guardIndex);
  assert.ok(guardIndex > 0 && lockIndex > guardIndex);
  assert.match(source, /if \(!market\.refreshAllowed\) \{[\s\S]*?return existingSnapshot \?\? getDisplaySnapshot<StoredScanPayload>\(key\)/);
  assert.match(source, /const result = await runScan\(limit\)/);
  assert.doesNotMatch(source.slice(guardIndex, lockIndex), /saveDisplaySnapshot\s*\(/);
});

test("existing scan endpoints retain original market-day triggers but report source quote dates", () => {
  const api = read("app/api/scan/route.ts");
  const ranking = read("app/api/ranking/route.ts");
  assert.match(api, /refreshScanSnapshot\(/);
  assert.match(api, /marketClosed: market\.closed/);
  assert.match(api, /quoteDateBounds\(sourceStocks\)/);
  assert.match(api, /latestQuoteDateJst/);
  assert.match(ranking, /refreshScanSnapshot\(FULL_SCAN_LIMIT\)/);
  const shapeServer = read("app/chart-shape-search/page.tsx");
  assert.match(shapeServer, /entry\.stock->'latestBarTimestamp'/);
  assert.match(shapeServer, /marketClosed=\{market\.closed\}/);
  const mobile = read("app/scan-mobile/page.tsx");
  assert.match(mobile, /setLastUpdated\(savedAt &&/);
  assert.match(mobile, /前営業日の保存データを表示中/);
  const desktop = read("app/scan/page.tsx");
  assert.match(desktop, /株価データの最終日/);
});

test("market-closed guard does not alter daily save and LINE notification execution", () => {
  const snapshot = read("app/lib/scanSnapshot.ts");
  assert.doesNotMatch(snapshot, /saveDailyStocks|sendLine|refreshPatternForwardStats/);
  const scanApi = read("app/api/scan/route.ts");
  assert.doesNotMatch(scanApi, /sendLine|saveDailyStocks/);
  const lite = read("app/api/learning/save-daily-lite/route.ts");
  assert.ok(lite.indexOf("const market = marketScanGuard()") < lite.indexOf("await runScan(1000)"));
  assert.match(lite, /if \(!market\.refreshAllowed\) \{/);
  assert.match(lite, /reason: "TSE_MARKET_CLOSED"/);
});
