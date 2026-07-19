import { NextRequest, NextResponse } from "next/server";
import {
  createEvolutionSummaryFromLatestLog,
  getEvolutionHistory,
  getLatestEvolutionSummary,
} from "@/app/lib/evolution/evolutionSummaryRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBUG_VERSION = "V26_AI_EVOLUTION_SUMMARY_API_UPDATED_AT";

function toNumber(value: string | null, fallback: number): number {
  const num = Number(value ?? fallback);

  if (!Number.isFinite(num)) {
    return fallback;
  }

  return Math.max(1, Math.min(Math.floor(num), 100));
}

function getDataUpdatedAt(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  const candidates = [
    record.updatedAt,
    record.createdAt,
    record.updated_at,
    record.created_at,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) {
      continue;
    }

    const date = new Date(candidate);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const checkedAt = new Date().toISOString();

  try {
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get("mode") === "create" ? "create" : "read";
    const limit = toNumber(searchParams.get("limit"), 30);

    const created =
      mode === "create"
        ? await createEvolutionSummaryFromLatestLog()
        : null;

    const [latest, history] = await Promise.all([
      getLatestEvolutionSummary(),
      getEvolutionHistory(limit),
    ]);

    const dataUpdatedAt =
      getDataUpdatedAt(latest) ??
      getDataUpdatedAt(history[0]) ??
      null;

    return NextResponse.json(
      {
        success: true,
        debugVersion: DEBUG_VERSION,

        // APIを確認した日時
        checkedAt,

        // 最新のAI進化サマリーが作成・更新された日時
        dataUpdatedAt,

        mode,
        created,
        latest,
        count: history.length,
        history,

        nextAction:
          mode === "create"
            ? "AI Evolution Summaryを作成しました。次は/admin/evolutionで表示します。"
            : "最新サマリーと履歴を取得しました。",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("evolution summary api error:", error);

    return NextResponse.json(
      {
        success: false,
        debugVersion: DEBUG_VERSION,
        checkedAt,
        dataUpdatedAt: null,
        error:
          error instanceof Error
            ? error.message
            : "evolution summary api failed",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}