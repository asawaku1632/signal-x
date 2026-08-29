import { isValidTechnicalCandle } from "./candleMetrics.ts";
import type { TechnicalCandle } from "./types.ts";

export type DmiSnapshot = { adx: number; plusDi: number; minusDi: number };

export function calculateDmiSnapshot(
  candles: readonly TechnicalCandle[],
  period = 14,
): DmiSnapshot | null {
  if (!Number.isInteger(period) || period < 2 || candles.length < period * 2) return null;
  if (candles.some((candle) => !isValidTechnicalCandle(candle))) return null;
  const trueRanges: number[] = [];
  const plusMoves: number[] = [];
  const minusMoves: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index]; const previous = candles[index - 1];
    trueRanges.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)));
    const upMove = current.high - previous.high; const downMove = previous.low - current.low;
    plusMoves.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusMoves.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  let smoothedTr = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0);
  let smoothedPlus = plusMoves.slice(0, period).reduce((sum, value) => sum + value, 0);
  let smoothedMinus = minusMoves.slice(0, period).reduce((sum, value) => sum + value, 0);
  const dxValues: number[] = [];
  let plusDi = 0; let minusDi = 0;
  for (let index = period - 1; index < trueRanges.length; index += 1) {
    if (index >= period) {
      smoothedTr = smoothedTr - smoothedTr / period + trueRanges[index];
      smoothedPlus = smoothedPlus - smoothedPlus / period + plusMoves[index];
      smoothedMinus = smoothedMinus - smoothedMinus / period + minusMoves[index];
    }
    if (smoothedTr <= 0) return null;
    plusDi = smoothedPlus / smoothedTr * 100;
    minusDi = smoothedMinus / smoothedTr * 100;
    const sum = plusDi + minusDi;
    dxValues.push(sum > 0 ? Math.abs(plusDi - minusDi) / sum * 100 : 0);
  }
  if (dxValues.length < period) return null;
  let adx = dxValues.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let index = period; index < dxValues.length; index += 1) adx = (adx * (period - 1) + dxValues[index]) / period;
  return { adx, plusDi, minusDi };
}
