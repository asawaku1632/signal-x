import { NextResponse } from "next/server";
import { getLatestEvolutionSummary } from "@/app/lib/evolution/evolutionSummaryRepository";
import { getRecentCronLearningLogs } from "@/app/lib/learning/cronLearningLogRepository";
import { generateAiComment } from "@/app/lib/evolution/generateAiComment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBUG_VERSION = "V26_AI_DAILY_REPORT_0707";

export async function GET() {
  try {
    const latest = await getLatestEvolutionSummary();
    const cronLogs = await getRecentCronLearningLogs(1);
    const latestCron = cronLogs[0] ?? null;

    if (!latest) {
      return NextResponse.json(
        {
          success: false,
          debugVersion: DEBUG_VERSION,
          checkedAt: new Date().toISOString(),
          error: "AI成長サマリーがまだありません。",
        },
        { status: 404 }
      );
    }

    const processedCount = latestCron?.processedCount ?? 0;
    const winCount = latestCron?.winCount ?? 0;
    const loseCount = latestCron?.loseCount ?? 0;
    const holdCount = latestCron?.holdCount ?? 0;

    const comment = generateAiComment({
      qualityScore: latest.qualityScore,
      overallWinRate: latest.overallWinRate,
      processedCount,
      winCount,
      loseCount,
      holdCount,
      changedWeight: latest.changedCount,
      patternCount: latest.patternCount,
    });

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      checkedAt: new Date().toISOString(),
      report: {
        date: latest.createdAt,
        qualityScore: latest.qualityScore,
        qualityLabel: latest.qualityLabel,
        overallWinRate: latest.overallWinRate,
        judgedRecords: latest.judgedRecords,
        patternCount: latest.patternCount,
        activeWeightRules: latest.activeWeightRules,
        changedWeight: latest.changedCount,
        cronStatus: latest.cronStatus,
        processedCount,
        winCount,
        loseCount,
        holdCount,
        comment,
      },
      nextAction: "次は /admin/evolution/report でAI成長レポート画面を作ります。",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        debugVersion: DEBUG_VERSION,
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "AI成長レポート生成に失敗しました。",
      },
      { status: 500 }
    );
  }
}