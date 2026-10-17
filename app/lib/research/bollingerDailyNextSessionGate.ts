/** Pure gate for the five-stock daily research pilot. No DB or provider calls. */
export type DailyPilotCandidate = Readonly<{ code: string; dateJst: string; close: number }>;
export const DAILY_PILOT_CODES = ["9984", "3762", "7203", "8035", "8306"] as const;
export const DAILY_PILOT_BASELINE_DATE = "2026-10-16";
export const DAILY_PILOT_NEXT_DATE = "2026-10-19";

/** Reject missing/extra stocks, future dates, stale days, and malformed prices. */
export function validateNextDailyPilot(
  candidates: readonly DailyPilotCandidate[],
  todayJst: string,
): { valid: boolean; reason: string; ordered: DailyPilotCandidate[] } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayJst) || todayJst < DAILY_PILOT_NEXT_DATE) {
    return { valid: false, reason: "NEXT_SESSION_NOT_REACHED", ordered: [] };
  }
  if (candidates.length !== DAILY_PILOT_CODES.length) {
    return { valid: false, reason: "COHORT_SIZE_MISMATCH", ordered: [] };
  }
  const byCode = new Map(candidates.map(c => [c.code, c]));
  if (byCode.size !== DAILY_PILOT_CODES.length ||
      DAILY_PILOT_CODES.some(code => !byCode.has(code))) {
    return { valid: false, reason: "COHORT_MISMATCH", ordered: [] };
  }
  if (candidates.some(c => c.dateJst !== DAILY_PILOT_NEXT_DATE ||
      typeof c.close !== "number" || !Number.isFinite(c.close) || c.close <= 0)) {
    return { valid: false, reason: "INVALID_DATE_OR_PRICE", ordered: [] };
  }
  return { valid: true, reason: "READY_FOR_MANUAL_REVIEW", ordered: DAILY_PILOT_CODES.map(code => byCode.get(code)!) };
}
export function verifyNextDailyPilotGate(): boolean {
  const valid = DAILY_PILOT_CODES.map(code => ({ code, dateJst: DAILY_PILOT_NEXT_DATE, close: 100 }));
  return !validateNextDailyPilot(valid, "2026-10-17").valid &&
    validateNextDailyPilot(valid, "2026-10-19").valid &&
    !validateNextDailyPilot(valid.slice(1), "2026-10-19").valid &&
    !validateNextDailyPilot([...valid.slice(0, 4), { ...valid[4], close: -1 }], "2026-10-19").valid &&
    !validateNextDailyPilot([...valid.slice(0, 4), { ...valid[4], dateJst: "2026-10-16" }], "2026-10-19").valid;
}
