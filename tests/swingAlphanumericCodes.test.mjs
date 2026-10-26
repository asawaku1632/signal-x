import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isSwingResearchStockCode } from "../app/lib/learning/swingStockCode.ts";

const read = (path) => readFileSync(path, "utf8");
const capture = read("app/lib/learning/swingUniverseAudit.ts");
const reportRoute = read("app/api/swing-universe-audit/route.ts");
const stocks = read("app/lib/stockList.ts");

test("research validator accepts numeric and 2026-10-26 alphanumeric codes", () => {
  for (const code of ["1301", "9984", "590A", "641A", "642A"]) {
    assert.equal(isSwingResearchStockCode(code), true, code);
  }
});

test("research validator rejects malformed codes", () => {
  for (const code of ["59A0", "A590", "590a", "12345", "12A", "", "590A "]) {
    assert.equal(isSwingResearchStockCode(code), false, code);
  }
});

test("capture and private report API use the same research-only validator", () => {
  assert.match(capture, /!isSwingResearchStockCode\(row\.code\)/);
  assert.match(reportRoute, /code && !isSwingResearchStockCode\(code\)/);
  assert.match(capture, /ON CONFLICT \(trade_date, code\) DO NOTHING/);
});

test("590A is registered in the stock universe", () => {
  assert.match(stocks, /successorCode: "590A"/);
});
