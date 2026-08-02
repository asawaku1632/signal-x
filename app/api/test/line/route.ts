import { NextResponse } from "next/server";

import { requireCronAuth } from "@/app/lib/cronAuth";
import { withSingleLineBrand } from "@/app/lib/line/brand";
import { getPublicBaseUrl } from "@/app/lib/publicBaseUrl";

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
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
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

function buildMessage(
  ranking: Stock[],
  totalStockList: number,
  publicUrl: string,
) {
  const top = ranking[0];
  const score = aiScore(top);
  const price = top.price ?? 0;
  const takeProfit = top.takeProfit ?? Math.round(price * 1.03);
  const stopLoss = top.stopLoss ?? Math.round(price * 0.98);
  const requiredMoney = price * 100;
  const expectedProfit = (takeProfit - price) * 100;
  const expectedLoss = (price - stopLoss) * 100;

  const top3 = ranking
    .slice(0, 3)
    .map((stock, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
      const stockScore = aiScore(stock);

      return `${medal}【${index + 1}位】
${stock.code} ${stock.name}
AI POWER ${stockScore}｜勝率予測 ${winRateText(stockScore)}%
${tradeDecision(stockScore)} ${powerStars(stockScore)}
🔎 詳細AI分析
${publicUrl}/analysis/${stock.code}`;
    })
    .join("\n\n");

  return withSingleLineBrand(`🧪 LINE通知テスト

🏆 本日のAIランキング1位
━━━━━━━━━━━━━━
🥇 ${top.code}
${top.name}

🔥 ${rankLabel(score)}
${powerStars(score)}
⚡ AI POWER ${score}

🛡️ 信頼度　${score}%
📈 勝率予測　${winRateText(score)}%
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
${publicUrl}/ranking`);
}

export async function POST(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const testUserId = process.env.LINE_TEST_USER_ID;

  if (!token || !testUserId) {
    return NextResponse.json(
      {
        success: false,
        error: "LINE_CHANNEL_ACCESS_TOKEN or LINE_TEST_USER_ID is not configured",
      },
      { status: 500 },
    );
  }

  const rankingUrl = new URL("/api/ranking", request.url);
  const rankingResponse = await fetch(rankingUrl, { cache: "no-store" });

  if (!rankingResponse.ok) {
    return NextResponse.json(
      { success: false, error: "ranking api failed" },
      { status: 502 },
    );
  }

  const rankingJson = (await rankingResponse.json()) as {
    ranking?: Stock[];
    totalStockList?: number;
  };
  const ranking = rankingJson.ranking ?? [];

  if (ranking.length === 0) {
    return NextResponse.json(
      { success: false, error: "ランキング対象なし" },
      { status: 404 },
    );
  }

  const publicUrl = getPublicBaseUrl();
  const totalStockList =
    Number(rankingJson.totalStockList) || ranking.length;
  const message = buildMessage(ranking, totalStockList, publicUrl);

  const lineResponse = await fetch(
    "https://api.line.me/v2/bot/message/push",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: testUserId,
        messages: [{ type: "text", text: message }],
      }),
    },
  );
  const responseText = await lineResponse.text();

  return NextResponse.json(
    {
      success: lineResponse.ok,
      status: lineResponse.status,
      delivery: "push",
      recipient: "LINE_TEST_USER_ID",
      response: responseText,
    },
    { status: lineResponse.ok ? 200 : 502 },
  );
}
