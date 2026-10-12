/**
 * Nine experimental Japanese two-candle patterns.
 *
 * SHADOW ONLY: deliberately NOT imported by chartPatternEngine, scanEngine,
 * aiEngine, LINE notification code, or patternForwardLearning.
 * All decisions use candles up to and including index i, never future bars.
 * Detection thresholds are research hypotheses, NOT trading probabilities.
 */
export const SHADOW_CANDLE_DETECTOR_VERSION = "CANDLE9_V1" as const;

export type ShadowCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ShadowCandleDirection = "BUY" | "SELL";
export type ShadowCandleId =
  | "SH_CDL_BULL_ENGULF"
  | "SH_CDL_BEAR_ENGULF"
  | "SH_CDL_BULL_HARAMI"
  | "SH_CDL_BEAR_HARAMI"
  | "SH_CDL_BULL_MEETING"
  | "SH_CDL_BEAR_MEETING"
  | "SH_CDL_TWEEZER_BOTTOM"
  | "SH_CDL_TWEEZER_TOP"
  | "SH_CDL_PIERCING";

export type ShadowCandleDefinition = {
  id: ShadowCandleId;
  name: string;
  direction: ShadowCandleDirection;
  explanation: string;
};

export const SHADOW_CANDLE_PATTERNS: readonly ShadowCandleDefinition[] = [
  { id: "SH_CDL_BULL_ENGULF", name: "強気のつつみ線", direction: "BUY",
    explanation: "下落圏の陰線を、次の陽線の実体が包み込む候補" },
  { id: "SH_CDL_BEAR_ENGULF", name: "弱気のつつみ線", direction: "SELL",
    explanation: "上昇圏の陽線を、次の陰線の実体が包み込む候補" },
  { id: "SH_CDL_BULL_HARAMI", name: "強気のはらみ線", direction: "BUY",
    explanation: "下落圏の大陰線の実体内に、小さな陽線が収まる候補" },
  { id: "SH_CDL_BEAR_HARAMI", name: "弱気のはらみ線", direction: "SELL",
    explanation: "上昇圏の大陽線の実体内に、小さな陰線が収まる候補" },
  { id: "SH_CDL_BULL_MEETING", name: "強気の出会い線", direction: "BUY",
    explanation: "下落圏の陰線に続く陽線が、前日終値付近まで戻る候補" },
  { id: "SH_CDL_BEAR_MEETING", name: "弱気の出会い線", direction: "SELL",
    explanation: "上昇圏の陽線に続く陰線が、前日終値付近に戻る候補" },
  { id: "SH_CDL_TWEEZER_BOTTOM", name: "毛抜き底", direction: "BUY",
    explanation: "下落圏の2日間で安値が近い、陰線→陽線の候補" },
  { id: "SH_CDL_TWEEZER_TOP", name: "毛抜き天井", direction: "SELL",
    explanation: "上昇圏の2日間で高値が近い、陽線→陰線の候補" },
  { id: "SH_CDL_PIERCING", name: "切り込み線", direction: "BUY",
    explanation: "下落圏の大陰線の後、陽線が前日実体の半分以上まで回復する候補" },
] as const;

export type ShadowCandleHit = {
  id: ShadowCandleId;
  name: string;
  direction: ShadowCandleDirection;
  index: number;
  time: number;
  entryClose: number;
  location: "高値圏" | "安値圏";
  reasons: string[];
};

export type ShadowCandleHorizon = {
  horizon: 1 | 3 | 5;
  completed: number;
  success: number;
  winRatePercent: number | null;
  averageDirectionalReturnPercent: number | null;
  averageRawReturnPercent: number | null;
};

export type ShadowCandleStudy = {
  definition: ShadowCandleDefinition;
  hits: ShadowCandleHit[];
  horizons: ShadowCandleHorizon[];
};

const p = (n: number, reference: number) => Math.abs(n) / Math.max(reference, 0.0001);
const body = (c: ShadowCandle) => Math.abs(c.close - c.open);
const bull = (c: ShadowCandle) => c.close > c.open;
const bear = (c: ShadowCandle) => c.close < c.open;
const maxBody = (c: ShadowCandle) => Math.max(c.open, c.close);
const minBody = (c: ShadowCandle) => Math.min(c.open, c.close);
const near = (a: number, b: number, tolerance = 0.003) =>
  p(a - b, Math.max(a, b)) <= tolerance;

function valid(c: ShadowCandle) {
  return Number.isFinite(c.time) &&
    [c.open, c.high, c.low, c.close].every((v) => Number.isFinite(v) && v > 0) &&
    c.high >= Math.max(c.open, c.low, c.close) &&
    c.low <= Math.min(c.open, c.high, c.close);
}

/** Context excludes the two formation candles; no look-ahead. */
function contextAt(candles: readonly ShadowCandle[], i: number): "HIGH" | "LOW" | null {
  if (i < 13) return null;
  const before = candles.slice(i - 13, i - 1);
  const max = Math.max(...before.map(c => c.high));
  const min = Math.min(...before.map(c => c.low));
  if (p(max - min, max) < 0.025) return null;
  const prev = candles[i - 1].close;
  const old = before[0].close;
  const delta = (prev - old) / old;
  if (delta >= 0.02 && prev >= min + (max - min) * 0.65) return "HIGH";
  if (delta <= -0.02 && prev <= min + (max - min) * 0.35) return "LOW";
  return null;
}

