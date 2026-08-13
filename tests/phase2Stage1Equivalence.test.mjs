import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const bands = ["LOW", "MIDDLE", "HIGH", "EXTREME"];

function volatilityBand(value) {
  if (value >= 8) return "EXTREME";
  if (value >= 5) return "HIGH";
  if (value >= 3) return "MIDDLE";
  return "LOW";
}

function volatilityBonus(stats, volatility) {
  const { win, judged } = stats;
  const winRate = judged > 0 ? Number(((win / judged) * 100).toFixed(2)) : 0;
  const learning = judged < 10 ? null
    : winRate >= 90 ? 8
    : winRate >= 80 ? 5
    : winRate >= 70 ? 3
    : winRate >= 60 ? 1
    : winRate >= 45 ? 0
    : winRate >= 35 ? -2
    : winRate >= 25 ? -5
    : -8;
  return { band: volatilityBand(volatility), winRate, judged, learning };
}

function displayAiPower(raw) {
  const value = raw <= 85 ? Math.max(0, raw) : 85 + 15 * (1 - Math.exp(-(raw - 85) / 20));
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

function compareStocks(a, b) {
  return b.rawAiPower - a.rawAiPower
    || b.changePercent - a.changePercent
    || b.volumeRatio - a.volumeRatio
    || a.code.localeCompare(b.code, "ja");
}

test("Stage 1 bulk maps preserve per-stock Experience, volatility, AI POWER, and ranking", () => {
  const matches = Array.from({ length: 48 }, (_, index) => ({
    patternKey: `PATTERN-${index}`,
    experienceBonus: index % 7 - 3,
    sampleCount: index + 3,
    winRate: 40 + index,
  }));
  const exactMap = new Map(matches.map((match) => [match.patternKey, match]));
  const candidates = matches.slice().sort((a, b) => b.winRate - a.winRate).slice(0, 10);
  const statsRows = bands.map((band, index) => ({ band, win: 10 + index * 4, judged: 20 + index * 5 }));
  const statsMap = new Map(statsRows.map((row) => [row.band, row]));

  const inputs = Array.from({ length: 960 }, (_, index) => ({
    code: String(1000 + index),
    patternKey: `PATTERN-${index % 48}`,
    volatility: (index % 120) / 10,
    baseScore: 45 + index % 43,
    fixedParts: index % 11 - 5,
    changePercent: index % 17 - 8,
    volumeRatio: index % 13,
  }));

  const legacy = inputs.map((input) => {
    const match = matches.find((item) => item.patternKey === input.patternKey) ?? null;
    const band = volatilityBand(input.volatility);
    const stats = statsRows.find((item) => item.band === band);
    const volatility = volatilityBonus(stats, input.volatility);
    const rawAiPower = input.baseScore + input.fixedParts + match.experienceBonus + (volatility.learning ?? 0);
    return { ...input, match, candidates, volatility, rawAiPower, aiPower: displayAiPower(rawAiPower) };
  });

  const bulk = inputs.map((input) => {
    const match = exactMap.get(input.patternKey) ?? null;
    const stats = statsMap.get(volatilityBand(input.volatility));
    const volatility = volatilityBonus(stats, input.volatility);
    const rawAiPower = input.baseScore + input.fixedParts + match.experienceBonus + (volatility.learning ?? 0);
    return { ...input, match, candidates, volatility, rawAiPower, aiPower: displayAiPower(rawAiPower) };
  });

  assert.deepEqual(bulk, legacy);
  assert.deepEqual(bulk.slice().sort(compareStocks), legacy.slice().sort(compareStocks));
});

test("Stage 1 keeps SQL semantics and falls back to legacy queries on preload failure", async () => {
  const [scan, pipeline, experience, volatility] = await Promise.all([
    read("app/lib/learning/scanEngine.ts"),
    read("app/lib/learning/pipeline.ts"),
    read("app/lib/learning/experienceAiEngine.ts"),
    read("app/lib/learning/volatilityLearning.ts"),
  ]);

  assert.match(experience, /pattern_key = ANY\(\$1::text\[\]\)/);
  assert.match(experience, /HAVING COUNT\(\*\) FILTER \(WHERE result IN \('WIN', 'LOSE'\)\) >= \$2/);
  assert.match(experience, /findCandidateExperiences\(minSampleCount, 10\)/);
  assert.match(experience, /ORDER BY[\s\S]*COUNT\(\*\) FILTER \(WHERE result = 'WIN'\)[\s\S]*LIMIT \$2/);
  assert.match(volatility, /volatility_band = ANY\(\$1::text\[\]\)/);
  assert.match(scan, /Experience AI preload failed; using per-stock queries/);
  assert.match(scan, /Volatility preload failed; using per-stock queries/);
  assert.match(pipeline, /getExperienceReport\([\s\S]*experienceAiPreload\)/);
  assert.match(pipeline, /volatilityStatsMap/);
});

test("Stage 1 uses three bulk queries for the 2,880 per-stock query targets", async () => {
  const [experience, volatility] = await Promise.all([
    read("app/lib/learning/experienceAiEngine.ts"),
    read("app/lib/learning/volatilityLearning.ts"),
  ]);

  const preloadBody = experience.slice(
    experience.indexOf("export async function preloadExperienceAi"),
    experience.indexOf("export async function getExperienceReport"),
  );
  const volatilityBody = volatility.slice(
    volatility.indexOf("export async function preloadVolatilityStats"),
    volatility.indexOf("export async function getLearningVolatilityBonus"),
  );

  assert.equal((preloadBody.match(/pool\.query\(/g) ?? []).length, 1);
  assert.equal((preloadBody.match(/findCandidateExperiences\(/g) ?? []).length, 1);
  assert.equal((volatilityBody.match(/pool\.query\(/g) ?? []).length, 1);
});
