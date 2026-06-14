import { saveNotificationLog } from "@/app/lib/notificationLog";
import { NextResponse } from "next/server";

type Stock = {
  code: string;
  name: string;
  price?: number;
  score?: number;
  aiPower?: number;
  rsi?: number;
  volumeRatio?: number;
  changePercent?: number;
  reason?: string;
  finalJudge?: string;
  takeProfit?: number;
  stopLoss?: number;
};

const COOLDOWN_MINUTES = 0;
const BUDGET_LIMIT = 1000000;

declare global {
  var signalxLastAlerts: Record<string, number> | undefined;
}

function judgeLabel(score = 0) {
  if (score >= 85) return "🟣 激熱";
  if (score >= 70) return "🟢 強い";
  if (score >= 50) return "🟡 静観";
  return "🔴 見送り";
}

function yen(value?: number) {
  if (!value) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function shortReason(stock: Stock) {
  const reasons: string[] = [];

  if ((stock.rsi ?? 0) >= 45 && (stock.rsi ?? 0) <= 70) {
    reasons.push("RSI良好");
  }

  if ((stock.volumeRatio ?? 0) >= 1.5) {
    reasons.push("出来高急増");
  }

  if (Math.abs(stock.changePercent ?? 0) <= 3) {
    reasons.push("値動き安定");
  }

  if (reasons.length >= 2) {
    return reasons.slice(0, 2).join("｜");
  }

  return stock.reason || "AI監視中";
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
      .filter((stock) => {
        const score = stock.score ?? stock.aiPower ?? 0;
        const price = stock.price ?? 0;
        const requiredMoney = price * 100;

        return score >= 70 && price > 0 && requiredMoney <= BUDGET_LIMIT;
      })
      .sort(
        (a, b) =>
          (b.score ?? b.aiPower ?? 0) - (a.score ?? a.aiPower ?? 0)
      );

    if (hotStocks.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "通知対象なし",
      });
    }

    if (!globalThis.signalxLastAlerts) {
      globalThis.signalxLastAlerts = {};
    }

    const now = Date.now();
    const bestStock = hotStocks[0];
    const score = bestStock.score ?? bestStock.aiPower ?? 0;

    const last = globalThis.signalxLastAlerts[bestStock.code];

    if (last) {
      const diffMinutes = (now - last) / 1000 / 60;

      if (diffMinutes < COOLDOWN_MINUTES) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: `${COOLDOWN_MINUTES}分以内に同じ銘柄を通知済み`,
        });
      }
    }

    globalThis.signalxLastAlerts[bestStock.code] = now;

    const price = bestStock.price ?? 0;
    const takeProfit = bestStock.takeProfit ?? Math.round(price * 1.025);
    const stopLoss = bestStock.stopLoss ?? Math.round(price * 0.97);

    const requiredMoney = price * 100;
    const expectedProfit = (takeProfit - price) * 100;
    const expectedLoss = (price - stopLoss) * 100;

    const message =
  `🔥 ${bestStock.code} ${bestStock.name}\n` +
  `🟢 強い 信頼度${score}%\n` +
  `💴 ${yen(requiredMoney)}\n\n` +

  `現在値 ${yen(price)}\n\n` +

  `成行100株 (${yen(requiredMoney)})\n\n` +

  `🎯 利確\n` +
  `${yen(takeProfit)} (+${yen(expectedProfit)})\n\n` +

  `🛡 損切\n` +
  `${yen(stopLoss)} (-${yen(expectedLoss)})\n\n` +

  `${shortReason(bestStock)}\n\n` +

  `👇 個別AI解析\n` +
  `${baseUrl}/analysis/${bestStock.code}`;
      `${baseUrl}/analysis/${bestStock.code}\n` +
      `━━━━━━━━━━━━━━`;

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

    await saveNotificationLog({
      code: bestStock.code,
      name: bestStock.name,
      price,
      aiPower: score,
      judge: judgeLabel(score),
      takeProfit,
      stopLoss,
    });

    const text = await res.text();

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      notified: 1,
      stock: bestStock,
      message,
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