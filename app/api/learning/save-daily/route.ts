import { NextResponse } from "next/server";

import pool from "@/app/lib/postgres";
import { saveDailyStocks } from "@/app/lib/dailyLearning";
import { saveSectorLearning } from "@/app/lib/sectorLearning";
import { saveMarketLearning } from "@/app/lib/marketLearning";
import { saveExperienceLearning } from "@/app/lib/experienceLearning";
import { getAdminSession } from "@/app/lib/admin";
import { saveCronRunLog } from "@/app/lib/cronRunLog";
import { sendLine } from "@/app/lib/line/sendLine";
import { isJstBusinessDay } from "@/app/lib/learning/learningSaveStatus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const SCAN_TIMEOUT_MS = 125_000;
const DEBUG_VERSION = "SAVE_DAILY_V2_JST_DIAGNOSTICS";

type PatternLearning = {
  rsiBand?: string;
  trendKey?: string;
  ema20Key?: string;
  vwapKey?: string;
  macdKey?: string;
  patternKey?: string;
};

type Stock = {
  code: string;
  name: string;
  score?: number;
  aiPower?: number;
  price?: number;
  changePercent?: number;
  result?: string;
  patternLearning?: PatternLearning;
  patternKey?: string;
};

type SaveStage =
  | "authorization"
  | "scan"
  | "scan-response"
  | "daily-stock-save"
  | "related-learning-save"
  | "completed";

function getJstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";

  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    return true;
  }

  const { isAdmin } = await getAdminSession();
  return isAdmin;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logSaveDaily(
  runId: string,
  stage: SaveStage,
  details: Record<string, unknown> = {},
) {
  console.info(
    JSON.stringify({
      service: "save-daily-learning",
      debugVersion: DEBUG_VERSION,
      runId,
      stage,
      loggedAt: new Date().toISOString(),
      ...details,
    }),
  );
}

async function notifySaveFailure(input: {
  runId: string;
  targetDate: string;
  stage: SaveStage;
  fetchedCount: number;
  savedCount: number;
  reason: string;
}) {
  const message = [
    "⚠ AI学習保存失敗",
    `対象日: ${input.targetDate}`,
    `停止箇所: ${input.stage}`,
    `scan取得: ${input.fetchedCount}件`,
    `日次保存: ${input.savedCount}件`,
    `理由: ${input.reason}`,
    `実行ID: ${input.runId}`,
  ].join("\n");

  try {
    const line = await sendLine(message);
    await saveCronRunLog({
      route: "/api/learning/save-daily",
      status: line.ok ? "LINE_SUCCESS" : "LINE_FAILED",
      message: line.ok
        ? "AI学習保存失敗をLINE通知しました"
        : "AI学習保存失敗のLINE通知に失敗しました",
      httpStatus: line.status,
      details: {
        runId: input.runId,
        targetDate: input.targetDate,
        stage: input.stage,
        lineError: line.ok ? null : line.text.slice(0, 500),
      },
    });
  } catch (lineError) {
    await saveCronRunLog({
      route: "/api/learning/save-daily",
      status: "LINE_FAILED",
      message: "AI学習保存失敗のLINE通知で例外が発生しました",
      details: {
        runId: input.runId,
        targetDate: input.targetDate,
        stage: input.stage,
        lineError: errorMessage(lineError),
      },
    });
  }
}

