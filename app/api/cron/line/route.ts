import { NextResponse } from "next/server";

import { saveCronRunLog } from "@/app/lib/cronRunLog";
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

const CRON_ROUTE = "/api/cron/line";
const PUBLIC_URL = "https://signal-x-ppjg.vercel.app";

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

export async function GET(req: Request) {
  await saveCronRunLog({
    route: CRON_ROUTE,
    status: "STARTED",
    message: "LINE通知Cronを開始しました",
    details: {
      requestedAt: new Date().toISOString(),
      userAgent: req.headers.get("user-agent"),
      vercelCron: req.headers.get("x-vercel-cron"),
    },
  });

  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const res = await fetch(`${baseUrl}/api/ranking`, {
      cache: "no-store",
    });

    if (!res.ok) {
      await saveCronRunLog({
        route: CRON_ROUTE,
        status: "ERROR",
        message: "ランキングAPIの取得に失敗しました",
        httpStatus: res.status,
        details: {
          rankingUrl: `${baseUrl}/api/ranking`,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: "ranking api failed",
          status: res.status,
        },
        { status: 500 }
      );
    }

    const json = await res.json();
    const ranking: Stock[] = json.ranking || [];

    await saveCronRunLog({
      route: CRON_ROUTE,
      status: "RANKING_SUCCESS",
      message: "ランキングAPIの取得に成功しました",
      httpStatus: res.status,
      details: {
        rankingCount: ranking.length,
        totalStockList: json.totalStockList ?? null,
      },
    });

    if (ranking.length === 0) {
      await saveCronRunLog({
        route: CRON_ROUTE,
        status: "SKIPPED",
        message: "ランキング対象がないためLINE通知をスキップしました",
      });

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

    const rankText =
      `1位 / ${json.totalStockList ?? 1006}銘柄中`;

    const winRate = winRateText(score);

    const top3 = ranking
      .slice(0, 3)
      .map((stock, index) => {
        const rank =
          index === 0 ? "①" : index === 1 ? "②" : "③";

        const stockScore = aiScore(stock);
        const stockWinRate = winRateText(stockScore);
        const analysisUrl =
          `${PUBLIC_URL}/analysis/${stock.code}`;

        return (
          `${rank} ${stock.code} ${stock.name}\n` +
          `【信頼度】${stockScore}%\n` +
          `【勝率予測】${stockWinRate}%\n` +
          `${tradeDecision(stockScore)}\n` +
          `👇 個別AI解析\n` +
          `${analysisUrl}`
        );
      })
      .join("\n\n");

    const message =
      `【🏆 本日の大本命】\n` +
      `${top.code} ${top.name}\n\n` +
      `${tradeDecision(score)}\n\n` +
      `【信頼度】${score}%\n` +
      `【勝率予測】${winRate}%\n` +
      `【AI順位】${rankText}\n\n` +
      `【現在値】${yen(price)}\n` +
      `【必要資金】${yen(requiredMoney)}\n\n` +
      `【利確】${yen(takeProfit)}\n` +
      `想定利益 +${yen(expectedProfit)}\n\n` +
      `【損切】${yen(stopLoss)}\n` +
      `想定損失 -${yen(expectedLoss)}\n\n` +
      `【理由】\n` +
      `${top.reason || "AI理由なし"}\n\n` +
      `👇 個別AI解析\n` +
      `${PUBLIC_URL}/analysis/${top.code}\n\n` +
      `━━━━━━━━━━━━━━\n` +
      `🔥 TOP3\n\n` +
      `${top3}\n` +
      `━━━━━━━━━━━━━━`;

    const line = await sendLine(message);

    if (!line.ok) {
      await saveCronRunLog({
        route: CRON_ROUTE,
        status: "LINE_FAILED",
        message: "LINE通知の送信に失敗しました",
        httpStatus: line.status,
        details: {
          lineResponse: line.text,
          topCode: top.code,
          topName: top.name,
          rankingCount: ranking.length,
        },
      });

      return NextResponse.json(
        {
          success: false,
          status: line.status,
          response: line.text,
          top,
          rankingCount: ranking.length,
          messagePreview: message,
        },
        { status: 502 }
      );
    }

    await saveCronRunLog({
      route: CRON_ROUTE,
      status: "LINE_SUCCESS",
      message: "LINE通知の送信に成功しました",
      httpStatus: line.status,
      details: {
        topCode: top.code,
        topName: top.name,
        rankingCount: ranking.length,
      },
    });

    let savedLog = null;

    try {
      savedLog = await saveNotificationLog({
        code: top.code,
        name: top.name,
        price,
        aiPower: score,
        judge: tradeDecision(score),
        takeProfit,
        stopLoss,
      });
    } catch (error) {
      console.error("saveNotificationLog failed", error);
    }

    return NextResponse.json({
      success: true,
      status: line.status,
      response: line.text,
      top,
      savedLog,
      rankingCount: ranking.length,
      messagePreview: message,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error(error);

    await saveCronRunLog({
      route: CRON_ROUTE,
      status: "ERROR",
      message: errorMessage,
      httpStatus: 500,
      details: {
        error: errorMessage,
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: "cron line ranking failed",
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}