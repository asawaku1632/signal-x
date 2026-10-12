import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { STOCKS } from "../app/lib/stockList.ts";
import {
  SUPPORT_REBOUND_20, SUPPORT_REBOUND_100, SUPPORT_REBOUND_RESEARCH_BASKET,
} from "../app/lib/research/supportReboundUniverse.ts";

test("100-stock basket has 100 unique Japanese stock codes from existing active SIGNALX list", () => {
  const codes = SUPPORT_REBOUND_RESEARCH_BASKET;
  assert.equal(codes.length, 100);
  assert.equal(new Set(codes).size, 100);
  const byCode = new Map(STOCKS.map((stock) => [stock.code, stock]));
  for (const code of codes) {
    assert.match(code, /^[0-9]{4}$/);
    const stock = byCode.get(code);
    assert.ok(stock, code + " must exist in stock list");
    assert.ok(!stock.status || stock.status === "ACTIVE", code + " must not be known inactive");
  }
});
test("20-stock preview is a subset with broad code spread, not the old four-only basket", () => {
  assert.equal(SUPPORT_REBOUND_20.length, 20);
  const codes = new Set(SUPPORT_REBOUND_100.map((s) => s.code));
  for (const item of SUPPORT_REBOUND_20) assert.ok(codes.has(item.code));
  assert.ok(new Set(SUPPORT_REBOUND_20.map((s) => s.code[0])).size >= 5);
});
test("expansion does not create a cron, trade, persistence, or wider privileged API", () => {
  const root = new URL("../", import.meta.url);
  const page = readFileSync(new URL("app/admin/support-rebound/page.tsx", root), "utf8");
  const ui = readFileSync(new URL("app/admin/support-rebound/SupportReboundClient.tsx", root), "utf8");
  assert.match(page, /getAdminSession\(\)/);
  assert.match(ui, /\/api\/admin\/ema-signals/);
  assert.match(ui, /controllerRef\.current\?\.abort\(\)/);
  assert.match(ui, /i \+= 2/);
  assert.match(ui, /setCompleted\(results\.length\)/);
  assert.match(ui, /TEST_CUTOFF/);
  assert.doesNotMatch(ui, /\/api\/cron|INSERT INTO|UPDATE public|\/api\/simulation\/buy/);
});
