import pool from "@/app/lib/postgres";
import { resolveTseTradingDatesAfter } from "@/app/lib/technicalObservation/tseMarketCalendar";

// Read-only intersection of two independently recorded signals.
// EXIT comes from the first server-verified simulated-position EXIT audit.
// MM_V1 comes from a FORWARD observation that existed by the EXIT scan time.
// Neither model's scoring, notifications, order decisions nor cron jobs change.
export const CONFLICT_HORIZONS = [3, 5, 10] as const;
export const CONFLICT_LOOKBACK_SESSIONS = 5;
const MAX_RECENT_EXITS = 250;

type AuditRow = {
  id: string | number;
  code: string;
  name: string;
  signal_date: Date | string;
  snapshot_at: Date | string;
  signal_price: string | number;
  entry_price: string | number;
  ai_power: string | number | null;
  reasons: string[] | null;
  precursor_date: Date | string | null;
  precursor_profile: string | null;
  precursor_version: string | null;
  outcome_3d_date: Date | string | null;
  outcome_3d_price: string | number | null;
  outcome_5d_date: Date | string | null;
  outcome_5d_price: string | number | null;
  outcome_10d_date: Date | string | null;
  outcome_10d_price: string | number | null;
};

export type ConflictOutcome = {
  days: (typeof CONFLICT_HORIZONS)[number];
  date: string | null;
  price: number | null;
  changePercent: number | null;
};
export type ConflictCase = {
  id: string;
  code: string;
  name: string;
  exitDate: string;
  exitScanAt: string;
  exitPrice: number;
  entryPrice: number;
  exitAiPower: number | null;
  reasons: string[];
  precursorDate: string | null;
  precursorProfile: string | null;
  precursorVersion: string | null;
  group: "OVERLAP" | "EXIT_ONLY";
  outcomes: ConflictOutcome[];
};

const dateOnly = (v: Date | string) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const validPositive = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function isRecentPrecursorAtExit(
  precursorDate: string | null,
  exitDate: string,
): boolean {
  if (!precursorDate || precursorDate > exitDate) return false;
  if (precursorDate === exitDate) return true;
  try {
    // Five real exchange trading sessions, not five calendar days or
    // the number of daily price records that happen to have been saved.
    const sessions = resolveTseTradingDatesAfter(
      precursorDate, CONFLICT_LOOKBACK_SESSIONS, { maxLookaheadDays: 45 },
    );
    return sessions.includes(exitDate) ||
      (exitDate > precursorDate && exitDate < sessions[sessions.length - 1]);
  } catch {
    return false; // Unsupported exchange calendar => never guess.
  }
}

function summarize(items: ConflictCase[]) {
  return CONFLICT_HORIZONS.map((days, index) => {
    const completed = items.map((item) => item.outcomes[index]?.changePercent)
      .filter((value): value is number => value != null);
    const reboundCount = completed.filter((value) => value >= 3).length;
    const continuedDeclineCount = completed.filter((value) => value <= -3).length;
    const upCount = completed.filter((value) => value > 0).length;
    return {
      days,
      evaluated: completed.length,
      pending: items.length - completed.length,
      reboundCount,
      continuedDeclineCount,
      upCount,
      reboundRatePercent: completed.length ? reboundCount / completed.length * 100 : null,
      continuedDeclineRatePercent: completed.length
        ? continuedDeclineCount / completed.length * 100 : null,
      upRatePercent: completed.length ? upCount / completed.length * 100 : null,
      averageChangePercent: completed.length
        ? completed.reduce((sum, value) => sum + value, 0) / completed.length : null,
    };
  });
}

