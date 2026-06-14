import { NextResponse } from "next/server";
import { getNotificationResults } from "@/app/lib/notificationResult";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const results = await getNotificationResults();

    const map = new Map();

    for (const r of results) {
      if (!map.has(r.code)) {
        map.set(r.code, {
          code: r.code,
          name: r.name,
          total: 0,
          win: 0,
          lose: 0,
        });
      }

      const item = map.get(r.code);

      item.total++;

      if (r.result === "WIN") item.win++;
      if (r.result === "LOSE") item.lose++;
    }

    const ranking = [...map.values()]
      .map((r) => {
        const judged = r.win + r.lose;

        return {
          ...r,
          winRate:
            judged > 0
              ? Math.round((r.win / judged) * 100)
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