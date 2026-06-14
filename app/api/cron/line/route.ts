import { NextResponse } from "next/server";

type Stock = {
  code: string;
  name: string;
  price?: number;
  score?: number;
  aiPower?: number;
  takeProfit?: number;
  stopLoss?: number;
  reason?: string;
};

function yen(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function aiScore(stock: Stock) {
  return stock.score ?? stock.aiPower ?? 0;
}

function tradeDecision(score = 0) {
  if (score >= 85) return "🟢 買い";
  if (score >= 70) return "🟡 押し目待ち";
  return "🔴 見送り";
}

async function sendLine(message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    return {
      ok: false,
      status: 500,
      text: "LINE token missing",
    };
  }

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

  return {
    ok: res.ok,
    status: res.status,
    text,
  };
}

export async function GET() {
  try {
   const baseUrl = "http://localhost:3000";
const publicUrl = "https://signal-x-ppjg.vercel.app";

    const res = await fetch(`${baseUrl}/api/ranking`, {
      cache: "no-store",
    });

    const json = await res.json();
    const ranking: Stock[] = json.ranking || [];

    if (ranking.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "ランキング対象なし",
      });
    }

    const top = ranking[0];
    const score = aiScore(top);
    const price = top.price ?? 0;
    const takeProfit =
      top.takeProfit ?? Math.round(price * 1.03);
    const stopLoss =
      top.stopLoss ?? Math.round(price * 0.98);
    const requiredMoney = price * 100;
    const expectedProfit = (takeProfit - price) * 100;
    const expectedLoss = (price - stopLoss) * 100;

    const top3 = ranking
      .slice(0, 3)
      .map((stock, index) => {
        const rank = index === 0 ? "①" : index === 1 ? "②" : "③";
        const s = aiScore(stock);

        return `${rank} ${stock.code} ${stock.name}\n信頼度 ${s}% / ${tradeDecision(
          s
        )}`;
      })
      .join("\n\n");

    const message =
      `━━━━━━━━━━━━━━\n` +
      `🏆 本日の大本命\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `${top.code} ${top.name}\n\n` +
      `${tradeDecision(score)}\n` +
      `信頼度 ${score}%\n\n` +
      `現在値 ${yen(price)}\n` +
      `成行100株 ${yen(requiredMoney)}\n\n` +
      `🎯 利確 ${yen(takeProfit)}\n` +
      `想定利益 +${yen(expectedProfit)}\n\n` +
      `🛡 損切 ${yen(stopLoss)}\n` +
      `想定損失 -${yen(expectedLoss)}\n\n` +
      `理由：${top.reason || "AI理由なし"}\n\n` +
      `👇 個別AI解析\n` +
      `${publicUrl}/analysis/${top.code}\n\n` +
      `━━━━━━━━━━━━━━\n` +
      `TOP3\n\n` +
      `${top3}\n` +
      `━━━━━━━━━━━━━━`;

    const line = await sendLine(message);

    return NextResponse.json({
      success: line.ok,
      status: line.status,
      response: line.text,
      top,
      rankingCount: ranking.length,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "cron line ranking failed",
      },
      {
        status: 500,
      }
    );
  }
}