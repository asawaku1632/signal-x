/**
 * Labels for saved full-scan results. During a JPX market holiday, a scan
 * snapshot may have been persisted today while every quote belongs to an
 * earlier trading day. Do not describe those prices as live or today's.
 *
 * Presentation only: does not change ranking, AI scoring, notification,
 * research results, snapshot refreshes or timestamps.
 */
export function scanDisplayLabels(marketClosed: boolean) {
  return marketClosed
    ? {
        headline: "保存スキャンの買い候補",
        description: "休場日のため、保存済みのAI分析結果を表示しています",
        strongest: "保存スキャンの最有力候補",
        quote: "保存時株価",
        topTen: "保存スキャンのTOP10",
        hotFilter: "保存スキャンの最有力",
      }
    : {
        headline: "今日の買い候補",
        description: "AIが約1000銘柄を監視し、今日の買い候補を抽出",
        strongest: "本日の最有力候補",
        quote: "現在値",
        topTen: "今日のTOP10",
        hotFilter: "今日の最有力",
      };
}
