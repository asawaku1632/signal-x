export declare function decideAuditNextStep(
  investigation: { state: string } | null,
  history: { status: string; snapshotCount: number } | null
): { state: "INVESTIGATE" | "INSUFFICIENT_EVIDENCE" | "REVIEW_CHANGES" | "CONTINUE_MONITORING"; reason: string; action: string };
