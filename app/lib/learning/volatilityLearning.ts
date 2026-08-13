import pool from "@/app/lib/postgres";
import { getVolatilityBonus } from "@/app/lib/volatilityBonus";

type VolatilityStats = {
  win: number;
  judged: number;
};

export type VolatilityStatsMap = Map<string, VolatilityStats>;

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

export async function preloadVolatilityStats(
  volatilityBands: string[],
): Promise<VolatilityStatsMap> {
  const uniqueBands = Array.from(new Set(volatilityBands));
  if (uniqueBands.length === 0) return new Map();

  const { rows } = await pool.query(
    `
    SELECT
      volatility_band,
      COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,
      COUNT(*) FILTER (WHERE result != 'PENDING')::int AS judged
    FROM volatility_learning_logs
    WHERE volatility_band = ANY($1::text[])
    GROUP BY volatility_band
    `,
    [uniqueBands],
  );

  const statsMap: VolatilityStatsMap = new Map();
  for (const row of rows) {
    statsMap.set(String(row.volatility_band), {
      win: Number(row.win ?? 0),
      judged: Number(row.judged ?? 0),
    });
  }

  for (const band of uniqueBands) {
    if (!statsMap.has(band)) statsMap.set(band, { win: 0, judged: 0 });
  }

  return statsMap;
}

export async function getLearningVolatilityBonus(
  volatility: number,
  statsMap?: VolatilityStatsMap,
) {
  const volatilityBand = getVolatilityBand(volatility);
  let stats = statsMap?.get(volatilityBand);

  if (!stats) {
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
    stats = {
      win: Number(rows[0]?.win ?? 0),
      judged: Number(rows[0]?.judged ?? 0),
    };
  }

  const { win, judged } = stats;

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
