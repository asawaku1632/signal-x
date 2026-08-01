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
const FETCH_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 3;

function lineLog(stage: string, details?: unknown) {
  if (details === undefined) {
    console.info(`[LINE] ${stage}`);
    return;
  }

  console.info(`[LINE] ${stage}`, details);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url: string, init: RequestInit, label: string) {
  let lastError: unknown;
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      lastResponse = response;

      if (response.ok || (response.status < 500 && response.status !== 429)) {
        return response;
      }

      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    lineLog(`${label} retry`, { attempt, maxAttempts: MAX_ATTEMPTS });
    if (attempt < MAX_ATTEMPTS) await delay(500 * attempt);
  }

  if (lastResponse) return lastResponse;

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed after ${MAX_ATTEMPTS} attempts`);
}

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

async function sendLine(message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    return {
      ok: false,
      status: 500,
      text: "LINE token missing",
    };
  }

  const res = await fetchWithRetry(
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
    },
    "LINE API"
  );

  const text = await res.text();

  return {
    ok: res.ok,
    status: res.status,
    text,
  };
}

export async function GET(req: Request) {
  lineLog("Cron Started", {
    requestedAt: new Date().toISOString(),
    userAgent: req.headers.get("user-agent"),
  });

  await saveCronRunLog({
    route: CRON_ROUTE,
    status: "STARTED",
    message: "LINE通知Cronを開始しました",
    details: {
      requestedAt: new Date().toISOString(),
      userAgent: req.headers.get("user-agent"),
      vercelCron: req.headers.get("x-vercel-cron"),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      hasLineAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      hasLineChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
    },
  });

  try {
    const configuredBaseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      PUBLIC_URL;
    const baseUrl = configuredBaseUrl.replace(/\/$/, "");
    const rankingUrl = `${baseUrl}/api/ranking`;

    const res = await fetchWithRetry(rankingUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }, "Ranking API");

    const rankingBody = await res.text();
    const contentType = res.headers.get("content-type") ?? "";

    if (!res.ok || !contentType.includes("application/json")) {
      lineLog("Scan Failed", {
        httpStatus: res.status,
        contentType,
        responseBody: rankingBody.slice(0, 1000),
      });
      await saveCronRunLog({
        route: CRON_ROUTE,
        status: "ERROR",
        message: "ランキングAPIの取得に失敗しました",
        httpStatus: res.status,
        details: {
          rankingUrl,
          contentType,
          responseBody: rankingBody.slice(0, 1000),
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

    let json: { ranking?: Stock[]; totalStockList?: number };
    try {
      json = JSON.parse(rankingBody) as typeof json;
    } catch (error) {
      throw new Error(
        `Ranking API returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const ranking: Stock[] = json.ranking || [];

    lineLog("Scan Finished", { rankingCount: ranking.length });

    await saveCronRunLog({
      route: CRON_ROUTE,
      status: "SCAN_FINISHED",
      message: "ランキングデータの取得と解析が完了しました",
      httpStatus: res.status,
      details: { rankingUrl, rankingCount: ranking.length },
    });

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
        const medal =
          index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";

        const stockScore = aiScore(stock);
        const stockWinRate = winRateText(stockScore);
        const analysisUrl =
          `${PUBLIC_URL}/analysis/${stock.code}`;

        return (
          `${medal} ${stock.code} ${stock.name}\n` +
          `　AI POWER ${stockScore}｜勝率予測 ${stockWinRate}%\n` +
          `　${tradeDecision(stockScore)} ${powerStars(stockScore)}\n` +
          `　🔎 詳細AI分析\n` +
          `${analysisUrl}`
        );
      })
      .join("\n\n");

    const message =
      `🏆 本日のAIランキング1位\n` +
      `━━━━━━━━━━━━━━\n` +
      `🥇 ${top.code} ${top.name}\n` +
      `🔥 ${rankLabel(score)}\n` +
      `${powerStars(score)}  AI POWER ${score}\n\n` +
      `🛡️ 信頼度　${score}%\n` +
      `📈 勝率予測　${winRate}%\n` +
      `👑 AI順位　${rankText}\n\n` +
      `💹 現在値　${yen(price)}\n` +
      `💰 必要資金　${yen(requiredMoney)}（100株）\n\n` +
      `🎯 利確目標　${yen(takeProfit)}\n` +
      `　想定利益　+${yen(expectedProfit)}\n` +
      `🛡️ 損切ライン　${yen(stopLoss)}\n` +
      `　想定損失　-${yen(expectedLoss)}\n\n` +
      `🤖 AI分析ポイント\n` +
      `${top.reason || "AI理由なし"}\n\n` +
      `👇 詳細なAI分析はこちら\n` +
      `${PUBLIC_URL}/analysis/${top.code}\n\n` +
      `━━━━━━━━━━━━━━\n` +
      `📊 今日のAIランキング TOP3\n` +
      `━━━━━━━━━━━━━━\n` +
      `${top3}\n\n` +
      `ランキングをもっと見る\n` +
      `${PUBLIC_URL}/ranking`;

    lineLog("Message Generated", {
      topCode: top.code,
      messageLength: message.length,
    });
    await saveCronRunLog({
      route: CRON_ROUTE,
      status: "MESSAGE_GENERATED",
      message: "LINE通知メッセージを生成しました",
      details: { topCode: top.code, messageLength: message.length },
    });

    const line = await sendLine(message);

    lineLog("LINE API Response", {
      httpStatus: line.status,
      responseBody: line.text,
    });
    await saveCronRunLog({
      route: CRON_ROUTE,
      status: "LINE_API_RESPONSE",
      message: "LINE APIからレスポンスを受信しました",
      httpStatus: line.status,
      details: { responseBody: line.text },
    });

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

    lineLog("Completed", { httpStatus: line.status, topCode: top.code });
    await saveCronRunLog({
      route: CRON_ROUTE,
      status: "COMPLETED",
      message: "LINE通知Cronが正常完了しました",
      httpStatus: line.status,
      details: { topCode: top.code, rankingCount: ranking.length },
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

    console.error("[LINE] Failed", error);

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
