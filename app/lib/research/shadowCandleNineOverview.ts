import type { ShadowCandleStudy, ShadowCandleHit, ShadowCandle } from "./shadowCandlestickNine.ts";
import type { ShadowBuyCautionResult } from "./shadowCandleBuyCaution.ts";

export type ShadowNineSummary = {
  status: "CAUTION" | "WATCH" | "NO_BEARISH" | "STALE";
  heading: string;
  explanation: string;
  hitCount: number;
  detectedTypes: number;
  recentBarSignals: number;
  completedFiveDay: number;
  totalFiveDay: number;
  mostRecentHits: ShadowCandleHit[];
  mostRecentDate: string | null;
  sessionsSinceLastHit: number | null;
  fiveDayPendingForMostRecent: boolean;
};

/** Descriptive, bounded summary ONLY: never merge opposing BUY/SELL results
 * into a fake total win rate, or portray missing latest SELL as BUY advice.
 */
export function summarizeShadowNine(
  studies: readonly ShadowCandleStudy[],
  candles: readonly ShadowCandle[],
  buyCaution: ShadowBuyCautionResult,
): ShadowNineSummary {
  const allHits = studies.flatMap(s => s.hits);
  const mostRecentTime = allHits.length ? Math.max(...allHits.map(h => h.time)) : null;
  const mostRecentHits = mostRecentTime === null
    ? [] : allHits.filter(h => h.time === mostRecentTime);
  const latestBar = candles.at(-1);
  const barIndex = mostRecentTime === null ? -1 : candles.findIndex(c => c.time === mostRecentTime);
  const sessionsSinceLastHit = barIndex < 0 ? null : candles.length - 1 - barIndex;
  const recentBarSignals = latestBar
    ? allHits.filter(h => h.time === latestBar.time).length : 0;
  const totalFiveDay = allHits.length;
  const completedFiveDay = allHits.filter(h => h.index + 5 < candles.length).length;
  const fiveDayPendingForMostRecent = mostRecentHits.some(h => h.index + 5 >= candles.length);
  const mostRecentDate = mostRecentTime === null ? null : new Date(mostRecentTime * 1000)
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const status: ShadowNineSummary["status"] =
    buyCaution.level === "STALE" ? "STALE"
    : buyCaution.level === "CAUTION" ? "CAUTION"
    : buyCaution.level === "OBSERVE" ? "WATCH"
    : "NO_BEARISH";
  const label = {
    STALE: ["データを確認してから判断", "株価の日付が古いため、現在の売買判断には使えません。"],
    CAUTION: ["購入前に追加確認", "最新確定日足に、過去研究でも一定の下落傾向があった形状を検出しました。"],
    WATCH: ["下落型あり・慎重に確認", "最新確定日足に下落型を検出しましたが、過去統計だけでは優位性を確認できません。"],
    NO_BEARISH: ["買い判断は保留", "最新確定日足に対象4種の下落型は見つかりません。ただし、買いサインや安全の保証ではありません。"],
  } as const;
  return {
    status, heading: label[status][0], explanation: label[status][1],
    hitCount: allHits.length,
    detectedTypes: studies.filter(s => s.hits.length > 0).length,
    recentBarSignals,
    completedFiveDay,
    totalFiveDay,
    mostRecentHits, mostRecentDate, sessionsSinceLastHit,
    fiveDayPendingForMostRecent,
  };
}
