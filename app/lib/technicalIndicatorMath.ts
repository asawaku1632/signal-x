export function calculateRsi(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;

  let gains = 0;
  let losses = 0;
  const target = closes.slice(-period - 1);

  for (let index = 1; index < target.length; index += 1) {
    const diff = target[index] - target[index - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  if (losses === 0) return 70;

  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / avgLoss;

  return Math.round(100 - 100 / (1 + rs));
}

export function calculateEmaSeries(values: number[], period: number) {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return result;

  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = ema;

  for (let index = period; index < values.length; index += 1) {
    ema = (values[index] - ema) * multiplier + ema;
    result[index] = ema;
  }

  return result;
}

export function calculateEma(values: number[], period: number) {
  const series = calculateEmaSeries(values, period);
  const value = series.at(-1);
  return value === null || value === undefined ? null : Number(value.toFixed(2));
}

export function calculateMacd(closes: number[]) {
  if (closes.length < 35) {
    return { macd: null, signal: null, histogram: null };
  }

  const ema12Series = calculateEmaSeries(closes, 12);
  const ema26Series = calculateEmaSeries(closes, 26);
  const macdLine = closes.map((_, index) => {
    const ema12 = ema12Series[index];
    const ema26 = ema26Series[index];
    return ema12 === null || ema26 === null ? null : ema12 - ema26;
  });
  const validMacd = macdLine.filter((value): value is number => value !== null);
  const signal = calculateEma(validMacd, 9);
  const macd = validMacd.at(-1) ?? null;

  if (macd === null || signal === null) {
    return { macd: null, signal: null, histogram: null };
  }

  return {
    macd: Number(macd.toFixed(2)),
    signal: Number(signal.toFixed(2)),
    histogram: Number((macd - signal).toFixed(2)),
  };
}
