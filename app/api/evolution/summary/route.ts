import { NextRequest, NextResponse } from "next/server";
import {
  createEvolutionSummaryFromLatestLog,
  getEvolutionHistory,
  getLatestEvolutionSummary,
} from "@/app/lib/evolution/evolutionSummaryRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBUG_VERSION = "V25_AI_EVOLUTION_SUMMARY_API_0707";

function toNumber(value: string | null, fallback: number): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") ?? "read";
    const limit = toNumber(searchParams.get("limit"), 30);

    const created =
      mode === "create" ? await createEvolutionSummaryFromLatestLog() : null;

    const [latest, history] = await Promise.all([
      getLatestEvolutionSummary(),
      getEvolutionHistory(limit),
    ]);

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      checkedAt: new Date().toISOString(),
      mode,
      created,
      latest,
      count: history.length,
      history,
      nextAction:
        mode === "create"
          ? "AI Evolution Summaryを作成しました。次は/admin/evolutionで表示します。"
          : "最新サマリーと履歴を取得しました。",
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
            : "evolution summary api failed",
      },
      { status: 500 }
    );
  }
}
