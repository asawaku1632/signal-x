import {
  HORIZONTAL_COMPARE_VERSION,
  HORIZONTAL_VARIANTS,
  type CompareVariantId,
} from "./horizontalRetestComparison.ts";

export type StoredHorizontalTrade = {
  detector_version: string;
  code: string;
  breakout_time: string | number;
  retest_time: string | number;
  entry_time: string | number;
  exit_time: string | number;
  profit_yen_100: number;
  return_percent: number | string;
  volume_eligible: boolean;
  technical_eligible: boolean;
};
export type HorizontalArchiveStats = {
  id: CompareVariantId; name: string;
  count: number; wins: number; losses: number;
  winRatePercent: number | null;
  sumYen100: number | null; averageYen100: number | null;
  averageReturnPercent: number | null;
  worstYen100: number | null;
  drawdownYen100: number | null;
};
export type HorizontalArchiveSummary = {
  uniqueTrades: number; stockCountWithTrades: number;
  rows: HorizontalArchiveStats[]; duplicateEventsDiscarded: number;
};
const round = (v: number) => Math.round(v * 100) / 100;

function validRow(raw: StoredHorizontalTrade): boolean {
  const b = Number(raw.breakout_time), r = Number(raw.retest_time);
  const e = Number(raw.entry_time), x = Number(raw.exit_time);
  const p = Number(raw.return_percent);
  return raw.detector_version === HORIZONTAL_COMPARE_VERSION &&
    /^[0-9]{4}$/.test(raw.code) &&
    [b, r, e, x].every(v => Number.isSafeInteger(v) && v > 0) &&
    b < r && r < e && e <= x &&
    Number.isSafeInteger(raw.profit_yen_100) &&
    Number.isFinite(p) && Math.abs(p) <= 100000 &&
    typeof raw.volume_eligible === "boolean" &&
    typeof raw.technical_eligible === "boolean" &&
    (!raw.technical_eligible || raw.volume_eligible);
}

export function combineArchivedHorizontalTrades(input: readonly StoredHorizontalTrade[]): HorizontalArchiveSummary {
  // DB already has a composite primary key, but dedup again defensively.
  const unique = new Map<string, StoredHorizontalTrade>();
  let duplicates = 0;
  for (const row of input) {
    if (!validRow(row)) continue;
    const key = [row.detector_version, row.code, row.breakout_time,
      row.retest_time, row.entry_time].join(":");
    if (unique.has(key)) { duplicates++; continue; }
    unique.set(key, row);
  }
  const trades = [...unique.values()];
  return {
    uniqueTrades: trades.length,
    stockCountWithTrades: new Set(trades.map(t => t.code)).size,
    duplicateEventsDiscarded: duplicates,
    rows: HORIZONTAL_VARIANTS.map(({ id, name }) => {
      const eligible = trades.filter(t => id === "BASE" ||
        id === "TREND_VOLUME" && t.volume_eligible ||
        id === "TECHNICAL" && t.technical_eligible);
      eligible.sort((a, b) => Number(a.exit_time) - Number(b.exit_time) ||
        Number(a.entry_time) - Number(b.entry_time) || a.code.localeCompare(b.code));
      const pnls = eligible.map(t => t.profit_yen_100);
      const wins = pnls.filter(v => v > 0).length;
      const sum = pnls.reduce((s, v) => s + v, 0);
      let equity = 0, peak = 0, dd = 0;
      for (const pnl of pnls) {
        equity += pnl;
        peak = Math.max(peak, equity);
        dd = Math.max(dd, peak - equity);
      }
      const count = eligible.length;
      return {
        id, name, count, wins, losses: count - wins,
        winRatePercent: count ? round(100 * wins / count) : null,
        sumYen100: count ? sum : null,
        averageYen100: count ? Math.round(sum / count) : null,
        averageReturnPercent: count ? round(eligible.reduce((s, t) =>
          s + Number(t.return_percent), 0) / count) : null,
        worstYen100: count ? Math.min(...pnls) : null,
        drawdownYen100: count ? dd : null,
      };
    }),
  };
}
