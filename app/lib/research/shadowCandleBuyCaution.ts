import {
  SHADOW_CANDLE_PATTERNS,
  type ShadowCandleHit,
  type ShadowCandleId,
} from "./shadowCandlestickNine.ts";
import type { ArchivedShadowStats } from "./shadowCandleArchiveStats.ts";

/**
 * Pure, research-only education. It NEVER sends an order, changes AI POWER,
 * scores a production stock, emits LINE, or makes an automatic sell/buy call.
 * Only the MOST RECENT finished daily bar can produce a current caution.
 */
export const SHADOW_BUY_CAUTION_RULE_VERSION = "BUY_CAUTION_SHADOW_V1" as const;
export const SHADOW_BUY_CAUTION_MIN_5D = 60;
export const SHADOW_BUY_CAUTION_MIN_STOCKS = 25;
export const SHADOW_BUY_CAUTION_MIN_DIRECTION_RATE = 60;

type SupportedBearishId = Extract<ShadowCandleId,
  "SH_CDL_BEAR_HARAMI" | "SH_CDL_BEAR_ENGULF" |
  "SH_CDL_BEAR_MEETING" | "SH_CDL_TWEEZER_TOP">;

export type ShadowBearishResearchEvidence = {
  id: SupportedBearishId;
  name: string;
  dateTime: number;
  reasons: string[];
  completed5d: number | null;
  distinctStocks: number | null;
  directionalWins: number | null;
  directionMatchPercent: number | null;
  averagePriceChangePercent: number | null;
  cautionQualified: boolean;
};

export type ShadowBuyCautionResult = {
  level: "CAUTION" | "OBSERVE" | "NONE" | "STALE";
  signals: ShadowBearishResearchEvidence[];
  ruleVersion: typeof SHADOW_BUY_CAUTION_RULE_VERSION;
};

/** The same stats are retrospective, correlated observations: NOT a win rate,
 * a statistical confidence guarantee or probability for a new individual stock.
 */
export function evaluateShadowBuyCaution({
  hits,
  latestCompletedBarTime,
  todayJst,
  archiveRows,
}: {
  hits: readonly ShadowCandleHit[];
  latestCompletedBarTime: number | null;
  todayJst: string;
  archiveRows: readonly ArchivedShadowStats[] | null;
}): ShadowBuyCautionResult {
  const base = { ruleVersion: SHADOW_BUY_CAUTION_RULE_VERSION };
  if (!latestCompletedBarTime || !Number.isFinite(latestCompletedBarTime) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(todayJst)) {
    return { ...base, level: "NONE", signals: [] };
  }
  const barDate = new Date(latestCompletedBarTime * 1000).toLocaleDateString(
    "sv-SE", { timeZone: "Asia/Tokyo" },
  );
  const age = (Date.parse(todayJst + "T00:00:00Z") - Date.parse(barDate + "T00:00:00Z")) / 86_400_000;
  // Stale market data must never look like a current purchase warning.
  if (!Number.isFinite(age) || age < 0 || age > 10) {
    return { ...base, level: "STALE", signals: [] };
  }
  const bearish = new Set(
    SHADOW_CANDLE_PATTERNS.filter(def => def.direction === "SELL").map(def => def.id),
  );
  const latestBearish = hits.filter(h => h.time === latestCompletedBarTime && bearish.has(h.id));
  const signals = latestBearish.map(hit => {
    const stat = archiveRows?.find(x => x.patternId === hit.id);
    const h = stat?.horizons.find(x => x.days === 5);
    const completed5d = h?.completed ?? null;
    const distinctStocks = stat?.codes ?? null;
    const directionalWins = h?.wins ?? null;
    const directionMatchPercent = h?.winRate ?? null;
    // A bearish directional gain of +1% means the underlying price fell -1%.
    const averagePriceChangePercent = h?.meanReturn === null || h?.meanReturn === undefined
      ? null : Math.round(-h.meanReturn * 100) / 100;
    const cautionQualified = completed5d !== null &&
      completed5d >= SHADOW_BUY_CAUTION_MIN_5D &&
      distinctStocks !== null && distinctStocks >= SHADOW_BUY_CAUTION_MIN_STOCKS &&
      directionMatchPercent !== null && directionMatchPercent >= SHADOW_BUY_CAUTION_MIN_DIRECTION_RATE &&
      averagePriceChangePercent !== null && averagePriceChangePercent < 0;
    return {
      id: hit.id as SupportedBearishId,
      name: hit.name,
      dateTime: hit.time,
      reasons: hit.reasons,
      completed5d, distinctStocks, directionalWins, directionMatchPercent,
      averagePriceChangePercent, cautionQualified,
    };
  });
  return {
    ...base,
    level: signals.some(s => s.cautionQualified) ? "CAUTION" : signals.length ? "OBSERVE" : "NONE",
    signals,
  };
}
