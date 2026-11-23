import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { getNotificationResearchEvidence } from "@/app/lib/push/notificationResearchEvidence";
import { getFiveSignalForwardResearch } from "@/app/lib/push/fiveSignalForwardResearch";
import { FIVE_SIGNAL_RESEARCH_ALERTS } from "@/app/lib/push/fiveSignalResearchReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only research coverage overview. This is NOT a candidate feed or approval to send.
export async function GET() {
  const owner = await getLearningOwnerSession();
  if (!owner.isOwner) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  try {
    const evidence = await getNotificationResearchEvidence();
    let forwardRows: Awaited<ReturnType<typeof getFiveSignalForwardResearch>> = [];
    let forwardResearchStatus: "HISTORICAL_ONLY" | "SOURCE_UNAVAILABLE" = "HISTORICAL_ONLY";
    try {
      forwardRows = await getFiveSignalForwardResearch(100);
    } catch {
      forwardResearchStatus = "SOURCE_UNAVAILABLE";
      console.warn("[five-signal-preview] optional forward source unavailable");
    }
    const surge = evidence.categories.find((category) => category.key === "surge");
    const signals = FIVE_SIGNAL_RESEARCH_ALERTS.map((signal) => {
      const matched = signal.key === "profit_precursor" ? surge : undefined;
      return {
        key: signal.key,
        title: signal.label,
        status: "RESEARCH_ONLY" as const,
        deliveryEnabled: false as const,
        candidateCount: null,
        dataConnection: matched ? "RELATED_HISTORICAL_AGGREGATE_ONLY" : "NOT_YET_MAPPED",
        historical: matched ? {
          observed: matched.observed,
          completed5: matched.completed5,
          settledDays: matched.settledDays,
          latestSignalDate: matched.latestSignalDate,
          meanReturn5: matched.meanReturn5,
          riseRate5: matched.riseRate5,
          reasons: matched.reasons,
        } : null,
        reasons: matched
          ? ["過去の爆益前兆研究集計のみ接続。現在の候補や独立した5分類の判定結果ではありません", ...matched.reasons]
          : ["5分類の独立した実データ結合・候補判定は未実装"],
      };
    });
    return NextResponse.json({
      success: true,
      checkedAt: evidence.checkedAt,
      ownerOnly: true,
      automaticRelease: false,
      notificationsSent: 0,
      forwardResearch: {
        status: forwardResearchStatus,
        limitedTo: 100,
        rows: forwardRows,
        warning: "既存の4研究の過去FORWARD観測。5種類の新シグナルに再分類した結果ではありません。5日後結果は検証専用で、予測特徴量に使用しません。",
      },
      note: "読み取り専用の研究状況。銘柄候補・通知・売買指示ではありません。",
      signals,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[five-signal-preview] research evidence unavailable");
    return NextResponse.json({ success: false, error: "Research preview unavailable" }, { status: 503 });
  }
}
