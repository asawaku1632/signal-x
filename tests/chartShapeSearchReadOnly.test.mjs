import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "app/chart-shape-search/page.tsx"), "utf8");
const ui = readFileSync(join(root, "app/components/patterns/ChartShapeSearchExplorer.tsx"), "utf8");
const menu = readFileSync(join(root, "app/menu/page.tsx"), "utf8");
const catalog = readFileSync(join(root, "app/learning/patterns/page.tsx"), "utf8");

test("chart shape search reads the existing snapshot without scans or writes", () => {
  assert.match(page, /FROM display_snapshots/);
  assert.match(page, /WHERE snapshot_key = \$1/);
  assert.match(page, /jsonb_build_object\(/);
  assert.doesNotMatch(page, /\b(?:refreshScanSnapshot|runScan|runSingleStockScan|saveDisplaySnapshot)\s*\(/);
  assert.doesNotMatch(page, /\b(?:INSERT\s+INTO|UPDATE\s+display_snapshots|DELETE\s+FROM)\b/i);
});

test("shape search includes all stored observations, not just the top three", () => {
  assert.match(page, /patternObservations/);
  assert.match(page, /detectedPatterns/);
  assert.doesNotMatch(page, /detectedPatterns\s*\?\.\s*slice\s*\(\s*0\s*,\s*3/);
});

test("UI clearly labels snapshot limitation and does not expose trading actions", () => {
  assert.match(ui, /勝率ではありません/);
  assert.match(ui, /保存スキャン/);
  assert.doesNotMatch(ui, /\/api\/(?:simulation|trade|orders|cron)/);
});

test("the page is reachable without altering the existing bottom tabs", () => {
  assert.match(menu, /href: "\/chart-shape-search"/);
  assert.match(catalog, /href="\/chart-shape-search"/);
});
