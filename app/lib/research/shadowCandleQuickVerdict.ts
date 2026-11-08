import type { ShadowNineSummary } from "./shadowCandleNineOverview.ts";

export type ShadowNineQuickVerdict = {
  label: string;
  icon: string;
  tone: "neutral" | "amber" | "red" | "green";
  explanation: string;
};

/**
 * Educational label for the closed owner-only stock accordion.
 * No production buy/sell recommendation: pattern formation alone does NOT
 * mean a stock is safe to buy, should be sold, or will move in that direction.
 * Only the latest completed candle may generate a directional label.
 */
export function getShadowNineQuickVerdict(
  summary: ShadowNineSummary | null,
  unavailable = false,
): ShadowNineQuickVerdict {
  if (!summary) {
    return unavailable
      ? { label: "判定不可", icon: "⚪", tone: "neutral",
          explanation: "研究データを取得できません。開くと再試行できます。" }
      : { label: "判定中", icon: "⏳", tone: "neutral",
          explanation: "本人専用の確定日足を照合しています。" };
  }
  if (summary.status === "STALE") {
    return { label: "更新待ち", icon: "⚪", tone: "neutral",
      explanation: "日足が古いため、売買方向のラベルを表示しません。" };
  }
  // Existing CAUTION is only assigned after conservative historical bearish
  // evidence thresholds, but it is NOT advice to sell an owned position.
  if (summary.status === "CAUTION") {
    return { label: "売り警戒", icon: "🔴", tone: "red",
      explanation: "最新足に下落型。過去研究の一定条件に該当。売却推奨ではありません。" };
  }

  const latestHits = summary.sessionsSinceLastHit === 0 ? summary.mostRecentHits : [];
  const bullish = latestHits.some(hit => hit.direction === "BUY");
  const bearish = latestHits.some(hit => hit.direction === "SELL");

  if (bullish && bearish) {
    return { label: "売買混在・静観", icon: "🟡", tone: "amber",
      explanation: "最新足で上昇型と下落型が混在。結論を出せません。" };
  }
  if (bearish || summary.status === "WATCH") {
    return { label: "下落注意", icon: "🟠", tone: "amber",
      explanation: "最新足に下落型。過去の検証だけでは売りの優位性は未確認。" };
  }
  if (bullish) {
    return { label: "買い形状あり", icon: "🟢", tone: "green",
      explanation: "最新足に上昇型。ただし買い推奨・予測成功の意味ではありません。" };
  }
  return { label: "静観", icon: "⚪", tone: "neutral",
    explanation: "最新足に研究対象9種類の形状は検出されていません。" };
}
