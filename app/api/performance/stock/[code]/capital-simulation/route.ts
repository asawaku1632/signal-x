import { NextResponse } from "next/server";

import { getDailyStockResultsByCode } from "@/app/lib/dailyLearning";

const INITIAL_CAPITAL = 100_000;
const LOT_SIZE = 100;
const BUY_SCORE = 85;

type Trade = {
  date: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  profitYen: number;
  capitalAfter: number;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const rows = (await getDailyStockResultsByCode(code))
      .filter(
        (item) =>
          item.result !== "UNKNOWN" &&
          item.nextPrice !== null &&
          item.changePercent !== null,
      )
      .sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

    let capital = INITIAL_CAPITAL;
    let skippedInsufficientFunds = 0;
    let skippedNoBuySignal = 0;
    const trades: Trade[] = [];

    for (const item of rows) {
      // 現在のSIGNALX定義では AI POWER 85以上を「買い候補」以上として扱う。
      if (item.score < BUY_SCORE) {
        skippedNoBuySignal += 1;
        continue;
      }

      const entryPrice = item.price;
      const exitPrice = item.nextPrice!;
      const requiredCapital = entryPrice * LOT_SIZE;

      // 日本株の通常の100株単位を前提。信用取引・追加資金は使わない。
      if (requiredCapital > capital) {
        skippedInsufficientFunds += 1;
        continue;
      }

      const profitYen = Math.round((exitPrice - entryPrice) * LOT_SIZE);
      capital += profitYen;

      trades.push({
        date: item.date,
        entryPrice,
        exitPrice,
        shares: LOT_SIZE,
        profitYen,
        capitalAfter: Math.round(capital),
      });
    }

    const realizedProfitYen = Math.round(capital - INITIAL_CAPITAL);
    const returnPercent =
      Math.round((realizedProfitYen / INITIAL_CAPITAL) * 10_000) / 100;

    return NextResponse.json({
      success: true,
      simulation: {
        initialCapital: INITIAL_CAPITAL,
        currentCapital: Math.round(capital),
        realizedProfitYen,
        returnPercent,
        tradeCount: trades.length,
        skippedInsufficientFunds,
        skippedNoBuySignal,
        lotSize: LOT_SIZE,
        buyScoreThreshold: BUY_SCORE,
        trades,
        rules: [
          "元手10万円・追加資金なし",
          "AI POWER 85以上（買い候補・大本命）のみ購入対象",
          "100株単位で購入できる場合のみ取引",
          "保存時価格で購入し、翌営業日価格で全株売却したと仮定",
          "売却後の資金を次の取引へ繰り越す",
          "手数料・税金・スリッページは含めない",
        ],
        limitation:
          "現在保存されている学習データは翌営業日価格ベースのため、利確・損切りライン到達までの保有を再現した実運用バックテストではありません。",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "capital simulation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
