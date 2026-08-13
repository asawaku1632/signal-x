import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { allSettledWithConcurrency } from "../app/lib/learning/promisePool.ts";

const CONCURRENCY = 20;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function fixedBatches(items, batchSize, task) {
  const settled = [];
  for (let index = 0; index < items.length; index += batchSize) {
    settled.push(...await Promise.allSettled(items.slice(index, index + batchSize).map(task)));
  }
  return settled;
}

function summarize(items, settled) {
  const stocks = [];
  const failures = [];
  for (const [index, result] of settled.entries()) {
    if (result.status === "fulfilled" && result.value) {
      stocks.push(result.value);
    } else {
      const reason = result.status === "rejected" ? result.reason : null;
      failures.push({
        code: items[index].code,
        errorType: reason instanceof Error ? reason.name || "Error" : "EmptyResult",
      });
    }
  }
  const errorTypes = failures.reduce((result, failure) => {
    result[failure.errorType] = (result[failure.errorType] ?? 0) + 1;
    return result;
  }, {});
  return { stocks, failures, errorTypes };
}

function rank(stocks) {
  return stocks.slice().sort((a, b) =>
    b.rawAiPower - a.rawAiPower
      || b.changePercent - a.changePercent
      || b.volumeRatio - a.volumeRatio
      || a.code.localeCompare(b.code, "ja"),
  ).map((stock, index) => ({ ...stock, rank: index + 1 }));
}

test("Pool 20 preserves successes, failures, AI POWER details, ranking, and candidates", async () => {
  const inputs = Array.from({ length: 96 }, (_, index) => ({
    index,
    code: String(1000 + index),
    delay: (31 - index % 31) % 7,
  }));
  const task = async (input) => {
    await wait(input.delay);
    if (input.index % 29 === 0) {
      const error = new Error("timed out");
      error.name = "TimeoutError";
      throw error;
    }
    if (input.index % 23 === 0) return null;
    const rawAiPower = 70 + input.index % 5;
    return {
      code: input.code,
      aiPower: rawAiPower,
      rawAiPower,
      scoreBreakdown: {
        baseScore: 60,
        experienceBonus: input.index % 3,
        volatilityBonus: input.index % 4 - 2,
      },
      changePercent: input.index % 4,
      volumeRatio: input.index % 3,
    };
  };

  const legacy = summarize(inputs, await fixedBatches(inputs, CONCURRENCY, task));
  const pooled = summarize(inputs, await allSettledWithConcurrency(inputs, CONCURRENCY, task));

  assert.equal(pooled.stocks.length, legacy.stocks.length);
  assert.equal(pooled.failures.length, legacy.failures.length);
  assert.deepEqual(pooled.errorTypes, legacy.errorTypes);
  assert.deepEqual(pooled.stocks, legacy.stocks);
  assert.deepEqual(pooled.failures, legacy.failures);

  const legacyRanking = rank(legacy.stocks);
  const poolRanking = rank(pooled.stocks);
  assert.deepEqual(poolRanking, legacyRanking);
  assert.deepEqual(poolRanking.slice(0, 20), legacyRanking.slice(0, 20));
});

test("Pool fills free slots, never exceeds 20, and restores input order", async (context) => {
  const inputs = Array.from({ length: 60 }, (_, index) => ({
    index,
    delay: index === 0 || index === 20 ? 80 : 3,
  }));
  let active = 0;
  let maxActive = 0;
  const completionOrder = [];
  let filledSlotBeforeSlowTaskFinished = false;
  const task = async (input) => {
    if (input.index >= CONCURRENCY && !completionOrder.includes(0)) {
      filledSlotBeforeSlowTaskFinished = true;
    }
    active += 1;
    maxActive = Math.max(maxActive, active);
    await wait(input.delay);
    completionOrder.push(input.index);
    active -= 1;
    return input.index;
  };

  const batchStarted = performance.now();
  await fixedBatches(inputs, CONCURRENCY, task);
  const batchMs = performance.now() - batchStarted;

  active = 0;
  maxActive = 0;
  completionOrder.length = 0;
  const poolStarted = performance.now();
  const pooled = await allSettledWithConcurrency(inputs, CONCURRENCY, task);
  const poolMs = performance.now() - poolStarted;

  assert.equal(maxActive, CONCURRENCY);
  assert.equal(filledSlotBeforeSlowTaskFinished, true);
  assert.deepEqual(
    pooled.map((result) => result.status === "fulfilled" ? result.value : null),
    inputs.map((input) => input.index),
  );
  assert.ok(poolMs < batchMs * 0.8, `expected pool ${poolMs}ms to beat batches ${batchMs}ms`);
  context.diagnostic(JSON.stringify({
    fixedBatchMs: Number(batchMs.toFixed(1)),
    promisePoolMs: Number(poolMs.toFixed(1)),
    maxConcurrency: maxActive,
    completionOrder: completionOrder.slice(0, 12),
  }));
});

test("scan engine fixes concurrency at 20 without changing Yahoo or Stage 1", async () => {
  const [scan, stockAnalyzer, experience, volatility] = await Promise.all([
    read("app/lib/learning/scanEngine.ts"),
    read("app/lib/learning/stockAnalyzer.ts"),
    read("app/lib/learning/experienceAiEngine.ts"),
    read("app/lib/learning/volatilityLearning.ts"),
  ]);

  assert.match(scan, /const SCAN_CONCURRENCY = 20/);
  assert.match(scan, /allSettledWithConcurrency\(items, concurrency, fn\)/);
  assert.doesNotMatch(scan, /for \(let i = 0; i < items\.length; i \+= batchSize\)/);
  assert.match(scan, /preloadExperienceAi\(patternKeys, 3\)/);
  assert.match(scan, /preloadVolatilityStats\(volatilityBands\)/);
  assert.match(experience, /Experience AI preload failed|preloadExperienceAi/);
  assert.match(volatility, /preloadVolatilityStats/);
  assert.match(stockAnalyzer, /const \[intradayChart, dailyChart\] = await Promise\.all\(\[/);
});