export function detectShadowCandlePatterns(candles: readonly ShadowCandle[]): ShadowCandleHit[] {
  const hits: ShadowCandleHit[] = [];
  // Unsuitable data is never silently fixed, reordered, or supplemented.
  for (let i = 13; i < candles.length; i++) {
    const a = candles[i - 1];
    const b = candles[i];
    if (!valid(a) || !valid(b) || b.time <= a.time) continue;
    const zone = contextAt(candles, i);
    if (!zone) continue;
    const strongA = p(body(a), a.close) >= 0.008;
    const strongB = p(body(b), b.close) >= 0.005;
    const bigFirst = p(body(a), a.close) >= 0.012;
    const smallInside = body(b) <= body(a) * 0.65 &&
      minBody(b) >= minBody(a) - a.close * 0.001 &&
      maxBody(b) <= maxBody(a) + a.close * 0.001;
    const push = (id: ShadowCandleId, reasons: string[]) => {
      const definition = SHADOW_CANDLE_PATTERNS.find(x => x.id === id);
      if (!definition) return;
      hits.push({
        id, name: definition.name, direction: definition.direction,
        index: i, time: b.time, entryClose: b.close,
        location: zone === "HIGH" ? "高値圏" : "安値圏", reasons,
      });
    };
    if (zone === "LOW" && bear(a) && bull(b) && strongA && strongB &&
      b.open <= a.close * 1.001 && b.close >= a.open * 0.999 && body(b) >= body(a) * 1.03) {
      push("SH_CDL_BULL_ENGULF", ["陰線→陽線", "陽線の実体が前日の実体を包む", "下落圏"]);
    }
    if (zone === "HIGH" && bull(a) && bear(b) && strongA && strongB &&
      b.open >= a.close * 0.999 && b.close <= a.open * 1.001 && body(b) >= body(a) * 1.03) {
      push("SH_CDL_BEAR_ENGULF", ["陽線→陰線", "陰線の実体が前日の実体を包む", "上昇圏"]);
    }
    if (zone === "LOW" && bear(a) && bull(b) && bigFirst && smallInside) {
      push("SH_CDL_BULL_HARAMI", ["大陰線→小陽線", "前日の実体内に小陽線", "下落圏"]);
    }
    if (zone === "HIGH" && bull(a) && bear(b) && bigFirst && smallInside) {
      push("SH_CDL_BEAR_HARAMI", ["大陽線→小陰線", "前日の実体内に小陰線", "上昇圏"]);
    }
    // Meeting-line hypothesis: opposite candle, meaningful overnight gap,
    // closing close to prior close. Japanese stocks may be sparse here.
    if (zone === "LOW" && bear(a) && bull(b) && strongA && strongB &&
      b.open < a.close * 0.995 && near(b.close, a.close, 0.003)) {
      push("SH_CDL_BULL_MEETING", ["下放れ寄付き", "前日終値付近へ回復", "下落圏"]);
    }
    if (zone === "HIGH" && bull(a) && bear(b) && strongA && strongB &&
      b.open > a.close * 1.005 && near(b.close, a.close, 0.003)) {
      push("SH_CDL_BEAR_MEETING", ["上放れ寄付き", "前日終値付近へ反落", "上昇圏"]);
    }
    if (zone === "LOW" && bear(a) && bull(b) && near(a.low, b.low, 0.003) &&
      strongA && strongB) {
      push("SH_CDL_TWEEZER_BOTTOM", ["2本の安値差が0.3%以内", "陰線→陽線", "下落圏"]);
    }
    if (zone === "HIGH" && bull(a) && bear(b) && near(a.high, b.high, 0.003) &&
      strongA && strongB) {
      push("SH_CDL_TWEEZER_TOP", ["2本の高値差が0.3%以内", "陽線→陰線", "上昇圏"]);
    }
    // Piercing line: a down gap and a bullish body closing over the 50%
    // midpoint but BELOW the former open. Else it overlaps with engulfing.
    const midpoint = (a.open + a.close) / 2;
    if (zone === "LOW" && bear(a) && bull(b) && bigFirst && strongB &&
      b.open <= a.close * 0.998 && b.close > midpoint &&
      b.close < a.open * 0.999) {
      push("SH_CDL_PIERCING", ["陰線後の下放れ", "前日陰線の実体半値を回復", "下落圏"]);
    }
  }
  return hits;
}

function roundedPercent(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Point-in-time study from closing price on detection day to CLOSE +N valid
 * sessions. If N future candles do not exist, skip (never score as a loss).
 * This is directional paper research only; costs, taxes, fills excluded.
 */
export function studyShadowCandlePatterns(candles: readonly ShadowCandle[]): ShadowCandleStudy[] {
  const hits = detectShadowCandlePatterns(candles);
  return SHADOW_CANDLE_PATTERNS.map(definition => {
    const subset = hits.filter(hit => hit.id === definition.id);
    const horizons = ([1, 3, 5] as const).map(horizon => {
      const returns = subset.flatMap(hit => {
        const after = candles[hit.index + horizon];
        if (!after || !valid(after) || hit.entryClose <= 0) return [];
        const raw = 100 * (after.close - hit.entryClose) / hit.entryClose;
        return [{ raw, directional: definition.direction === "BUY" ? raw : -raw }];
      });
      return {
        horizon,
        completed: returns.length,
        success: returns.filter(x => x.directional > 0).length,
        winRatePercent: returns.length
          ? roundedPercent(100 * returns.filter(x => x.directional > 0).length / returns.length) : null,
        averageDirectionalReturnPercent: returns.length
          ? roundedPercent(returns.reduce((sum, x) => sum + x.directional, 0) / returns.length) : null,
        averageRawReturnPercent: returns.length
          ? roundedPercent(returns.reduce((sum, x) => sum + x.raw, 0) / returns.length) : null,
      };
    });
    return { definition, hits: subset, horizons };
  });
}
