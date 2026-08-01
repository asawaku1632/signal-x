import { NextResponse } from "next/server";
import { saveNotificationLog } from "@/app/lib/notificationLog";

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

function winRateText(score: number) {
  if (score >= 85) return 80;
  if (score >= 70) return 70;
  if (score >= 50) return 60;
  return 45;
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

function analysisPointLines(reason?: string) {
  const points = (reason || "AI理由なし")
    .split(/\r?\n|[。！!｜・]+/u)
    .map((point) => point.trim())
    .filter(Boolean);

  return points.map((point) => `✅ ${point}`).join("\n");
}

async function sendLine(message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    return { ok: false, status: 500, text: "LINE token missing" };
  }

  const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: [{ type: "text", text: message }],
    }),
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;
    const publicUrl = "https://signal-x-ppjg.vercel.app";

    const res = await fetch(`${baseUrl}/api/ranking`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: "ranking api failed", status: res.status },
        { status: 500 }
      );
    }

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
    const takeProfit = top.takeProfit ?? Math.round(price * 1.03);
    const stopLoss = top.stopLoss ?? Math.round(price * 0.98);
    const requiredMoney = price * 100;
    const expectedProfit = (takeProfit - price) * 100;
    const expectedLoss = (price - stopLoss) * 100;
    const winRate = winRateText(score);
    const totalStockList = Number(json.totalStockList) || ranking.length;

    const top3 = ranking
  .slice(0, 3)
  .map((stock, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
    const s = aiScore(stock);

    return `${medal}【${index + 1}位】
${stock.code} ${stock.name}
AI POWER ${s}｜勝率予測 ${winRateText(s)}%
${tradeDecision(s)} ${powerStars(s)}
🔎 詳細AI分析
${publicUrl}/analysis/${stock.code}`;
  })
  .join("\n\n");

    const message = `🏆 本日のAIランキング1位
━━━━━━━━━━━━━━
🥇 ${top.code}
${top.name}

🔥 ${rankLabel(score)}
${powerStars(score)}
⚡ AI POWER ${score}

🛡️ 信頼度　${score}%
📈 勝率予測　${winRate}%
👑 AI順位　1位 / ${totalStockList.toLocaleString("ja-JP")}銘柄中

💹 現在値　${yen(price)}
💰 必要資金　${yen(requiredMoney)}（100株）

🎯【利確目標】
${yen(takeProfit)}　想定利益 +${yen(expectedProfit)}

🛡️【損切ライン】
${yen(stopLoss)}　想定損失 -${yen(expectedLoss)}

🤖【AI分析ポイント】
${analysisPointLines(top.reason)}

👇【詳細なAI分析はこちら】
${publicUrl}/analysis/${top.code}

━━━━━━━━━━━━━━
📊 今日のAIランキング TOP3
━━━━━━━━━━━━━━
${top3}

📊 ランキングをもっと見る
${publicUrl}/ranking

━━━━━━━━━━━━━━
⚡ SIGNALX
AI日本株分析サービス`;

    const line = await sendLine(message);

    let savedLog = null;

    if (line.ok) {
      savedLog = await saveNotificationLog({
        code: top.code,
        name: top.name,
        price,
        aiPower: score,
        judge: tradeDecision(score),
        takeProfit,
        stopLoss,
      });
    }

    return NextResponse.json({
      success: line.ok,
      status: line.status,
      response: line.text,
      top,
      savedLog,
      rankingCount: ranking.length,
    });
  } catch (error: unknown) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "cron line ranking failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