export async function getSwingConflictAuditReport(userEmail: string) {
  // A user's observations must never expose other users' simulated positions.
  // Canceled positions disappear, just as in the existing EXIT audit.
  const result = await pool.query<AuditRow>(
    `SELECT audit.*,
            mm.trade_date AS precursor_date,
            mm.profile_key AS precursor_profile,
            mm.signal_version AS precursor_version
     FROM (
       SELECT a.id, a.code, a.name, a.signal_date, a.snapshot_at,
              a.signal_price, a.entry_price, a.ai_power, a.reasons,
              a.outcome_3d_date, a.outcome_3d_price,
              a.outcome_5d_date, a.outcome_5d_price,
              a.outcome_10d_date, a.outcome_10d_price
       FROM public.swing_exit_audits a
       WHERE a.user_email = $1
         AND EXISTS (SELECT 1 FROM public.paper_trades trade
           WHERE trade.id = a.paper_trade_id
             AND trade.user_email = a.user_email)
       ORDER BY a.signal_date DESC, a.id DESC
       LIMIT $2
     ) audit
     LEFT JOIN LATERAL (
       SELECT m.trade_date, m.profile_key, m.signal_version
       FROM public.momentum_memory_observations m
       WHERE m.code = audit.code
         AND m.validation_mode = 'FORWARD'
         AND m.observation_flag = TRUE
         AND m.trade_date <= audit.signal_date
         AND m.trade_date >= audit.signal_date - INTERVAL '25 days'
         AND m.created_at <= audit.snapshot_at
       ORDER BY m.trade_date DESC, m.created_at DESC
       LIMIT 1
     ) mm ON TRUE
     ORDER BY audit.signal_date DESC, audit.id DESC`,
    [userEmail.trim().toLowerCase(), MAX_RECENT_EXITS],
  );

  const items: ConflictCase[] = result.rows.flatMap((row) => {
    const exitPrice = validPositive(row.signal_price);
    const entryPrice = validPositive(row.entry_price);
    if (exitPrice == null || entryPrice == null) return [];
    const exitDate = dateOnly(row.signal_date);
    const candidateDate = row.precursor_date ? dateOnly(row.precursor_date) : null;
    const overlap = isRecentPrecursorAtExit(candidateDate, exitDate);
    const outcomes = CONFLICT_HORIZONS.map((days) => {
      const date = row[`outcome_${days}d_date` as keyof AuditRow] as Date | string | null;
      const price = validPositive(row[`outcome_${days}d_price` as keyof AuditRow]);
      return {
        days,
        date: price && date ? dateOnly(date) : null,
        price,
        changePercent: price == null ? null : (price / exitPrice - 1) * 100,
      };
    });
    return [{
      id: String(row.id),
      code: row.code,
      name: row.name,
      exitDate,
      exitScanAt: new Date(row.snapshot_at).toISOString(),
      exitPrice,
      entryPrice,
      exitAiPower: row.ai_power == null ? null : Number(row.ai_power),
      reasons: Array.isArray(row.reasons) ? row.reasons : [],
      precursorDate: overlap ? candidateDate : null,
      precursorProfile: overlap ? row.precursor_profile : null,
      precursorVersion: overlap ? row.precursor_version : null,
      group: overlap ? "OVERLAP" as const : "EXIT_ONLY" as const,
      outcomes,
    }];
  });

  const overlap = items.filter((item) => item.group === "OVERLAP");
  const exitOnly = items.filter((item) => item.group === "EXIT_ONLY");
  return {
    items: overlap, // Never display individual unrelated EXIT trades here.
    cohorts: {
      overlap: { total: overlap.length, summary: summarize(overlap) },
      exitOnly: { total: exitOnly.length, summary: summarize(exitOnly) },
    },
    scannedExitAudits: result.rows.length,
    maxRecentExits: MAX_RECENT_EXITS,
    horizons: [...CONFLICT_HORIZONS],
    lookbackSessions: CONFLICT_LOOKBACK_SESSIONS,
    note: "爆益前兆(MM_V1/FORWARD)が先に保存され、5取引日以内に同じ銘柄の疑似保有で撤退候補が発生したケースを比較。最初の撤退判定時の保存スキャン株価から3・5・10取引日後の保存株価を測定します。途中高値・安値、売買実現利益、手数料・税金は対象外です。少数の参考値から売買判断を自動変更しません。",
  };
}
