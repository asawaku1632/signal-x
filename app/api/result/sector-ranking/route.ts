import { NextResponse } from "next/server";
import { getNotificationResults } from "@/app/lib/notificationResult";
import { stocks } from "@/app/data/stocks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const results = await getNotificationResults();

    const sectorMap = new Map<
      string,
      {
        sector: string;
        total: number;
        win: number;
        lose: number;
        hold: number;
      }
    >();

    for (const r of results) {
      const stock = stocks.find((s) => s.code === r.code);
      const sector = stock?.sector || "未分類";

      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, {
          sector,
          total: 0,
          win: 0,
          lose: 0,
          hold: 0,
        });
      }

      const item = sectorMap.get(sector)!;

      item.total++;

      if (r.result === "WIN") item.win++;
      if (r.result === "LOSE") item.lose++;
      if (r.result === "HOLD") item.hold++;
    }

    const ranking = [...sectorMap.values()]
      .map((item) => {
        const judgedTotal = item.win + item.lose;

        return {
          ...item,
          judgedTotal,
          winRate:
            judgedTotal > 0
              ? Math.round((item.win / judgedTotal) * 100)
              : 0,
        };
      })
      .sort((a, b) => b.winRate - a.winRate);

    return NextResponse.json({
      success: true,
      count: ranking.length,
      ranking,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}