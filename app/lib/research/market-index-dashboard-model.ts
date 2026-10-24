/**
 * Research-only presentation model. No route, UI authorization, DB, or network.
 * Never interpret these counters as proof of licensed data or verified sessions.
 */
import { summarizeResearchEvidenceBatch } from "./market-index-evidence-review.ts";

export type ResearchDashboardModel = {
  status: "research_only";
  title: "市場指数・証拠チェック（研究用）";
  total: number;
  manualReviewCandidates: number;
  blocked: number;
  blockedReasons: { code: string; count: number }[];
  warnings: readonly [
    "利用許諾は未検証",
    "取引日カレンダーは未検証",
    "正式保存は無効"
  ];
};

export function buildResearchDashboardModel(
  evidence: unknown,
): { ok: true; model: ResearchDashboardModel } |
   { ok: false; reason: "INVALID_BATCH" | "BATCH_TOO_LARGE" } {
  const aggregate = summarizeResearchEvidenceBatch(evidence);
  if (!aggregate.accepted) return { ok: false, reason: aggregate.reason };
  const blockedReasons = Object.entries(aggregate.reasonCounts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  return {
    ok: true,
    model: {
      status: "research_only",
      title: "市場指数・証拠チェック（研究用）",
      total: aggregate.total,
      manualReviewCandidates: aggregate.candidates,
      blocked: aggregate.blocked,
      blockedReasons,
      warnings: ["利用許諾は未検証", "取引日カレンダーは未検証", "正式保存は無効"],
    },
  };
}
