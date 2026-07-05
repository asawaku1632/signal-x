import pool from "@/app/lib/postgres";
import { getVolatilityBonus } from "@/app/lib/volatilityBonus";

export function getVolatilityBand(volatility: number) {
  if (volatility >= 8) return "EXTREME";
  if (volatility >= 5) return "HIGH";
  if (volatility >= 3) return "MIDDLE";
  return "LOW";
}

export function calculateVolatilityLearningBonus(
  winRate: number,
  judged: number
) {
  if (judged < 10) return 0;

  if (winRate >= 90) return 8;
  if (winRate >= 80) return 5;
  if (winRate >= 70) return 3;
  if (winRate >= 60) return 1;
  if (winRate >= 45) return 0;
  if (winRate >= 35) return -2;
  if (winRate >= 25) return -5;

  return -8;
}

export async function getLearningVolatilityBonus(volatility: number) {
  const volatilityBand = getVolatilityBand(volatility);

  const { rows } = await pool.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,
      COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose,
      COUNT(*) FILTER (WHERE result != 'PENDING')::int AS judged
    FROM volatility_learning_logs
    WHERE volatility_band = $1
    `,
    [volatilityBand]
  );

  const win = Number(rows[0]?.win ?? 0);
  const judged = Number(rows[0]?.judged ?? 0);

  const winRate =
    judged > 0 ? Number(((win / judged) * 100).toFixed(2)) : 0;

  const learningBonus =
    calculateVolatilityLearningBonus(winRate, judged);

  const fixedBonus = getVolatilityBonus(volatility);

  return {
    volatilityBand,
    bonus: judged >= 10 ? learningBonus : fixedBonus,
    winRate,
    judged,
    confidence:
      judged >= 300 ? 100 :
      judged >= 100 ? 80 :
      judged >= 30 ? 60 :
      judged >= 10 ? 40 :
      0,
    source: judged >= 10 ? "learning" : "fixed",
  };
}