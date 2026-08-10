import { NextResponse } from "next/server";

import pool from "@/app/lib/postgres";
import { saveDailyStocks } from "@/app/lib/dailyLearning";
import { getAdminSession } from "@/app/lib/admin";
import { saveCronRunLog } from "@/app/lib/cronRunLog";
import { sendLine } from "@/app/lib/line/sendLine";
import { isJstBusinessDay } from "@/app/lib/learning/learningSaveStatus";
import { saveRelatedLearning } from "@/app/lib/relatedLearning";
import {
  releaseDailySaveLock,
  tryAcquireDailySaveLock,
} from "@/app/lib/learning/dailySaveLock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const SCAN_TIMEOUT_MS = 125_000;
const DEBUG_VERSION = "SAVE_DAILY_V2_JST_DIAGNOSTICS";
const SAVE_SCHEDULE_HOUR_JST = 15;
const SAVE_SCHEDULE_MINUTE_JST = 35;

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

type ScanResponseDiagnostics = {
  status: number;
  statusText: string;
  contentType: string;
  finalUrl: string;
  redirected: boolean;
  bodyPreview: string;
  responseKind: string;
};

type AnalysisDiagnostics = {
  targetStockCount: number;
  analyzedSuccessCount: number;
  analyzedFailureCount: number;
  failedStockCodes: string[];
  errorTypes: Record<string, number>;
};

function classifyScanResponse(contentType: string, body: string) {
  const normalized = body.trimStart().toLowerCase();

  if (!body.trim()) return "empty-body";
  if (!normalized.startsWith("<!doctype") && !normalized.startsWith("<html")) {
    return contentType.includes("json") ? "invalid-json" : "non-json";
  }
  if (normalized.includes("deployment_not_found")) return "deployment-not-found";
  if (normalized.includes("application error")) return "application-error";
  if (normalized.includes("vercel authentication") || normalized.includes("_vercel_sso_nonce")) {
    return "vercel-authentication";
  }
  if (normalized.includes("nextauth") || normalized.includes("sign in")) {
    return "authentication-page";
  }
  if (normalized.includes("too many requests") || normalized.includes("rate limit")) {
    return "rate-limit-page";
  }
  if (normalized.includes("gateway timeout") || normalized.includes("timed out")) {
    return "timeout-page";
  }
  if (normalized.includes("404") || normalized.includes("not found")) {
    return "not-found-page";
  }
  if (normalized.includes("500") || normalized.includes("internal server error")) {
    return "server-error-page";
  }
  return "html-page";
}

