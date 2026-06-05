import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import db from "@/app/lib/db";

const yahooFinance = new YahooFinance();

export async function GET() {
  try {
    const rows = db
      .prepare(`
        SELECT *
        FROM learning_logs
        WHERE result = 'pending'
        ORDER BY id ASC
        LIMIT 20
      `)
      .all() as any[];

    let checked = 0;
    let wins = 0;
    let loses = 0;

    for (const row of rows) {
      const symbol = `${row.code}.T`;

      const quote: any = await yahooFinance.quote(symbol);
      const currentPrice = quote.regularMarketPrice || row.entryPrice;

      const result = currentPrice >= row.entryPrice ? "win" : "lose";

      db.prepare(`
        UPDATE learning_logs
        SET result = ?
        WHERE id = ?
      `).run(result, row.id);

      checked++;

      if (result === "win") wins++;
      if (result === "lose") loses++;
    }

    return NextResponse.json({
      success: true,
      checked,
      wins,
      loses,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "learning judge failed",
      },
      { status: 500 }
    );
  }
}