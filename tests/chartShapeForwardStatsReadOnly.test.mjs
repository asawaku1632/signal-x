import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = readFileSync(join(root, "app/chart-shape-search/page.tsx"), "utf8");
const client = readFileSync(join(root, "app/components/patterns/ChartShapeSearchExplorer.tsx"), "utf8");
const engine = readFileSync(join(root, "app/lib/chartPatternEngine.ts"), "utf8");
const catalog = readFileSync(join(root, "app/lib/chartPatternCatalog.ts"), "utf8");

test("private research statistics are fetched only after owner identity is verified", () => {
  assert.match(server, /getLearningOwnerSession\(\)/);
  assert.match(server, /historicalStats: ShapePatternStat\[\] \| null = null/);
  assert.match(server, /if \(owner\.isOwner\) \{[\s\S]*?await getPatternForwardStats\(\)/);
  assert.match(server, /historicalStats=\{historicalStats\}/);
  assert.match(client, /historicalStats !== null &&/);
});

test("historical statistics are display-only and never modify decisions or stored outcomes", () => {
  assert.match(server, /getPatternForwardStats/);
  assert.match(server, /FROM display_snapshots/);
  assert.doesNotMatch(server, /\b(?:runScan|refreshScanSnapshot|refreshPatternForwardStats|savePatternForwardObservations|updatePatternForwardOutcomes)\s*\(/);
  assert.doesNotMatch(client, /\b(?:fetch|POST|PUT|DELETE|PATCH)\s*\(/);
});

test("sample size and validation status are exposed alongside historical win rate", () => {
  for (const field of ["completed5dCount", "winRate5d", "avgDirectionalReturn5d", "distinctCodes", "distinctDates", "status"]) {
    assert.match(server, new RegExp(field));
    assert.match(client, new RegExp(field));
  }
  assert.match(client, />= 20/);
  assert.match(client, /VALIDATED/);
  assert.match(client, /売買利益や個別銘柄の上昇確率ではありません/);
});

test("the pictured covered-candle pattern exists, but other pairs are not silently labeled as implemented", () => {
  assert.match(catalog, /name: "被せ線"/);
  assert.match(engine, /name: "被せ線"/);
  for (const missing of ["つつみ線", "はらみ線", "出会い線", "毛抜き天井", "毛抜き底", "切り込み線"]) {
    assert.equal(catalog.includes(`name: "${missing}"`), false);
  }
});
