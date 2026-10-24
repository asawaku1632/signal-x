import { evaluateWatchPowerHoldout, type WatchPowerRecord } from "./watchPowerHoldout";

/** Narrow read-only adapter. Feed results of an authenticated server-side SELECT.
 * Never import this into a public route or expose raw research records to clients.
 */
export type FrozenSwingRow = {
  code: string;
  trade_date: string;
  decision_status: string;
  ai_power: number | string | null;
  return_5d: number | string | null;
};

function parseFinite(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapFrozenSwingRows(rows: FrozenSwingRow[]): WatchPowerRecord[] {
  return rows.flatMap(row => {
    if (row.decision_status !== "WATCH") return [];
    // A date-only SQL column is expected. Do not reinterpret timestamps in local time.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.trade_date)) return [];
    return [{
      code: row.code,
      signalDate: row.trade_date,
      status: "WATCH" as const,
      aiPowerAtSignal: parseFinite(row.ai_power),
      return5dPct: parseFinite(row.return_5d),
    }];
  });
}

/** Pure evaluation entry point; does not connect to the database. */
export function evaluateFrozenSwingHoldout(rows: FrozenSwingRow[]) {
  return evaluateWatchPowerHoldout(mapFrozenSwingRows(rows));
}

/** Suggested read-only server-side SQL, to be executed only in owner-authorized context:
 * SELECT code, trade_date, decision_status, ai_power, return_5d
 * FROM public.swing_universe_observations
 * WHERE trade_date > DATE '2026-10-24' AND decision_status = 'WATCH'
 * ORDER BY trade_date, code;
 */
