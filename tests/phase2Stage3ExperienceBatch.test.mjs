import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function parts(key) {
  return String(key).split("|").map((part) => part.trim()).filter(Boolean);
}

function similarity(target, candidate) {
  const targetParts = parts(target);
  const candidateParts = parts(candidate);
  const length = Math.max(targetParts.length, candidateParts.length);
  let matches = 0;
  for (let index = 0; index < length; index += 1) {
    if (targetParts[index] && targetParts[index] === candidateParts[index]) matches += 1;
  }
  return Math.round((matches / length) * 100);
}

function candidatesForKey(rows, key, limit) {
  const target = parts(key);
  const pattern = target[0] ?? null;
  const sector = target[target.length - 2] ?? null;
  const market = target[target.length - 1] ?? null;
  const grouped = new Map();
  for (const row of rows) {
    if (!['WIN', 'LOSE'].includes(row.result)) continue;
    if (row.patternKey !== pattern && row.sectorKey !== sector && row.marketPattern !== market) continue;
    const value = grouped.get(row.experienceKey) ?? { experienceKey: row.experienceKey, win: 0, lose: 0, rawTotal: 0 };
    value.rawTotal += 1;
    if (row.result === 'WIN') value.win += 1;
    if (row.result === 'LOSE') value.lose += 1;
    grouped.set(row.experienceKey, value);
  }
  return [...grouped.values()].sort((a, b) => b.rawTotal - a.rawTotal).slice(0, limit);
}

function batchCandidates(rows, keys, limit) {
  return new Map(keys.map((key) => [key, candidatesForKey(rows, key, limit)]));
}

function similarResult(key, rows) {
  const items = rows.map((row) => ({
    ...row,
    total: row.win + row.lose,
    similarity: similarity(key, row.experienceKey),
  })).filter((row) => row.total > 0 && row.similarity >= 70)
    .sort((a, b) => b.similarity - a.similarity || b.total - a.total)
    .slice(0, 20);
  const win = items.reduce((sum, item) => sum + item.win, 0);
  const lose = items.reduce((sum, item) => sum + item.lose, 0);
  return { items, win, lose, total: win + lose, winRate: win + lose ? Math.round(win / (win + lose) * 100) : 0 };
}

function rankingResult(key, rows) {
  const items = rows.map((row) => {
    const value = similarity(key, row.experienceKey);
    const weight = value >= 100 ? 1 : value >= 95 ? 0.9 : value >= 90 ? 0.8 : value >= 80 ? 0.6 : value >= 70 ? 0.4 : 0;
    return { ...row, total: row.win + row.lose, similarity: value, weight };
  }).filter((row) => row.total > 0 && row.similarity >= 70 && row.weight > 0)
    .sort((a, b) => b.similarity - a.similarity || b.total - a.total)
    .slice(0, 10);
  const win = items.reduce((sum, item) => sum + item.win, 0);
  const lose = items.reduce((sum, item) => sum + item.lose, 0);
  const total = win + lose;
  return { items, win, lose, total, winRate: total ? Math.round(win / total * 100) : 0, confidence: total >= 100 ? 100 : total >= 30 ? 80 : total >= 10 ? 50 : 0 };
}

function fixture() {
  const rows = [];
  for (let index = 0; index < 1100; index += 1) {
    const experienceKey = `P${index % 4}|S${index % 5}|M${index % 3}`;
    const count = 1 + index % 7;
    for (let item = 0; item < count; item += 1) {
      rows.push({
        experienceKey: `${experienceKey}|${String(index).padStart(3, '0')}`,
        patternKey: `P${index % 4}`,
        sectorKey: `S${index % 5}`,
        marketPattern: `M${index % 3}`,
        result: item % 3 === 0 ? 'HOLD' : item % 2 === 0 ? 'LOSE' : 'WIN',
      });
    }
  }
  rows.push({ experienceKey: 'NULLS', patternKey: null, sectorKey: null, marketPattern: null, result: 'WIN' });
  return rows;
}

test("batched lateral semantics match per-key results at LIMIT 300 and 500", () => {
  const rows = fixture();
  const keys = ['P0|S0|M0', 'P1|S2|M1', 'P3|S4|M2'];
  const similarBatch = batchCandidates(rows, keys, 300);
  const rankingBatch = batchCandidates(rows, keys, 500);

  assert.equal(candidatesForKey(rows, keys[0], 300).length, 300);
  assert.equal(candidatesForKey(rows, keys[0], 500).length, 500);

  for (const key of keys) {
    const oldSimilar = candidatesForKey(rows, key, 300);
    const oldRanking = candidatesForKey(rows, key, 500);
    assert.deepEqual(similarBatch.get(key), oldSimilar);
    assert.deepEqual(rankingBatch.get(key), oldRanking);
    assert.deepEqual(similarResult(key, similarBatch.get(key)), similarResult(key, oldSimilar));
    assert.deepEqual(rankingResult(key, rankingBatch.get(key)), rankingResult(key, oldRanking));
    assert.ok(oldSimilar.length <= 300);
    assert.ok(oldRanking.length <= 500);
  }
});

