import { NextResponse } from "next/server";

type Stock = {
  code: string;
  name: string;
  score: number;
  rsi?: number;
  volumeRatio?: number;
  changePercent?: number;
  reason?: string;
};

const COOLDOWN_MINUTES = 30;

declare global {
  var signalxLastAlerts:
    | Record<string, number>
    | undefined;
}

function judge(score: number) {
  if (score >= 85) return "激熱🔥";
  if (score >= 70) return "本命🔥";
  return "監視";
}

function marketComment(stocks: Stock[]) {
  if (stocks.length >= 5) {
    return "今日は強いシグナルが複数出ています。無理せず上位だけ監視。";
  }

  if (stocks.length >= 1) {
    return "激熱候補あり。焦らず条件確認。";
  }

  return "今は大本命なし。無理に触らない。";
}

export async function GET() {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "LINE token is missing" },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://signal-x-ppjg.vercel.app";

    const scanRes = await fetch(`${baseUrl}/api/scan`, {
      cache: "no-store",
    });

    const scanJson = await scanRes.json();
    const stocks: Stock[] = scanJson.stocks || [];

    const hotStocks = stocks
      .filter((stock) => stock.score >= 85)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (hotStocks.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "AI POWER 85以上なし",
      });
    }

    if (!globalThis.signalxLastAlerts) {
      globalThis.signalxLastAlerts = {};
    }

    const now = Date.now();

    const notifyStocks = hotStocks.filter((stock) => {
      const last = globalThis.signalxLastAlerts?.[stock.code];

      if (!last) return true;

      const diffMinutes = (now - last) / 1000 / 60;

      return diffMinutes >= COOLDOWN_MINUTES;
    });

    if (notifyStocks.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "30分以内に同じ銘柄を通知済み",
      });
    }

    for (const stock of notifyStocks) {
      globalThis.signalxLastAlerts[stock.code] = now;
    }

    const rankingText = notifyStocks
      .map((stock, index) => {
        return (
          `${index + 1}位 ${stock.name} (${stock.code})\n` +
          `AI POWER: ${stock.score}\n` +
          `判定: ${judge(stock.score)}\n` +
          `理由: ${stock.reason || "シグナル理由なし"}\n` +
          `RSI: ${stock.rsi ?? "-"} / 出来高: ${stock.volumeRatio ?? "-"}x / 変化率: ${stock.changePercent ?? "-"}%\n` +
          `${baseUrl}/analysis/${stock.code}`
        );
      })
      .join("\n\n----------------\n\n");

    const message =
      `🚨 SIGNALX AUTO ALERT\n\n` +
      `AI POWER 85以上を検出しました。\n\n` +
      `【本日の総評】\n` +
      `${marketComment(notifyStocks)}\n\n` +
      `【激熱TOP${notifyStocks.length}】\n\n` +
      `${rankingText}\n\n` +
      `※同じ銘柄は${COOLDOWN_MINUTES}分以内は再通知しません。`;

    const res = await fetch(
      "https://api.line.me/v2/bot/message/broadcast",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            {
              type: "text",
              text: message,
            },
          ],
        }),
      }
    );

    const text = await res.text();

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      notified: notifyStocks.length,
      stocks: notifyStocks,
      response: text,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false, error: "LINE send failed" },
      { status: 500 }
    );
  }
}