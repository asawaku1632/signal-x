import { NextResponse } from "next/server";
import {
  getEvolutionHistory,
  getLatestEvolutionSummary,
} from "@/app/lib/evolution/evolutionSummaryRepository";
import { getRecentCronLearningLogs } from "@/app/lib/learning/cronLearningLogRepository";
import { generateAiComment } from "@/app/lib/evolution/generateAiComment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBUG_VERSION = "V26_4_AI_DAILY_REPORT_COMPARE_0708";

export async function GET() {
  try {
    const latest = await getLatestEvolutionSummary();
    const history = await getEvolutionHistory(2);

    const cronLogs = await getRecentCronLearningLogs(2);
    const latestCron = cronLogs[0] ?? null;
    const previousCron = cronLogs[1] ?? null;

    // 最新データが無ければ終了
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

    // 同じ営業日は比較対象にしない
    const previous =
      history[1] &&
      String(history[1].createdAt).slice(0, 10) !==
        String(latest.createdAt).slice(0, 10)
        ? history[1]
        : null;

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
      previous: previous
        ? {
            qualityScore: previous.qualityScore,
            overallWinRate: previous.overallWinRate,
            processedCount: previousCron?.processedCount ?? 0,
            patternCount: previous.patternCount,
            changedWeight: previous.changedCount,
          }
        : null,
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
        previous: previous
          ? {
              date: previous.createdAt,
              qualityScore: previous.qualityScore,
              overallWinRate: previous.overallWinRate,
              processedCount: previousCron?.processedCount ?? 0,
              patternCount: previous.patternCount,
              changedWeight: previous.changedCount,
            }
          : null,
      },
      nextAction:
        "V26.4: 前日比較を含むAI成長レポートを生成しました。",
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