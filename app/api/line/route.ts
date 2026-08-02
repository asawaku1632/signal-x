import { saveNotificationLog } from "@/app/lib/notificationLog";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { withSingleLineBrand } from "@/app/lib/line/brand";
import { getPublicBaseUrl } from "@/app/lib/publicBaseUrl";
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

function powerStars(score: number) {
  const filled = Math.max(1, Math.min(5, Math.ceil(score / 20)));
  return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`;
}

function rankLabel(score: number) {
  if (score >= 95) return "Sランク・超激熱候補";
  if (score >= 85) return "Aランク・激熱候補";
  if (score >= 70) return "Bランク・注目候補";
  if (score >= 50) return "Cランク・監視候補";
  return "Dランク・見送り";
}

function analysisPointLines(reason: string) {
  const points = reason
    .split(/\r?\n|[。！!｜・]+/u)
    .map((point) => point.trim())
    .filter(Boolean);

  return points.map((point) => `✅ ${point}`).join("\n");
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

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "LINE token is missing" },
        { status: 500 }
      );
    }

    const baseUrl = getPublicBaseUrl();

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

    const message = withSingleLineBrand(
      `🔥 買いシグナル発生！\n` +
      `━━━━━━━━━━━━━━\n` +
      `🟢 ${bestStock.code}\n` +
      `${bestStock.name}\n\n` +
      `${powerStars(score)}\n` +
      `⚡ AI POWER ${score}\n` +
      `🔥 ${rankLabel(score)}\n` +
      `${judgeLabel(score)}\n\n` +
      `🛡️ 信頼度　${score}%\n` +
      `💹 現在値　${yen(price)}\n` +
      `💰 必要資金　${yen(requiredMoney)}（100株）\n\n` +
      `🎯【利確目標】\n` +
      `${yen(takeProfit)}　想定利益 +${yen(expectedProfit)}\n\n` +
      `🛡️【損切ライン】\n` +
      `${yen(stopLoss)}　想定損失 -${yen(expectedLoss)}\n\n` +
      `🤖【AI分析ポイント】\n` +
      `${analysisPointLines(shortReason(bestStock))}\n\n` +
      `👇【詳細なAI分析はこちら】\n` +
      `${baseUrl}/analysis/${bestStock.code}`,
    );

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
