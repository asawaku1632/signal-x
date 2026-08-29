import { calculateEma, calculateMacd, calculateRsi } from "../technicalIndicatorMath.ts";
import { isValidTechnicalCandle } from "./candleMetrics.ts";
import { classifyMacdCross, createIndicatorEvidence } from "./confirmationEvidence.ts";
import { calculateAtr, calculateObservationVolumeRatio } from "./indicators.ts";
import type { TechnicalCandle } from "./types.ts";
import type {
  BollingerEvidenceIndicator,
  BollingerObservationEvidence,
  BollingerObservationIndicatorValues,
  BollingerObservationTimeframe,
} from "./bollingerObservationTypes.ts";

const EMPTY_BY_INDICATOR: Record<BollingerEvidenceIndicator, []> = {
  RSI: [], MACD: [], EMA: [], ATR: [], VOLUME_RATIO: [],
};

export function adaptMacdCrossStatus(status: string | null | undefined) {
  return status === "BULLISH_CROSSOVER" ? "GOLDEN_CROSS" as const
    : status === "BEARISH_CROSSOVER" ? "DEAD_CROSS" as const : null;
}

function invalidIndicators(reason: string): BollingerObservationIndicatorValues {
  return {
    rsi: { availability: "INVALID", value: null, reason },
    macd: { availability: "INVALID",
      value: { macd: null, signal: null, histogram: null, cross: null }, reason },
    ema: { availability: "INVALID",
      value: { ema20: null, ema75: null, ema200: null }, reason },
    atr: { availability: "INVALID", value: null, reason },
    volumeRatio: { availability: "INVALID", value: null, reason },
  };
}

function calculateIndependentIndicators(candles: readonly TechnicalCandle[]) {
  if (candles.some((candle) => !isValidTechnicalCandle(candle))) {
    return invalidIndicators("INVALID_CANDLE");
  }
  const closes = candles.map((candle) => candle.close);
  const rsi = closes.length < 15 ? null : calculateRsi(closes, 14);
  const currentMacd = closes.length < 35 ? null : calculateMacd(closes);
  const previousMacd = closes.length < 36 ? null : calculateMacd(closes.slice(0, -1));
  const macdComplete = Boolean(currentMacd && currentMacd.macd !== null
    && currentMacd.signal !== null && currentMacd.histogram !== null);
  const macdCross = macdComplete && previousMacd !== null
      && previousMacd.macd !== null && previousMacd.signal !== null
    ? classifyMacdCross(previousMacd.macd!, previousMacd.signal!, currentMacd!.macd!, currentMacd!.signal!)
    : null;
  const ema20 = calculateEma(closes, 20);
  const ema75 = calculateEma(closes, 75);
  const ema200 = calculateEma(closes, 200);
  const emaComplete = [ema20, ema75, ema200].every(
    (value) => value !== null && Number.isFinite(value),
  );
  const atr = closes.length < 15 ? null : calculateAtr(candles, 14);
  const volumeRatio = candles.length < 21 ? null : calculateObservationVolumeRatio(candles, 20);

  return {
    rsi: rsi === null
      ? { availability: "INSUFFICIENT_HISTORY" as const, value: null, reason: "REQUIRES_15_CANDLES" }
      : { availability: "AVAILABLE" as const, value: rsi, reason: null },
    macd: !macdComplete
      ? { availability: "INSUFFICIENT_HISTORY" as const,
          value: { macd: null, signal: null, histogram: null, cross: null },
          reason: "REQUIRES_35_CANDLES" }
      : { availability: "AVAILABLE" as const,
          value: { ...currentMacd!, cross: macdCross }, reason: null },
    ema: { availability: emaComplete ? "AVAILABLE" as const : "INSUFFICIENT_HISTORY" as const,
      value: { ema20, ema75, ema200 }, reason: emaComplete ? null : "REQUIRES_200_CANDLES" },
    atr: atr === null
      ? { availability: "INSUFFICIENT_HISTORY" as const, value: null, reason: "REQUIRES_15_CANDLES" }
      : atr <= 0 || !Number.isFinite(atr)
        ? { availability: "UNAVAILABLE" as const, value: null, reason: "NON_POSITIVE_ATR" }
        : { availability: "AVAILABLE" as const, value: atr, reason: null },
    volumeRatio: volumeRatio === null
      ? { availability: candles.length < 21 ? "INSUFFICIENT_HISTORY" as const : "UNAVAILABLE" as const,
          value: null, reason: candles.length < 21 ? "REQUIRES_21_CANDLES" : "VOLUME_RATIO_UNAVAILABLE" }
      : !Number.isFinite(volumeRatio)
        ? { availability: "INVALID" as const, value: null, reason: "NON_FINITE_VOLUME_RATIO" }
        : { availability: "AVAILABLE" as const, value: volumeRatio, reason: null },
  } satisfies BollingerObservationIndicatorValues;
}

export function createBollingerObservationEvidence(
  candles: readonly TechnicalCandle[],
  timeframe: BollingerObservationTimeframe,
  options: { asOfIndex?: number } = {},
): BollingerObservationEvidence {
  const asOfIndex = options.asOfIndex ?? candles.length - 1;
  const validIndex = Number.isInteger(asOfIndex) && asOfIndex >= 0 && asOfIndex < candles.length;
  const visible = validIndex ? candles.slice(0, asOfIndex + 1) : [];
  const indicators = validIndex
    ? calculateIndependentIndicators(visible)
    : invalidIndicators("INVALID_AS_OF_INDEX");
  const existing = validIndex ? createIndicatorEvidence(candles, timeframe, options) : [];
  const byIndicator = {
    RSI: existing.filter((item) => item.source === "RSI14"),
    MACD: existing.filter((item) => item.source === "MACD_12_26_9"),
    EMA: existing.filter((item) => item.source.startsWith("EMA")),
    ATR: existing.filter((item) => item.source === "ATR14"),
    VOLUME_RATIO: existing.filter((item) => item.source === "VOLUME_RATIO_20"),
  } satisfies BollingerObservationEvidence["byIndicator"];
  const evidence = Object.values(byIndicator).flat();
  const diagnostics = Object.fromEntries(
    (["RSI", "MACD", "EMA", "ATR", "VOLUME_RATIO"] as const).flatMap((key) => {
      const item = key === "RSI" ? indicators.rsi : key === "MACD" ? indicators.macd
        : key === "EMA" ? indicators.ema : key === "ATR" ? indicators.atr : indicators.volumeRatio;
      return item.reason ? [[key, item.reason]] : [];
    }),
  );
  const available = Object.values(indicators).some((item) => item.availability === "AVAILABLE");
  return { available, reason: available ? null : "UNAVAILABLE_INDICATOR", evidence,
    byIndicator: evidence.length ? byIndicator : { ...EMPTY_BY_INDICATOR },
    macdCross: indicators.macd.value.cross, indicators, diagnostics };
}
