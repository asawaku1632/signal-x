import {
  SHADOW_CANDLE_PATTERNS,
  detectShadowCandlePatterns,
  type ShadowCandle,
  type ShadowCandleId,
} from "./shadowCandlestickNine";

export const MAX_SHADOW_BATCH_STOCKS = 5;

export type BatchStockData = {
  code: string;
  candles: readonly ShadowCandle[];
};

export type BatchHorizon = 1 | 3 | 5;

export type BatchOutcome = {
  code: string;
  id: ShadowCandleId;
  time: number;
  horizon: BatchHorizon;
  directionalPercent: number;
  rawPercent: number;
};

export type BatchHorizonStats = {
  horizon: BatchHorizon;
  completed: number;
  wins: number;
  winPercent: number | null;
  averageDirectionalPercent: number | null;
  worstDirectionalPercent: number | null;
  bestDirectionalPercent: number | null;
  stockCount: number;
  early: { count: number; winPercent: number | null };
  late: { count: number; winPercent: number | null };
};

export type BatchPatternStats = {
  id: ShadowCandleId;
  name: string;
  direction: "BUY" | "SELL";
  detections: number;
  detectionStockCount: number;
  horizons: BatchHorizonStats[];
};

export type BatchStockSummary = {
  code: string;
  candles: number;
  firstDate: number;
  latestDate: number;
  detections: number;
  detectedKinds: number;
};

export type BatchStudyResult = {
  rows: BatchPatternStats[];
  stocks: BatchStockSummary[];
  totalDetections: number;
  totalCompleted5d: number;
  comparisonSplitTime: number | null;
};

// Reject, rather than silently truncate, large or malformed requests.
// Codes are never embedded in URLs without strict validation.
export function parseShadowBatchCodes(raw: string): { codes: string[]; error: string | null } {
  if (!raw.trim()) return { codes: [], error: null };
  const codes = raw.split(/[\s,、，;；]+/).map(v => v.trim().toUpperCase()).filter(Boolean);
  if (!codes.length) return { codes: [], error: null };
  if (codes.length > MAX_SHADOW_BATCH_STOCKS) {
    return { codes: [], error: "一度に調べられるのは最大5銘柄です。5銘柄以内にしてください。" };
  }
  if (codes.some(code => !/^[0-9A-Z]{4,5}$/.test(code))) {
    return { codes: [], error: "銘柄コードは英数字4〜5文字をカンマ区切りで入力してください。" };
  }
  if (new Set(codes).size !== codes.length) {
    return { codes: [], error: "同じ銘柄コードが重複しています。重複を取り除いてください。" };
  }
  return { codes, error: null };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
function winPct(rows: BatchOutcome[]): number | null {
  return rows.length ? round(100 * rows.filter(r => r.directionalPercent > 0).length / rows.length) : null;
}

export function studyShadowCandleBatch(stocks: readonly BatchStockData[]): BatchStudyResult {
  const events: BatchOutcome[] = [];
  const counts = new Map<ShadowCandleId, { detections: number; codes: Set<string> }>();
  const summaries: BatchStockSummary[] = [];
  let minTime = Infinity;
  let maxTime = -Infinity;
  for (const stock of stocks) {
    const candles = stock.candles;
    if (candles.length < 20) continue;
    const firstDate = candles[0].time;
    const latestDate = candles[candles.length - 1].time;
    if (!Number.isFinite(firstDate) || !Number.isFinite(latestDate)) continue;
    minTime = Math.min(minTime, firstDate);
    maxTime = Math.max(maxTime, latestDate);
    const hits = detectShadowCandlePatterns(candles);
    summaries.push({
      code: stock.code,
      candles: candles.length,
      firstDate, latestDate,
      detections: hits.length,
      detectedKinds: new Set(hits.map(hit => hit.id)).size,
    });
    for (const hit of hits) {
      const prev = counts.get(hit.id) ?? { detections: 0, codes: new Set<string>() };
      prev.detections++;
      prev.codes.add(stock.code);
      counts.set(hit.id, prev);
      for (const horizon of [1, 3, 5] as const) {
        const after = candles[hit.index + horizon];
        if (!after || !Number.isFinite(after.close) || after.close <= 0) continue;
        const rawPercent = (after.close - hit.entryClose) / hit.entryClose * 100;
        events.push({
          code: stock.code,
          id: hit.id, time: hit.time, horizon,
          rawPercent,
          directionalPercent: hit.direction === "BUY" ? rawPercent : -rawPercent,
        });
      }
    }
  }
  const comparisonSplitTime = summaries.length > 0 && maxTime > minTime
    ? minTime + (maxTime - minTime) / 2
    : null;
  const rows = SHADOW_CANDLE_PATTERNS.map(definition => {
    const count = counts.get(definition.id);
    const horizons: BatchHorizonStats[] = ([1, 3, 5] as const).map(horizon => {
      const selected = events.filter(e => e.id === definition.id && e.horizon === horizon);
      const early = comparisonSplitTime === null ? [] : selected.filter(e => e.time < comparisonSplitTime);
      const late = comparisonSplitTime === null ? [] : selected.filter(e => e.time >= comparisonSplitTime);
      return {
        horizon,
        completed: selected.length,
        wins: selected.filter(e => e.directionalPercent > 0).length,
        winPercent: winPct(selected),
        averageDirectionalPercent: selected.length
          ? round(selected.reduce((sum, e) => sum + e.directionalPercent, 0) / selected.length)
          : null,
        worstDirectionalPercent: selected.length ? round(Math.min(...selected.map(e => e.directionalPercent))) : null,
        bestDirectionalPercent: selected.length ? round(Math.max(...selected.map(e => e.directionalPercent))) : null,
        stockCount: new Set(selected.map(e => e.code)).size,
        early: { count: early.length, winPercent: winPct(early) },
        late: { count: late.length, winPercent: winPct(late) },
      };
    });
    return {
      id: definition.id, name: definition.name, direction: definition.direction,
      detections: count?.detections ?? 0,
      detectionStockCount: count?.codes.size ?? 0,
      horizons,
    };
  });
  return {
    rows, stocks: summaries,
    totalDetections: rows.reduce((sum, row) => sum + row.detections, 0),
    totalCompleted5d: rows.reduce((sum, row) => sum + row.horizons[2].completed, 0),
    comparisonSplitTime,
  };
}
