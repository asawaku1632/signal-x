import pool from "@/app/lib/postgres";
import { getSectorKey, sectorLabelMap, type SectorKey } from "@/app/lib/sectorMap";

type StockResult = {
  code: string;
  name?: string;
  result?: string;
  aiPower?: number;
  score?: number;
  changePercent?: number;
};

type SectorSummary = {
  sectorKey: SectorKey;
  sectorName: string;
  totalCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  judgedCount: number;
  winRate: number;
  aiBonus: number;
  confidence: number;
  averageAiPower: number | null;
  averageChange: number | null;
};

function calculateSectorBonus(winRate: number, judgedCount: number) {
  if (judgedCount < 10) return 0;

  if (winRate >= 85) return 10;
  if (winRate >= 75) return 8;
  if (winRate >= 65) return 5;
  if (winRate >= 55) return 2;
  if (winRate >= 45) return 0;
  if (winRate >= 35) return -3;
  if (winRate >= 25) return -6;
  return -10;
}

function calculateConfidence(judgedCount: number) {
  if (judgedCount >= 100) return 100;
  if (judgedCount >= 30) return 80;
  if (judgedCount >= 10) return 50;
  return 0;
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));

  if (valid.length === 0) return null;

  return Number(
    (valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2)
  );
}

export function summarizeSectors(stocks: StockResult[]): SectorSummary[] {
  const map = new Map<
    SectorKey,
    {
      totalCount: number;
      winCount: number;
      loseCount: number;
      holdCount: number;
      aiPowers: number[];
      changes: number[];
    }
  >();

  for (const stock of stocks) {
    const sectorKey = getSectorKey(stock.code);

    const current =
      map.get(sectorKey) || {
        totalCount: 0,
        winCount: 0,
        loseCount: 0,
        holdCount: 0,
        aiPowers: [],
        changes: [],
      };

    current.totalCount += 1;

    if (stock.result === "WIN") current.winCount += 1;
    if (stock.result === "LOSE") current.loseCount += 1;
    if (stock.result === "HOLD") current.holdCount += 1;

    const aiPower = stock.aiPower ?? stock.score;
    if (typeof aiPower === "number") current.aiPowers.push(aiPower);

    if (typeof stock.changePercent === "number") {
      current.changes.push(stock.changePercent);
    }

    map.set(sectorKey, current);
  }

  return Array.from(map.entries()).map(([sectorKey, value]) => {
    const judgedCount = value.winCount + value.loseCount;
    const winRate =
      judgedCount === 0
        ? 0
        : Number(((value.winCount / judgedCount) * 100).toFixed(2));

    return {
      sectorKey,
      sectorName: sectorLabelMap[sectorKey],
      totalCount: value.totalCount,
      winCount: value.winCount,
      loseCount: value.loseCount,
      holdCount: value.holdCount,
      judgedCount,
      winRate,
      aiBonus: calculateSectorBonus(winRate, judgedCount),
      confidence: calculateConfidence(judgedCount),
      averageAiPower: average(value.aiPowers),
      averageChange: average(value.changes),
    };
  });
}

export async function saveSectorLearning(
  tradeDate: string,
  stocks: StockResult[]
) {
  const summaries = summarizeSectors(stocks);

  if (summaries.length === 0) {
    return {
      sectorAdded: 0,
      sectors: [],
    };
  }

  for (const item of summaries) {
    await pool.query(
      `
      INSERT INTO sector_learning_logs (
        trade_date,
        sector_key,
        sector_name,
        total_count,
        win_count,
        lose_count,
        hold_count,
        judged_count,
        win_rate,
        ai_bonus,
        confidence,
        average_ai_power,
        average_change
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
      ON CONFLICT (trade_date, sector_key)
      DO UPDATE SET
        sector_name = EXCLUDED.sector_name,
        total_count = EXCLUDED.total_count,
        win_count = EXCLUDED.win_count,
        lose_count = EXCLUDED.lose_count,
        hold_count = EXCLUDED.hold_count,
        judged_count = EXCLUDED.judged_count,
        win_rate = EXCLUDED.win_rate,
        ai_bonus = EXCLUDED.ai_bonus,
        confidence = EXCLUDED.confidence,
        average_ai_power = EXCLUDED.average_ai_power,
        average_change = EXCLUDED.average_change
      `,
      [
        tradeDate,
        item.sectorKey,
        item.sectorName,
        item.totalCount,
        item.winCount,
        item.loseCount,
        item.holdCount,
        item.judgedCount,
        item.winRate,
        item.aiBonus,
        item.confidence,
        item.averageAiPower,
        item.averageChange,
      ]
    );
  }

  return {
    sectorAdded: summaries.length,
    sectors: summaries,
  };
}