test("Experience outputs, AI POWER, final ranking, ties, and candidates remain identical", () => {
  const rows = fixture();
  const keys = ['P0|S0|M0', 'P1|S2|M1', 'P3|S4|M2'];
  const oldStocks = keys.map((key, index) => {
    const similar = similarResult(key, candidatesForKey(rows, key, 300));
    const ranking = rankingResult(key, candidatesForKey(rows, key, 500));
    const rawAiPower = 80 + similar.winRate / 100 + ranking.winRate / 100;
    return { code: String(2000 + index), key, rawAiPower, aiPower: Math.round(rawAiPower * 10) / 10, similar, ranking, changePercent: 1, volumeRatio: 1 };
  });
  const similarBatch = batchCandidates(rows, keys, 300);
  const rankingBatch = batchCandidates(rows, keys, 500);
  const newStocks = keys.map((key, index) => {
    const similar = similarResult(key, similarBatch.get(key));
    const ranking = rankingResult(key, rankingBatch.get(key));
    const rawAiPower = 80 + similar.winRate / 100 + ranking.winRate / 100;
    return { code: String(2000 + index), key, rawAiPower, aiPower: Math.round(rawAiPower * 10) / 10, similar, ranking, changePercent: 1, volumeRatio: 1 };
  });
  const sort = (stocks) => stocks.slice().sort((a, b) => b.rawAiPower - a.rawAiPower || b.changePercent - a.changePercent || b.volumeRatio - a.volumeRatio || a.code.localeCompare(b.code, 'ja'));
  assert.deepEqual(newStocks, oldStocks);
  assert.deepEqual(sort(newStocks), sort(oldStocks));
  assert.deepEqual(sort(newStocks).slice(0, 2), sort(oldStocks).slice(0, 2));
});

test("production SQL keeps per-key filters, ordering, separate limits, and fallback", async () => {
  const [similar, ranking, scan, pool] = await Promise.all([
    read('app/lib/similarExperience.ts'),
    read('app/lib/experienceRanking.ts'),
    read('app/lib/learning/scanEngine.ts'),
    read('app/lib/learning/promisePool.ts'),
  ]);
  for (const source of [similar, ranking]) {
    assert.match(source, /WITH ORDINALITY/);
    assert.match(source, /CROSS JOIN LATERAL/);
    assert.match(source, /WHERE result IN \('WIN', 'LOSE'\)/);
    assert.match(source, /pattern_key = input\.pattern_key[\s\S]*OR sector_key = input\.sector_key[\s\S]*OR market_pattern = input\.market_pattern/);
    assert.match(source, /GROUP BY experience_key[\s\S]*ORDER BY raw_total DESC[\s\S]*LIMIT \$5/);
    assert.match(source, /using per-key queries/);
  }
  assert.match(similar, /const limit = options\?\.limit \?\? 300/);
  assert.match(ranking, /const candidateLimit = options\?\.candidateLimit \?\? 500/);
  assert.match(scan, /const SCAN_CONCURRENCY = 20/);
  assert.match(scan, /preloadExperienceAi\(patternKeys, 3\)/);
  assert.match(scan, /preloadVolatilityStats\(volatilityBands\)/);
  assert.match(pool, /settled\[index\]/);
});

test("map paths use one batch query each instead of one query per key", async () => {
  const [similar, ranking] = await Promise.all([
    read('app/lib/similarExperience.ts'),
    read('app/lib/experienceRanking.ts'),
  ]);
  const similarMap = similar.slice(similar.indexOf('export async function getSimilarExperienceBonusMap'));
  const rankingMap = ranking.slice(ranking.indexOf('export async function getExperienceRankingMap'));
  assert.equal((similarMap.match(/pool\.query\(/g) ?? []).length, 1);
  assert.equal((rankingMap.match(/pool\.query\(/g) ?? []).length, 1);
  assert.match(similarMap, /for \(const key of uniqueKeys\)[\s\S]*getSimilarExperienceBonus\(key, options\)/);
  assert.match(rankingMap, /for \(const key of uniqueKeys\)[\s\S]*getExperienceRanking\(key, options\)/);
});
