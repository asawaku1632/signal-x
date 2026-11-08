import type { ShadowNineSummary } from "./shadowCandleNineOverview.ts";

export type OwnerCandleStatusBadge = {
  label: string;
  tone: "neutral" | "amber" | "red" | "green";
};

export type OwnerCandleLoadState = "idle" | "loading" | "ready" | "error";

/**
 * Compact SHADOW ONLY pattern-direction label, not a buy/sell recommendation.
 * Show no positive signal unless the pattern was detected on the latest bar.
 */
export function getOwnerCandleStatusBadge(
  loadState: OwnerCandleLoadState,
  summary: ShadowNineSummary | null,
  archiveAvailable: boolean | null,
): OwnerCandleStatusBadge {
  if (loadState === "error") return { label: "⚪ 判定不可", tone: "neutral" };
  if (loadState !== "ready" || !summary) return { label: "⏳ 判定中", tone: "neutral" };

  if (summary.status === "STALE") {
    return { label: "⚪ データ確認", tone: "neutral" };
  }
  if (archiveAvailable === false) {
    return { label: "⚪ 統計未取得", tone: "neutral" };
  }
  if (summary.status === "CAUTION") {
    return { label: "🔴 買い注意", tone: "red" };
  }
  if (summary.status === "WATCH") {
    return { label: "🟠 下落型・静観", tone: "amber" };
  }
  const latestIsBullish = summary.sessionsSinceLastHit === 0
    && summary.mostRecentHits.some(hit => hit.direction === "BUY");
  if (latestIsBullish) {
    return { label: "🟢 上昇型あり", tone: "green" };
  }
  return { label: "⚪ 静観", tone: "neutral" };
}
