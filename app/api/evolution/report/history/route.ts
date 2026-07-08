import { NextResponse } from "next/server";
import { getEvolutionHistory } from "@/app/lib/evolution/evolutionSummaryRepository";
import { getRecentCronLearningLogs } from "@/app/lib/learning/cronLearningLogRepository";
import { generateAiComment } from "@/app/lib/evolution/generateAiComment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBUG_VERSION = "V26_4_AI_REPORT_HISTORY_COMPARE_0708";

export async function GET() {
  try {
    const summaries = await getEvolutionHistory(30);
    const cronLogs = await getRecentCronLearningLogs(30);

    const reports = summaries.map((summary, index) => {
      const summaryDate = String(summary.createdAt).slice(0, 10);
     const candidate = summaries[index + 1] ?? null;

const previousSummary =
  candidate &&
  String(candidate.createdAt).slice(0, 10) !==
    String(summary.createdAt).slice(0, 10)
    ? candidate
    : null;

      const matchedCron =
        cronLogs.find(
          (log) => String(log.createdAt).slice(0, 10) === summaryDate
        ) ?? null;

      const previousCron =
        previousSummary
          ? cronLogs.find(
              (log) =>
                String(log.createdAt).slice(0, 10) ===
                String(previousSummary.createdAt).slice(0, 10)
            ) ?? null
          : null;

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
        previous: previousSummary
          ? {
              qualityScore: previousSummary.qualityScore,
              overallWinRate: previousSummary.overallWinRate,
              processedCount: previousCron?.processedCount ?? 0,
              patternCount: previousSummary.patternCount,
              changedWeight: previousSummary.changedCount,
            }
          : null,
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

    const latestByDate = new Map<string, (typeof reports)[number]>();

    for (const report of reports) {
      latestByDate.set(report.date, report);
    }

    const sortedReports = Array.from(latestByDate.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      count: sortedReports.length,
      reports: sortedReports,
    });
  } catch (error) {
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