import { isTseTradingDate } from "@/app/lib/technicalObservation/tseMarketCalendar";
import type { ReliabilityDailySnapshot } from "@/app/lib/learning/winRateReliabilityAudit";
import { WIN_RATE_DAILY_AUDIT_KIND } from "@/app/lib/learning/winRateReliabilityAudit";

type AuditLogRow = { status: string; created_at: Date | string; details: unknown };
export type AuditHistoryEntry = {
  tradeDate: string;
  checkedAt: string;
  status: "OK" | "NEEDS_REVIEW" | "ERROR";
  audit: ReliabilityDailySnapshot | null;
};

export type WeeklyAuditSummary = {
  weekStart: string;
  weekEnd: string;
  scheduledDays: number;
  auditedDays: number;
  okDays: number;
  reviewDays: number;
  errorDays: number;
  missingDays: number;
  status: "OK" | "NEEDS_REVIEW" | "PENDING";
};

function shiftDate(date: string, days: number) {
  const ms = Date.parse(date + "T00:00:00Z") + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function mondayOf(date: string) {
  const day = new Date(date + "T00:00:00Z").getUTCDay();
  return shiftDate(date, -(day === 0 ? 6 : day - 1));
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z"));
}

export function readAuditHistory(rows: AuditLogRow[]): AuditHistoryEntry[] {
  const byDate = new Map<string, AuditHistoryEntry>();
  for (const row of rows) {
    if (!row.details || typeof row.details !== "object") continue;
    const details = row.details as Record<string, unknown>;
    if (details.kind !== WIN_RATE_DAILY_AUDIT_KIND || !validDate(details.tradeDate)) continue;
    if (byDate.has(details.tradeDate)) continue; // Query is newest-first.
    const created = new Date(row.created_at);
    const checkedAt = Number.isFinite(created.getTime()) ? created.toISOString() : String(row.created_at);
    if (row.status === "ERROR") {
      byDate.set(details.tradeDate, {
        tradeDate: details.tradeDate, checkedAt, status: "ERROR", audit: null,
      });
    } else if (
      row.status === "COMPLETED" &&
      (details.health === "OK" || details.health === "NEEDS_REVIEW") &&
      Array.isArray(details.warnings)
    ) {
      byDate.set(details.tradeDate, {
        tradeDate: details.tradeDate,
        checkedAt,
        status: details.health,
        audit: details as ReliabilityDailySnapshot,
      });
    }
  }
  return [...byDate.values()].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));
}

export function summarizeWeeklyAudits(
  days: AuditHistoryEntry[], todayJst: string, timeJst: string,
  weeks = 4,
): WeeklyAuditSummary[] {
  const firstWeek = mondayOf(todayJst);
  const byDate = new Map(days.map((day) => [day.tradeDate, day]));
  return Array.from({ length: weeks }, (_, index) => {
    const weekStart = shiftDate(firstWeek, -7 * index);
    const weekEnd = shiftDate(weekStart, 6);
    let scheduledDays = 0;
    let auditedDays = 0;
    let okDays = 0;
    let reviewDays = 0;
    let errorDays = 0;
    for (let offset = 0; offset < 7; offset++) {
      const date = shiftDate(weekStart, offset);
      if (date > todayJst || (date === todayJst && timeJst < "18:15")) continue;
      if (!isTseTradingDate(date)) continue;
      scheduledDays += 1;
      const entry = byDate.get(date);
      if (!entry) continue;
      auditedDays += 1;
      if (entry.status === "OK") okDays += 1;
      else if (entry.status === "ERROR") errorDays += 1;
      else reviewDays += 1;
    }
    const missingDays = scheduledDays - auditedDays;
    return {
      weekStart, weekEnd,
      scheduledDays, auditedDays, okDays, reviewDays, errorDays, missingDays,
      status: scheduledDays === 0 ? "PENDING" :
        reviewDays || errorDays || missingDays ? "NEEDS_REVIEW" : "OK",
    };
  });
}
