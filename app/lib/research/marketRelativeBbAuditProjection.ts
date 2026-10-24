import type { EvidenceReportRow } from "./marketRelativeEvidenceReport";

export type BbAuditSource = {
  id: number;
  code: string;
  signal_date: string;
  entry_price: number | string | null;
  display_ai_power_after_bb: number | string | null;
};

/** No database access. Never invent intraday timestamps or future prices. */
export function projectBbAuditRow(row: BbAuditSource): EvidenceReportRow {
  const safeNumber = (v: number | string | null): number | null =>
    v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
  return {
    signalId: "bb:" + row.id + ":" + row.signal_date,
    stockCode: row.code,
    frozenAiPower: safeNumber(row.display_ai_power_after_bb),
    signalObservedAt: null,
    entryPrice: safeNumber(row.entry_price),
    exitPrice: null,
    entryObservedAt: null,
    exitObservedAt: null,
    benchmark: "nikkei",
    benchmarkEntryPrice: null,
    benchmarkExitPrice: null,
    benchmarkEntryObservedAt: null,
    benchmarkExitObservedAt: null,
    horizonTradingDays: 1,
    window: "daily_close",
  };
}