async function savePatternLearningLogs(stocks: Stock[]) {
  const targets = stocks.filter((stock) => {
    return (
      stock.code &&
      stock.name &&
      stock.patternKey &&
      stock.patternLearning &&
      typeof (stock.aiPower ?? stock.score) === "number" &&
      typeof stock.price === "number"
    );
  });

  if (targets.length === 0) {
    return {
      patternAdded: 0,
    };
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];

  targets.forEach((stock, index) => {
    const base = index * 10;
    const pattern = stock.patternLearning!;

    values.push(
      stock.code,
      stock.name,
      stock.patternKey,
      pattern.rsiBand ?? null,
      pattern.macdKey ?? null,
      pattern.vwapKey ?? null,
      pattern.ema20Key ?? null,
      pattern.trendKey ?? null,
      stock.aiPower ?? stock.score,
      stock.price
    );

    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
        base + 5
      }, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${
        base + 10
      })`
    );
  });

  await pool.query(
    `
    INSERT INTO pattern_learning_logs (
      code,
      name,
      pattern_key,
      rsi_band,
      macd_key,
      vwap_key,
      ema20_key,
      trend_key,
      ai_power,
      entry_price
    )
    VALUES ${placeholders.join(",")}
    `,
    values
  );

  return {
    patternAdded: targets.length,
  };
}
export async function GET(req: Request) {
  const startedAt = Date.now();
  const runId = crypto.randomUUID();
  const targetDate = getJstDateString();
  let stage: SaveStage = "authorization";
  let fetchedCount = 0;
  let savedCount = 0;

  try {
    if (!(await isAuthorized(req))) {
      logSaveDaily(runId, stage, { targetDate, success: false });
      return NextResponse.json(
        {
          success: false,
          debugVersion: DEBUG_VERSION,
          runId,
          stage,
          targetDate,
          fetchedCount,
          savedCount: 0,
          failureReason: "Unauthorized cron request",
        },
        { status: 401 },
      );
    }

    if (!isJstBusinessDay()) {
      return NextResponse.json(
        {
          success: false,
          debugVersion: DEBUG_VERSION,
          runId,
          stage,
          targetDate,
          fetchedCount,
          savedCount,
          failureReason: "Non-business day",
        },
        { status: 409 },
      );
    }

    await saveCronRunLog({
      route: "/api/learning/save-daily",
      status: "STARTED",
      message: "AI学習の日次保存を開始しました",
      details: { runId, targetDate, stage },
    });

    const existingResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM daily_stock_results WHERE date = $1`,
      [targetDate],
    );
    const existingCount = Number(existingResult.rows[0]?.count ?? 0);

    if (existingCount > 0) {
      stage = "completed";
      await saveCronRunLog({
        route: "/api/learning/save-daily",
        status: "COMPLETED",
        message: "本日の銘柄スナップショットは保存済みです",
        httpStatus: 200,
        details: {
          runId,
          targetDate,
          stage,
          savedCount: existingCount,
          alreadySaved: true,
        },
      });

      return NextResponse.json({
        success: true,
        debugVersion: DEBUG_VERSION,
        runId,
        stage,
        targetDate,
        date: targetDate,
        fetchedCount: 0,
        stockCount: existingCount,
        savedCount: 0,
        skippedCount: existingCount,
        existingCount,
        alreadySaved: true,
        failureReason: null,
        durationMs: Date.now() - startedAt,
      });
    }

    const scanUrl = new URL("/api/scan?limit=1000", req.url);
    stage = "scan";
    logSaveDaily(runId, stage, { targetDate, scanUrl: scanUrl.pathname });

    const scanRes = await fetch(scanUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    });

    if (!scanRes.ok) {
      const responseText = await scanRes.text().catch(() => "");
      logSaveDaily(runId, stage, {
        targetDate,
        success: false,
        scanStatus: scanRes.status,
        scanError: responseText.slice(0, 500),
      });
      throw new Error(`scan api failed: ${scanRes.status}`);
    }

    stage = "scan-response";
    const scanJson = await scanRes.json();

    const stocks: Stock[] = Array.isArray(scanJson?.stocks)
      ? scanJson.stocks
      : [];
    fetchedCount = stocks.length;

    if (fetchedCount === 0) {
      throw new Error("scan api returned no stocks");
    }

    await saveCronRunLog({
      route: "/api/learning/save-daily",
      status: "SCAN_FINISHED",
      message: "全銘柄scanの取得が完了しました",
      httpStatus: scanRes.status,
      details: { runId, targetDate, stage, fetchedCount },
    });

    // 銘柄学習
    stage = "daily-stock-save";
    const result = await saveDailyStocks(targetDate, stocks);
    savedCount = result.added;
    logSaveDaily(runId, stage, {
      targetDate,
      fetchedCount,
      savedCount,
      skippedCount: result.skipped,
    });
    await saveCronRunLog({
      route: "/api/learning/save-daily",
      status: "SAVE_SUCCESS",
      message: "日次銘柄スナップショットを保存しました",
      details: {
        runId,
        targetDate,
        stage,
        fetchedCount,
        savedCount,
        skippedCount: result.skipped,
      },
    });

    stage = "related-learning-save";
    // パターン学習
    const patternResult = await savePatternLearningLogs(stocks);

    // セクター学習（V7）
    const sectorResult = await saveSectorLearning(targetDate, stocks);

    // 市場学習（V8）
    const marketResult = await saveMarketLearning({
      tradeDate: targetDate,
      stocks,
    });

    // 経験学習（V9）
    const experienceResult = await saveExperienceLearning({
      tradeDate: targetDate,
      stocks,
      marketPattern: marketResult.market.marketPattern,
    });

    stage = "completed";
    logSaveDaily(runId, stage, {
      targetDate,
      fetchedCount,
      savedCount,
      skippedCount: result.skipped,
      durationMs: Date.now() - startedAt,
      success: true,
    });
    await saveCronRunLog({
      route: "/api/learning/save-daily",
      status: "COMPLETED",
      message: "AI学習の日次保存が正常完了しました",
      httpStatus: 200,
      details: {
        runId,
        targetDate,
        stage,
        fetchedCount,
        savedCount,
        skippedCount: result.skipped,
        durationMs: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      runId,
      stage,
      targetDate,
      date: targetDate,
      fetchedCount,
      stockCount: fetchedCount,
      savedCount,
      skippedCount: result.skipped,
      failureReason: null,
      durationMs: Date.now() - startedAt,

      ...result,
      ...patternResult,
      ...sectorResult,
      ...marketResult,
      ...experienceResult,
    });
  } catch (error: unknown) {
    const message = errorMessage(error);
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    logSaveDaily(runId, stage, {
      targetDate,
      fetchedCount,
      savedCount,
      success: false,
      timedOut,
      failureReason: message,
      durationMs: Date.now() - startedAt,
    });

    await saveCronRunLog({
      route: "/api/learning/save-daily",
      status: "ERROR",
      message: "AI学習の日次保存に失敗しました",
      httpStatus: timedOut ? 504 : stage.startsWith("scan") ? 502 : 500,
      details: {
        runId,
        targetDate,
        stage,
        fetchedCount,
        savedCount,
        timedOut,
        failureReason: message,
        durationMs: Date.now() - startedAt,
      },
    });
    await notifySaveFailure({
      runId,
      targetDate,
      stage,
      fetchedCount,
      savedCount,
      reason: message,
    });

    return NextResponse.json(
      {
        success: false,
        debugVersion: DEBUG_VERSION,
        runId,
        stage,
        targetDate,
        fetchedCount,
        savedCount,
        timedOut,
        failureReason: message,
      },
      { status: timedOut ? 504 : stage.startsWith("scan") ? 502 : 500 },
    );
  }
}
