import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

function calculateBonus(winRate: number, judged: number) {
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

function calculateConfidence(judged: number) {
  if (judged >= 300) return 100;
  if (judged >= 100) return 80;
  if (judged >= 30) return 60;
  if (judged >= 10) return 40;

  return 0;
}

export async function GET(req: Request) {
  const startedAt = Date.now();

  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const scanRes = await fetch(`${baseUrl}/api/scan?limit=1000`, {
      cache: "no-store",
    });

    const scanData = await scanRes.json();

    if (!scanData.success) {
      throw new Error("SCAN_FAILED");
    }

    const stocks = scanData.stocks ?? [];

    const sectorMap = new Map<
      string,
      {
        sectorKey: string;
        sectorName: string;
        totalCount: number;
        winCount: number;
        loseCount: number;
        holdCount: number;
      }
    >();

    for (const stock of stocks) {
      const sectorKey = stock.sectorKey ?? "OTHER";
      const sectorName = stock.sectorLabel ?? "その他";
      const changePercent = Number(stock.changePercent ?? 0);

      if (!sectorMap.has(sectorKey)) {
        sectorMap.set(sectorKey, {
          sectorKey,
          sectorName,
          totalCount: 0,
          winCount: 0,
          loseCount: 0,
          holdCount: 0,
        });
      }

      const sector = sectorMap.get(sectorKey)!;

      sector.totalCount++;

      if (changePercent >= 2) {
        sector.winCount++;
      } else if (changePercent <= -2) {
        sector.loseCount++;
      } else {
        sector.holdCount++;
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    let saved = 0;

    for (const sector of sectorMap.values()) {
      const judgedCount =
        sector.winCount + sector.loseCount + sector.holdCount;

      const winRate =
        judgedCount > 0
          ? Number(
              ((sector.winCount / judgedCount) * 100).toFixed(2)
            )
          : 0;

      const aiBonus = calculateBonus(winRate, judgedCount);
      const confidence = calculateConfidence(judgedCount);

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
          confidence
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
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
          confidence = EXCLUDED.confidence
        `,
        [
          today,
          sector.sectorKey,
          sector.sectorName,
          sector.totalCount,
          sector.winCount,
          sector.loseCount,
          sector.holdCount,
          judgedCount,
          winRate,
          aiBonus,
          confidence,
        ]
      );

      saved++;
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.6.2_SECTOR_SAVE_DAILY_WITH_JUDGE",
      learningDate: today,
      sectors: saved,
      stockCount: stocks.length,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("sector save daily error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.6.2_SECTOR_SAVE_DAILY_WITH_JUDGE",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
