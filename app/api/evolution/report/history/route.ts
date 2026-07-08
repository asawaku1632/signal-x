import { NextResponse } from "next/server";
import {
  getEvolutionHistory,
} from "@/app/lib/evolution/evolutionSummaryRepository";
import {
  getRecentCronLearningLogs,
} from "@/app/lib/learning/cronLearningLogRepository";
import { generateAiComment } from "@/app/lib/evolution/generateAiComment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBUG_VERSION = "V26_2_AI_REPORT_HISTORY_0708";

export async function GET() {
  try {
    const summaries = await getEvolutionHistory(30);
    const cronLogs = await getRecentCronLearningLogs(30);

    const reports = summaries.map((summary) => {
      const summaryDate = String(summary.createdAt).slice(0, 10);

      const matchedCron =
        cronLogs.find(
          (log) => String(log.createdAt).slice(0, 10) === summaryDate
        ) ?? null;

      const processedCount = matchedCron?.processedCount ?? 0;
      const winCount = matchedCron?.winCount ?? 0;
      const loseCount = matchedCron?.loseCount ?? 0;
      const holdCount = matchedCron?.holdCount ?? 0;

      const comment = generateAiComment({
        qualityScore: summary.qualityScore,
        overallWinRate: summary.overallWinRate,
        processedCount,
        winCount,
        loseCount,
        holdCount,
        changedWeight: summary.changedCount,
        patternCount: summary.patternCount,
      });

      return {
        date: summaryDate,
        learningCount: processedCount,
        winCount,
        loseCount,
        holdCount,
        aiCompletion: summary.qualityScore,
        accuracy: summary.overallWinRate,
        winPatternCount: summary.patternCount,
        improvementCount: summary.changedCount,
        aiComment: comment,
      };
    });

    // 同じ日は最新1件だけ
    const latestByDate = new Map<string, (typeof reports)[number]>();

    for (const report of reports) {
      latestByDate.set(report.date, report);
    }

    const sortedReports = Array.from(latestByDate.values()).sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      count: sortedReports.length,
      reports: sortedReports,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        debugVersion: DEBUG_VERSION,
        error:
          error instanceof Error
            ? error.message
            : "AI成長レポート履歴の取得に失敗しました。",
        reports: [],
      },
      { status: 500 }
    );
  }
}