function diagnosticPreview(body: string) {
  return body
    .slice(0, 500)
    .replace(/((?:token|secret|nonce|code)["'=:\s]+)[^&"'<>\s]+/gi, "$1[masked]");
}

function diagnosticUrl(value: string) {
  try {
    const url = new URL(value);
    for (const key of url.searchParams.keys()) {
      if (/token|secret|nonce|code/i.test(key)) {
        url.searchParams.set(key, "[masked]");
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

function getJstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getScheduledFor(targetDate: string) {
  return `${targetDate}T${String(SAVE_SCHEDULE_HOUR_JST).padStart(2, "0")}:${String(
    SAVE_SCHEDULE_MINUTE_JST,
  ).padStart(2, "0")}:00+09:00`;
}

function getRequestMetadata(request: Request) {
  const url = new URL(request.url);
  return {
    host: request.headers.get("host") ?? url.host,
    deploymentUrl: process.env.VERCEL_URL ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    vercelEnvironment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    vercelId: request.headers.get("x-vercel-id"),
    userAgent: request.headers.get("user-agent"),
    hasVercelCronHeader: request.headers.has("x-vercel-cron"),
  };
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

export async function GET(req: Request) {
  const startedAt = Date.now();
  const receivedAt = new Date(startedAt).toISOString();
  const runId = crypto.randomUUID();
  const targetDate = getJstDateString();
  const scheduledFor = getScheduledFor(targetDate);
  const delaySeconds = Math.max(
    0,
    Math.floor((startedAt - new Date(scheduledFor).getTime()) / 1000),
  );
  const requestMetadata = getRequestMetadata(req);
  let stage: SaveStage = "authorization";
  let fetchedCount = 0;
  let savedCount = 0;
  let conflictCount = 0;
  let analysisDiagnostics: AnalysisDiagnostics | null = null;
  let scanDiagnostics: ScanResponseDiagnostics | null = null;
  let lockAcquired = false;

  await saveCronRunLog({
    route: "/api/learning/save-daily",
    status: "RECEIVED",
    message: "AI learning daily save request received",
    details: {
      runId,
      targetDate,
      scheduledFor,
      receivedAt,
      delaySeconds,
      stage,
      targetStockCount: 0,
      analyzedSuccessCount: 0,
      analyzedFailureCount: 0,
      savedCount: 0,
      conflictCount: 0,
      ...requestMetadata,
    },
  });

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
          scheduledFor,
          receivedAt,
          delaySeconds,
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
          scheduledFor,
          receivedAt,
          delaySeconds,
        },
        { status: 409 },
      );
    }

    const lock = await tryAcquireDailySaveLock(targetDate, runId);
    if (!lock) {
      await saveCronRunLog({
        route: "/api/learning/save-daily",
        status: "SKIPPED",
        message: "AI learning daily save is already running",
        httpStatus: 200,
        details: {
          runId,
          targetDate,
          scheduledFor,
          receivedAt,
          delaySeconds,
          stage,
          reason: "ALREADY_RUNNING",
          durationMs: Date.now() - startedAt,
          ...requestMetadata,
        },
      });
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "ALREADY_RUNNING",
        runId,
        targetDate,
        scheduledFor,
        receivedAt,
        delaySeconds,
        durationMs: Date.now() - startedAt,
      });
    }
    lockAcquired = true;

    await saveCronRunLog({
      route: "/api/learning/save-daily",
      status: "STARTED",
      message: "AI学習の日次保存を開始しました",
      details: {
        runId,
        targetDate,
        scheduledFor,
        receivedAt,
        delaySeconds,
        stage,
        targetStockCount: 0,
        analyzedSuccessCount: 0,
        analyzedFailureCount: 0,
        savedCount: 0,
        conflictCount: 0,
        ...requestMetadata,
      },
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
            scheduledFor,
            receivedAt,
            delaySeconds,
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
    logSaveDaily(runId, stage, {
      targetDate,
      scanUrl: scanUrl.toString(),
      requestOrigin: new URL(req.url).origin,
    });

    const requestCookie = req.headers.get("cookie");

    const scanRes = await fetch(scanUrl, {
      cache: "no-store",
      headers: requestCookie ? { cookie: requestCookie } : undefined,
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    });

    stage = "scan-response";
    const responseText = await scanRes.text();
    const contentType = scanRes.headers.get("content-type") ?? "";
    const isJsonContentType = /(^|\s|;)application\/(?:[^;]+\+)?json(?:\s|;|$)/i.test(
      contentType,
    );
    scanDiagnostics = {
      status: scanRes.status,
      statusText: scanRes.statusText,
      contentType,
      finalUrl: diagnosticUrl(scanRes.url),
      redirected: scanRes.redirected,
      bodyPreview: diagnosticPreview(responseText),
      responseKind: classifyScanResponse(contentType, responseText),
    };

    if (!scanRes.ok) {
      throw new Error(
        `scan api failed: ${scanRes.status} ${scanRes.statusText} (${scanDiagnostics.responseKind})`,
      );
    }
    if (!responseText.trim()) {
      throw new Error("scan api returned an empty response body");
    }
    if (!isJsonContentType) {
      throw new Error(
        `scan api returned non-JSON content: ${contentType || "missing content-type"} (${scanDiagnostics.responseKind})`,
      );
    }

    let scanJson: { stocks?: Stock[]; scanDiagnostics?: AnalysisDiagnostics };
    try {
      scanJson = JSON.parse(responseText) as {
        stocks?: Stock[];
        scanDiagnostics?: AnalysisDiagnostics;
      };
    } catch (parseError) {
      scanDiagnostics.responseKind = "invalid-json";
      throw new Error(`scan api returned invalid JSON: ${errorMessage(parseError)}`);
    }

    const stocks: Stock[] = Array.isArray(scanJson?.stocks)
      ? scanJson.stocks
      : [];
    fetchedCount = stocks.length;
    analysisDiagnostics = scanJson.scanDiagnostics ?? {
      targetStockCount: fetchedCount,
      analyzedSuccessCount: fetchedCount,
      analyzedFailureCount: 0,
      failedStockCodes: [],
      errorTypes: {},
    };

    if (fetchedCount === 0) {
      throw new Error("scan api returned no stocks");
    }

    await saveCronRunLog({
      route: "/api/learning/save-daily",
      status: "SCAN_FINISHED",
      message: "全銘柄scanの取得が完了しました",
      httpStatus: scanRes.status,
      details: {
        runId,
        targetDate,
        stage,
        fetchedCount,
        ...analysisDiagnostics,
        scheduledFor,
        receivedAt,
        delaySeconds,
        scanResponse: scanDiagnostics,
      },
    });

    // 銘柄学習
    stage = "daily-stock-save";
    const result = await saveDailyStocks(targetDate, stocks);
    savedCount = result.added;
    conflictCount = result.conflictCount;
    logSaveDaily(runId, stage, {
      targetDate,
      fetchedCount,
      savedCount,
      skippedCount: result.skipped,
      conflictCount,
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
        conflictCount,
        ...analysisDiagnostics,
        scheduledFor,
        receivedAt,
        delaySeconds,
      },
    });

    stage = "related-learning-save";
    const relatedResult = await saveRelatedLearning(targetDate, stocks);

    stage = "completed";
    logSaveDaily(runId, stage, {
      targetDate,
      fetchedCount,
      savedCount,
      skippedCount: result.skipped,
      conflictCount,
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
        conflictCount,
        ...analysisDiagnostics,
        scheduledFor,
        receivedAt,
        delaySeconds,
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
      ...relatedResult,
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
      conflictCount,
      success: false,
      timedOut,
      failureReason: message,
      scanResponse: scanDiagnostics,
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
        conflictCount,
        ...analysisDiagnostics,
        scheduledFor,
        receivedAt,
        delaySeconds,
        timedOut,
        failureReason: message,
        scanResponse: scanDiagnostics,
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
  } finally {
    if (lockAcquired) {
      try {
        await releaseDailySaveLock(targetDate, runId);
      } catch (unlockError) {
        console.error("Failed to release daily save lock:", unlockError);
      }
    }
  }
}
