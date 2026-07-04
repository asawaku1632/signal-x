import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

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
      }
    >();

    for (const stock of stocks) {
      const sectorKey = stock.sectorKey ?? "OTHER";
      const sectorName = stock.sectorLabel ?? "その他";

      if (!sectorMap.has(sectorKey)) {
        sectorMap.set(sectorKey, {
          sectorKey,
          sectorName,
          totalCount: 0,
        });
      }

      sectorMap.get(sectorKey)!.totalCount++;
    }

    const today = new Date().toISOString().slice(0, 10);

    let saved = 0;

    for (const sector of sectorMap.values()) {
      await pool.query(
        `
        INSERT INTO sector_learning_logs
(
  trade_date,
  sector_key,
  sector_name,
  total_count,
  win_count,
  lose_count,
  hold_count,
  judged_count
)
        VALUES
        (
          $1,$2,$3,$4,0,0,0,0
        )
        ON CONFLICT (trade_date, sector_key)
        DO UPDATE SET
          total_count = EXCLUDED.total_count
        `,
        [
          today,
          sector.sectorKey,
          sector.sectorName,
          sector.totalCount,
        ]
      );

      saved++;
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.1_SECTOR_SAVE_DAILY",
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
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}