/** Display-only AI POWER score bands for stock lists.
 * This is NOT an entry signal, measured win rate, or trade recommendation.
 * Keep research, notification, and existing AI judge logic unchanged.
 */
export type AiScoreTier = {
  label: "大本命" | "本命" | "買い候補" | "押し目待ち" | "様子見" | "見送り" | "未評価";
  tone: "prime" | "main" | "buy" | "pullback" | "watch" | "skip" | "unknown";
};

export function getAiScoreTier(score: number | null | undefined): AiScoreTier {
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
    return { label: "未評価", tone: "unknown" };
  }
  if (score >= 95) return { label: "大本命", tone: "prime" };
  if (score >= 90) return { label: "本命", tone: "main" };
  if (score >= 85) return { label: "買い候補", tone: "buy" };
  if (score >= 75) return { label: "押し目待ち", tone: "pullback" };
  if (score >= 65) return { label: "様子見", tone: "watch" };
  return { label: "見送り", tone: "skip" };
}

export const AI_SCORE_TIER_LEGEND = "AI評価帯：95以上 大本命／90以上 本命／85以上 買い候補／75以上 押し目待ち／65以上 様子見／65未満 見送り。表示用のスコア区分であり、実測勝率や売買タイミングを示すものではありません。";
