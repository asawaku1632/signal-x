export type HistoricalEvidence = {
  signalId: string;
  stockCode: string;
  frozenAiPower: number | null;
  signalObservedAt: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  entryObservedAt: string | null;
  exitObservedAt: string | null;
  benchmark: "nikkei" | "topix";
  benchmarkEntryPrice: number | null;
  benchmarkExitPrice: number | null;
  benchmarkEntryObservedAt: string | null;
  benchmarkExitObservedAt: string | null;
};

export function validateHistoricalEvidence(row: HistoricalEvidence) {
  const reasons: string[] = [];
  const validDate = (value: string | null) => value !== null && Number.isFinite(Date.parse(value));
  const positive = (value: number | null) => value !== null && Number.isFinite(value) && value > 0;
  if (!row.signalId?.trim() || !/^\d{4}$/.test(row.stockCode)) reasons.push("invalid_identity");
  if (row.frozenAiPower === null || !Number.isFinite(row.frozenAiPower) || row.frozenAiPower < 0 || row.frozenAiPower > 100) reasons.push("missing_frozen_ai_power");
  if (!validDate(row.signalObservedAt)) reasons.push("missing_signal_timestamp");
  if (!positive(row.entryPrice) || !positive(row.exitPrice)) reasons.push("missing_stock_prices");
  if (!validDate(row.entryObservedAt) || !validDate(row.exitObservedAt)) reasons.push("missing_stock_timestamps");
  if (!positive(row.benchmarkEntryPrice) || !positive(row.benchmarkExitPrice)) reasons.push("missing_benchmark_prices");
  if (!validDate(row.benchmarkEntryObservedAt) || !validDate(row.benchmarkExitObservedAt)) reasons.push("missing_benchmark_timestamps");
  if (validDate(row.signalObservedAt) && validDate(row.entryObservedAt) &&
      Date.parse(row.entryObservedAt!) < Date.parse(row.signalObservedAt!)) reasons.push("entry_precedes_signal");
  if (validDate(row.entryObservedAt) && validDate(row.exitObservedAt) &&
      Date.parse(row.exitObservedAt!) <= Date.parse(row.entryObservedAt!)) reasons.push("invalid_stock_horizon");
  if (validDate(row.benchmarkEntryObservedAt) && validDate(row.benchmarkExitObservedAt) &&
      Date.parse(row.benchmarkExitObservedAt!) <= Date.parse(row.benchmarkEntryObservedAt!)) reasons.push("invalid_benchmark_horizon");
  if (validDate(row.entryObservedAt) && validDate(row.benchmarkEntryObservedAt) &&
      row.entryObservedAt !== row.benchmarkEntryObservedAt) reasons.push("entry_timestamp_mismatch");
  if (validDate(row.exitObservedAt) && validDate(row.benchmarkExitObservedAt) &&
      row.exitObservedAt !== row.benchmarkExitObservedAt) reasons.push("exit_timestamp_mismatch");
  return { status: reasons.length ? "excluded" as const : "eligible" as const, reasons };
}
