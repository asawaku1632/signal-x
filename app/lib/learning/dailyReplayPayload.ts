/**
 * Phase 1 of durable daily-scan replay: pure, side-effect-free validation.
 * Not wired into production until persistence and replay are verified.
 */
export type DailyReplayPatternObservation = {
  id: string;
  name: string;
  direction: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  score: number;
};

export type DailyReplayStock = {
  code: string;
  name: string;
  price: number;
  score?: number;
  aiPower?: number;
  changePercent?: number;
  result?: string;
  patternKey?: string;
  patternLearning?: {
    rsiBand?: string;
    trendKey?: string;
    ema20Key?: string;
    vwapKey?: string;
    macdKey?: string;
    patternKey?: string;
    patternObservations?: DailyReplayPatternObservation[];
  };
};

export type DailyReplayPayload = {
  schemaVersion: 1;
  tradeDate: string;
  sourceRunId: string;
  stocks: DailyReplayStock[];
};

export function validateDailyReplayPayload(value: unknown): asserts value is DailyReplayPayload {
  if (!value || typeof value !== "object") throw new Error("REPLAY_PAYLOAD_INVALID");
  const p = value as Record<string, unknown>;
  if (p.schemaVersion !== 1) throw new Error("REPLAY_SCHEMA_UNSUPPORTED");
  if (typeof p.tradeDate !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(p.tradeDate) ||
      new Date(p.tradeDate + "T00:00:00Z").toISOString().slice(0, 10) !== p.tradeDate) {
    throw new Error("REPLAY_DATE_INVALID");
  }
  if (typeof p.sourceRunId !== "string" || !p.sourceRunId.trim()) throw new Error("REPLAY_RUN_ID_MISSING");
  if (!Array.isArray(p.stocks) || p.stocks.length === 0) throw new Error("REPLAY_STOCKS_EMPTY");
  const seen = new Set<string>();
  for (const item of p.stocks) {
    if (!item || typeof item !== "object") throw new Error("REPLAY_STOCK_INVALID");
    const s = item as Record<string, unknown>;
    if (typeof s.code !== "string" || !/^\\d{4,5}$/.test(s.code) || seen.has(s.code)) {
      throw new Error("REPLAY_CODE_INVALID_OR_DUPLICATE");
    }
    seen.add(s.code);
    if (typeof s.name !== "string" || !s.name.trim() ||
        typeof s.price !== "number" || !Number.isFinite(s.price) || s.price <= 0) {
      throw new Error("REPLAY_STOCK_NAME_OR_PRICE_INVALID");
    }
    for (const field of ["score", "aiPower", "changePercent"]) {
      if (s[field] !== undefined && (typeof s[field] !== "number" || !Number.isFinite(s[field]))) {
        throw new Error("REPLAY_NUMBER_INVALID:" + field);
      }
    }
    if (s.patternLearning !== undefined) {
      if (!s.patternLearning || typeof s.patternLearning !== "object" || Array.isArray(s.patternLearning)) {
        throw new Error("REPLAY_PATTERN_INVALID");
      }
      const pattern = s.patternLearning as Record<string, unknown>;
      for (const field of ["rsiBand", "trendKey", "ema20Key", "vwapKey", "macdKey", "patternKey"]) {
        if (pattern[field] !== undefined && typeof pattern[field] !== "string") throw new Error("REPLAY_PATTERN_FIELD_INVALID");
      }
      if (pattern.patternObservations !== undefined) {
        if (!Array.isArray(pattern.patternObservations)) throw new Error("REPLAY_OBSERVATIONS_INVALID");
        for (const observation of pattern.patternObservations) {
          if (!observation || typeof observation.id !== "string" || !observation.id ||
              typeof observation.name !== "string" || !observation.name ||
              !["BUY", "SELL", "NEUTRAL"].includes(observation.direction) ||
              typeof observation.confidence !== "number" || !Number.isFinite(observation.confidence) ||
              typeof observation.score !== "number" || !Number.isFinite(observation.score)) {
            throw new Error("REPLAY_OBSERVATION_INVALID");
          }
        }
      }
    }
  }
}
