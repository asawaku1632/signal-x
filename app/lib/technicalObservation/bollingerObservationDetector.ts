import {
  BOLLINGER_EVENT_SIGMA_LEVELS,
  type BollingerEventBands,
  type BollingerEventCandle,
  type BollingerObservationEvent,
} from "./bollingerObservationTypes.ts";

function validCandle(candle: BollingerEventCandle | null | undefined) {
  return Boolean(candle && [candle.close, candle.high, candle.low].every(Number.isFinite)
    && candle.close > 0 && candle.high > 0 && candle.low > 0
    && candle.high >= candle.close && candle.close >= candle.low);
}

function validBands(bands: BollingerEventBands | null | undefined) {
  return Boolean(bands && Object.values(bands).every((value) => Number.isFinite(value) && value > 0)
    && bands.lower3 <= bands.lower2 && bands.lower2 < bands.upper2 && bands.upper2 <= bands.upper3);
}

export function detectBollingerObservationEvents(input: {
  current: BollingerEventCandle;
  currentBands: BollingerEventBands;
  previous?: BollingerEventCandle | null;
  previousBands?: BollingerEventBands | null;
}): BollingerObservationEvent[] {
  if (!validCandle(input.current) || !validBands(input.currentBands)) return [];
  const events: BollingerObservationEvent[] = [];
  const hasPrevious = validCandle(input.previous) && validBands(input.previousBands);

  for (const sigmaLevel of BOLLINGER_EVENT_SIGMA_LEVELS) {
    const lowerKey = `lower${sigmaLevel}` as const;
    const upperKey = `upper${sigmaLevel}` as const;
    const currentLower = input.currentBands[lowerKey];
    const currentUpper = input.currentBands[upperKey];

    if (input.current.low <= currentLower) events.push({ type: "TOUCH", side: "LOWER", sigmaLevel });
    if (input.current.high >= currentUpper) events.push({ type: "TOUCH", side: "UPPER", sigmaLevel });
    if (!hasPrevious) continue;

    const previous = input.previous!;
    const previousBands = input.previousBands!;
    const previousLower = previousBands[lowerKey];
    const previousUpper = previousBands[upperKey];
    if (previous.close > previousLower && input.current.close <= currentLower) {
      events.push({ type: "CROSS", side: "LOWER", sigmaLevel });
    }
    if (previous.close < previousUpper && input.current.close >= currentUpper) {
      events.push({ type: "CROSS", side: "UPPER", sigmaLevel });
    }
    if (previous.close <= previousLower && input.current.close <= currentLower) {
      events.push({ type: "CONTINUATION", side: "LOWER", sigmaLevel });
    }
    if (previous.close >= previousUpper && input.current.close >= currentUpper) {
      events.push({ type: "CONTINUATION", side: "UPPER", sigmaLevel });
    }
    if (previous.close <= previousLower && input.current.close > currentLower) {
      events.push({ type: "RETURN_INSIDE", side: "LOWER", sigmaLevel });
    }
    if (previous.close >= previousUpper && input.current.close < currentUpper) {
      events.push({ type: "RETURN_INSIDE", side: "UPPER", sigmaLevel });
    }
  }
  return events;
}
