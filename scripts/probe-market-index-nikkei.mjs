/** One-shot manual research probe. No DB writes, no scheduled polling.
 * Unofficial Yahoo endpoint: evaluate provider terms before any ongoing use.
 * Usage: node scripts/probe-market-index-nikkei.mjs
 */
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependency = () => { throw new Error("Unexpected import"); }) {
  const js = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: dependency, Date, Intl, Number, Array });
  return exports;
}
const contract = load("app/lib/research/marketIndexShadowContract.ts");
const { parseNikkeiChartSnapshot } = load(
  "app/lib/research/marketIndexYahooChartParser.ts",
  name => {
    if (!name.includes("marketIndexShadowContract")) throw new Error("Unexpected import");
    return contract;
  },
);
const url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?range=1d&interval=1m";
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 8000);
try {
  const response = await fetch(url, {
    signal: controller.signal,
    redirect: "error",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    console.log(JSON.stringify({ status: "unavailable", httpStatus: response.status, persisted: false }));
    process.exitCode = 1;
  } else {
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error("Response too large");
    const observation = parseNikkeiChartSnapshot({
      payload: JSON.parse(body),
      capturedAt: new Date().toISOString(),
    });
    console.log(JSON.stringify({ ...observation, persisted: false, productionConnected: false }, null, 2));
    if (observation.status !== "observed") process.exitCode = 1;
  }
} catch (error) {
  console.log(JSON.stringify({
    status: "unavailable",
    reason: error instanceof Error ? error.name : "unknown_error",
    persisted: false,
  }));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
