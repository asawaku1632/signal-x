import { NextRequest, NextResponse } from "next/server";
import { runAutoLearning } from "@/app/lib/learning/autoLearningRunner";
import { createCronLearningLog } from "@/app/lib/learning/cronLearningLogRepository";
import { runEvolutionLogger } from "@/app/lib/learning/evolutionLogger";
import { createEvolutionSummaryFromLatestLog } from "@/app/lib/evolution/evolutionSummaryRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBUG_VERSION = "V24_5_DAILY_LEARNING_CRON_SUMMARY_0710";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  const userAgent = request.headers.get("user-agent") ?? "";
  const isVercelCron = userAgent.toLowerCase().includes("vercel-cron");

  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  const querySecret = request.nextUrl.searchParams.get("secret") ?? "";

  if (cronSecret) {
    return (
      bearerToken === cronSecret ||
      querySecret === cronSecret ||
      isVercelCron
    );
  }

  return process.env.NODE_ENV !== "production";
}

function toSafeNumber(value: string | null, fallback: number): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

export async function GET(request: NextRequest) {
  const limit = toSafeNumber(request.nextUrl.searchParams.get("limit"), 300);
  const minSampleCount = toSafeNumber(
    request.nextUrl.searchParams.get("minSampleCount"),
    3
  );

  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          success: false,
          debugVersion: DEBUG_VERSION,
          checkedAt: new Date().toISOString(),
          error: "Unauthorized cron request",
        },
        { status: 401 }
      );
    }

    const report = await runAutoLearning({
      mode: "execute",
      judgeLimit: Number.isFinite(limit) ? limit : 300,
      minSampleCount: Number.isFinite(minSampleCount) ? minSampleCount : 3,
    });

    const savedLog = await createCronLearningLog({
      status: "SUCCESS",
      debugVersion: DEBUG_VERSION,
      mode: "execute",
      judgeLimit: report.judgeLimit,
      minSampleCount: report.minSampleCount,
      processedCount: report.summary.processedCount,
      updatedCount: report.summary.updatedCount,
      winCount: report.summary.winCount,
      loseCount: report.summary.loseCount,
      holdCount: report.summary.holdCount,
      unknownCount: report.summary.unknownCount,
      errorCount: report.summary.errorCount,
      weightRuleUpsertedCount: report.summary.weightRuleUpsertedCount,
      rawReport: report,
    });

    const evolutionLog = await runEvolutionLogger({
      mode: "execute",
      minJudgedCount: 5,
      weightLimit: 100,
      minSampleCount,
    });

    const evolutionSummary = await createEvolutionSummaryFromLatestLog();

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      checkedAt: new Date().toISOString(),
      schedule: "Weekdays 15:40 JST / 06:40 UTC",
      autoLearning: report,
      summary: report.summary,
      savedLog,
      evolutionLog,
      evolutionSummary,
      nextAction:
        "Daily Learning → Cron Log → Evolution Log → Evolution Summary 完了。",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "daily learning cron failed";

    let savedLog = null;

    try {
      savedLog = await createCronLearningLog({
        status: "ERROR",
        debugVersion: DEBUG_VERSION,
        mode: "execute",
        judgeLimit: Number.isFinite(limit) ? limit : 300,
        minSampleCount: Number.isFinite(minSampleCount) ? minSampleCount : 3,
        processedCount: 0,
        updatedCount: 0,
        winCount: 0,
        loseCount: 0,
        holdCount: 0,
        unknownCount: 0,
        errorCount: 1,
        weightRuleUpsertedCount: 0,
        errorMessage: message,
        rawReport: { error: message },
      });
    } catch {
      savedLog = null;
    }

    return NextResponse.json(
      {
        success: false,
        debugVersion: DEBUG_VERSION,
        checkedAt: new Date().toISOString(),
        error: message,
        savedLog,
      },
      { status: 500 }
    );
  }
}