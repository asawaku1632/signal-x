import { buildEvidenceReport, type EvidenceReportRow } from "./marketRelativeEvidenceReport";

export function scoreEligibleEvidence(rows: EvidenceReportRow[]) {
  const report = buildEvidenceReport(rows);
  const scored = report.eligible.map(row => {
    const stockReturnPct = (row.exitPrice! / row.entryPrice! - 1) * 100;
    const marketReturnPct = (row.benchmarkExitPrice! / row.benchmarkEntryPrice! - 1) * 100;
    return { signalId: row.signalId, stockCode: row.stockCode, aiPowerAtSignal: row.frozenAiPower!,
      benchmark: row.benchmark, window: row.window, horizonTradingDays: row.horizonTradingDays,
      stockReturnPct, marketReturnPct, excessReturnPoints: stockReturnPct - marketReturnPct };
  });
  return { ...report, scored, caveat: "Returns are descriptive and ignore costs, slippage and execution feasibility." };
}
