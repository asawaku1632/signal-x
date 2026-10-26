import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("../../lib/research/realTradeCalculations.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports });
const { calculateClosedTrade, compareWithClose } = exports;

test("2026-10-26 3762 actual trade", () => {
  const trade = { quantity: 100, buyPrice: 3540, sellPrice: 3642 };
  const result = calculateClosedTrade(trade);
  assert.equal(result.purchaseValue, 354000);
  assert.equal(result.saleValue, 364200);
  assert.equal(result.grossProfit, 10200);
  assert.ok(Math.abs(result.grossReturnPercent - 2.8813559322) < 0.00001);
  assert.equal(compareWithClose(trade, 3655).differenceFromActualGrossProfit, 1300);
});

test("fees and explicit taxes reduce net only", () => {
  const result = calculateClosedTrade({ quantity: 100, buyPrice: 3540, sellPrice: 3642, buyFees: 100, sellFees: 100, taxes: 2000 });
  assert.equal(result.grossProfit, 10200);
  assert.equal(result.netProfit, 8000);
});

test("missing verified close remains unavailable", () => {
  assert.equal(compareWithClose({ quantity: 100, buyPrice: 3540, sellPrice: 3642 }, null), null);
});

test("invalid prices and quantities fail closed", () => {
  assert.throws(() => calculateClosedTrade({ quantity: 0, buyPrice: 3540, sellPrice: 3642 }));
  assert.throws(() => calculateClosedTrade({ quantity: 100, buyPrice: -1, sellPrice: 3642 }));
  assert.throws(() => calculateClosedTrade({ quantity: 100, buyPrice: 3540, sellPrice: Number.NaN }));
});
