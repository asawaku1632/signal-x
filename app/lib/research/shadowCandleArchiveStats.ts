import {
  SHADOW_CANDLE_DETECTOR_VERSION,
  SHADOW_CANDLE_PATTERNS,
  type ShadowCandleId,
} from "./shadowCandlestickNine.ts";

type Outcome = {
  days: 1 | 3 | 5;
  date: string | null;
  directionalReturn: number | null;
};
export type ArchivedShadowEvent = {
  code: string;
  patternId: ShadowCandleId;
  tradeDate: string;
  direction: "BUY" | "SELL";
  outcomes: Outcome[];
};
export type ArchivedShadowRun = {
  id: string;
  detector_version: string;
  events: unknown;
};
export type ArchivedShadowStats = {
  patternId: ShadowCandleId;
  name: string;
  direction: "BUY" | "SELL";
  detections: number;
  codes: number;
  horizons: Array<{
    days: 1 | 3 | 5;
    completed: number;
    wins: number;
    winRate: number | null;
    meanReturn: number | null;
    worstReturn: number | null;
  }>;
};

function parseEvents(input: unknown): ArchivedShadowEvent[] {
  if (!Array.isArray(input)) return [];
  const ids = new Set<string>(SHADOW_CANDLE_PATTERNS.map(x => x.id));
  const events: ArchivedShadowEvent[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.code !== "string" || !/^[0-9A-Z]{4,5}$/.test(raw.code) ||
      typeof raw.tradeDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.tradeDate) ||
      typeof raw.patternId !== "string" || !ids.has(raw.patternId) ||
      (raw.direction !== "BUY" && raw.direction !== "SELL") ||
      !Array.isArray(raw.outcomes)) continue;
    const outcomes: Outcome[] = [];
    for (const i of [1, 3, 5] as const) {
      const outcome = raw.outcomes.find((o: unknown) => o &&
        typeof o === "object" && (o as Record<string, unknown>).days === i) as Record<string, unknown> | undefined;
      const returnValue = outcome?.directionalReturn;
      outcomes.push({
        days: i,
        date: typeof outcome?.date === "string" ? outcome.date : null,
        directionalReturn: typeof returnValue === "number" && Number.isFinite(returnValue)
          ? returnValue : null,
      });
    }
    events.push({
      code: raw.code,
      tradeDate: raw.tradeDate,
      patternId: raw.patternId as ShadowCandleId,
      direction: raw.direction,
      outcomes,
    });
  }
  return events;
}
function round(n: number) { return Math.round(n * 100) / 100; }

/**
 * Combine archives without double counting same code/date/pattern.
 * A later run may contain 5-day results missing from an earlier run.
 * 1/3/5 are treated as separate completed observations, never as failures
 * when future bars are unavailable.
 *
 * Only runs of exactly the same algorithm version are eligible.
 */
export function combineArchivedShadowRuns(runs: readonly ArchivedShadowRun[]): {
  rows: ArchivedShadowStats[];
  eventCount: number;
  stockCount: number;
} {
  const unique = new Map<string, ArchivedShadowEvent>();
  for (const run of runs) {
    if (run.detector_version !== SHADOW_CANDLE_DETECTOR_VERSION) continue;
    for (const event of parseEvents(run.events)) {
      const key = [event.code, event.tradeDate, event.patternId].join(":");
      const existing = unique.get(key);
      if (!existing) {
        unique.set(key, event);
        continue;
      }
      // Retain the first value when both runs contain a valid result;
      // fill only previously unavailable horizons from a newer/archive run.
      for (const h of event.outcomes) {
        const previous = existing.outcomes.find(x => x.days === h.days);
        if (previous && previous.directionalReturn === null && h.directionalReturn !== null) {
          previous.directionalReturn = h.directionalReturn;
          previous.date = h.date;
        }
      }
    }
  }
  const items = [...unique.values()];
  const rows = SHADOW_CANDLE_PATTERNS.map(def => {
    const matches = items.filter(x => x.patternId === def.id);
    const horizons = ([1, 3, 5] as const).map(days => {
      const completed = matches.flatMap(item => {
        const value = item.outcomes.find(x => x.days === days)?.directionalReturn;
        return typeof value === "number" ? [value] : [];
      });
      const wins = completed.filter(v => v > 0).length;
      return {
        days,
        completed: completed.length,
        wins,
        winRate: completed.length ? round(100 * wins / completed.length) : null,
        meanReturn: completed.length ? round(completed.reduce((sum, v) => sum + v, 0) / completed.length) : null,
        worstReturn: completed.length ? round(Math.min(...completed)) : null,
      };
    });
    return {
      patternId: def.id,
      name: def.name,
      direction: def.direction,
      detections: matches.length,
      codes: new Set(matches.map(x => x.code)).size,
      horizons,
    };
  });
  return {
    rows,
    eventCount: items.length,
    stockCount: new Set(items.map(x => x.code)).size,
  };
}
