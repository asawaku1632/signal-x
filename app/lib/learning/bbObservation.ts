import pool from "@/app/lib/postgres";
import type { BollingerSignal } from "@/app/lib/bollingerBands";
import {
  BB_EVALUATION_HORIZONS,
  BB_EVALUATION_CONCURRENCY,
  BB_EVALUATION_MAX_EVENTS,
  BB_EVALUATION_REQUEST_TIMEOUT_MS,
  BB_EVALUATION_TIME_BUDGET_MS,
  BB_SIGNAL_BATCH_SIZE,
  chunkBbItems,
  clampBbEvaluationOptions,
  findDuplicateCodes,
  getFutureTradingEvaluation,
  getObservationState,
  shouldCreateBbEvent,
  type BbSignalState,
  type TradingCandle,
} from "@/app/lib/learning/bbObservationCore";
import { allSettledWithConcurrency } from "@/app/lib/learning/promisePool";

export {
  BB_SIGNAL_BATCH_SIZE,
  BB_EVALUATION_MAX_EVENTS,
  BB_EVALUATION_CONCURRENCY,
  BB_EVALUATION_REQUEST_TIMEOUT_MS,
  BB_EVALUATION_TIME_BUDGET_MS,
};

export type BbObservationStock = {
  code: string;
  name: string;
  price: number;
  bollinger?: BollingerSignal;
  bbBonus?: number;
  bbBonusReason?: string;
  bbBonusEnabled?: boolean;
  rawAiPowerBeforeBollinger?: number;
  rawAiPower?: number;
  displayAiPowerBeforeBollinger?: number;
  aiPower?: number;
};

type BbQueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };
type BbQueryClient = {
  query: (text: string, values?: unknown[]) => Promise<BbQueryResult>;
  release: () => void;
};
export type BbObservationDatabase = {
  query: (text: string, values?: unknown[]) => Promise<BbQueryResult>;
  connect: () => Promise<BbQueryClient>;
};

function finite(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadStates(codes: string[], database: BbObservationDatabase) {
  if (codes.length === 0) return new Map<string, BbSignalState>();
  const result = await database.query(
    `SELECT code, side, status, upper_regime, active
       FROM bb_signal_states WHERE code = ANY($1::text[])`,
    [codes],
  );
  return new Map(result.rows.map((row) => [String(row.code), {
    side: String(row.side ?? "NONE"),
    status: String(row.status ?? "NONE"),
    upperRegime: String(row.upper_regime ?? "NONE"),
    active: row.active === true,
  }]));
}

export async function saveBbSignalEvents(
  signalDate: string,
  stocks: BbObservationStock[],
  options: {
    batchSize?: number;
    database?: BbObservationDatabase;
  } = {},
) {
  const batchSize = options.batchSize ?? BB_SIGNAL_BATCH_SIZE;
  const database = options.database ?? (pool as unknown as BbObservationDatabase);
  const duplicateCodes = findDuplicateCodes(stocks.map((stock) => stock.code));
  if (duplicateCodes.length > 0) {
    throw new Error(`duplicate BB snapshot codes: ${duplicateCodes.join(",")}`);
  }
  const states = await loadStates(stocks.map((stock) => stock.code), database);
  const client = await database.connect();
  let created = 0;
  let continued = 0;
  let reset = 0;
  let updatedStates = 0;
  let batchCount = 0;

  try {
    await client.query("BEGIN");
    for (const batch of chunkBbItems(stocks, batchSize)) {
      batchCount += 1;
      const eventValues: unknown[] = [];
      const eventRows: string[] = [];
      const stateValues: unknown[] = [];
      const stateRows: string[] = [];

      for (const stock of batch) {
        const current = getObservationState(stock.bollinger);
        const previous = states.get(stock.code);
        const createEvent = shouldCreateBbEvent(previous, current);
        const tradeDate = stock.bollinger?.tradeDate ?? signalDate;

        if (!current.active) {
          if (previous?.active) reset += 1;
        } else if (createEvent && stock.bollinger) {
          const signal = stock.bollinger;
          const base = eventValues.length;
          eventValues.push(
            stock.code, stock.name, tradeDate, finite(stock.price), signal.side,
            signal.status, signal.upperRegime ?? "NONE", signal.expectation,
            signal.bandWalkRisk, finite(stock.bbBonus), stock.bbBonusReason ?? "",
            stock.bbBonusEnabled !== false, signal.upper, signal.middle, signal.lower,
            signal.distancePercent, signal.bandWidthPercent,
            finite(stock.rawAiPowerBeforeBollinger), finite(stock.rawAiPower),
            finite(stock.displayAiPowerBeforeBollinger), finite(stock.aiPower),
            JSON.stringify(signal.confirmations), JSON.stringify(signal.warnings),
          );
          eventRows.push(`(${Array.from({ length: 23 }, (_, index) => {
            const parameter = `$${base + index + 1}`;
            return index >= 21 ? `${parameter}::jsonb` : parameter;
          }).join(",")})`);
        } else if (current.active) {
          continued += 1;
        }

        const stateBase = stateValues.length;
        stateValues.push(
          stock.code, current.side, current.status, current.upperRegime,
          current.active, tradeDate,
        );
        stateRows.push(`(${Array.from({ length: 6 }, (_, index) => `$${stateBase + index + 1}`).join(",")},NOW())`);
        states.set(stock.code, current);
      }

      if (eventRows.length > 0) {
        const inserted = await client.query(
          `INSERT INTO bb_signal_events (
             code, name, signal_date, entry_price, side, status, upper_regime,
             expectation, band_walk_risk, bb_bonus, bb_bonus_reason,
             bb_bonus_enabled, upper_band, middle_band, lower_band,
             distance_percent, band_width_percent, raw_ai_power_before_bb,
             raw_ai_power_after_bb, display_ai_power_before_bb,
             display_ai_power_after_bb, confirmations, warnings
           ) VALUES ${eventRows.join(",")}
           ON CONFLICT ON CONSTRAINT bb_signal_events_idempotency_key DO NOTHING`,
          eventValues,
        );
        created += inserted.rowCount ?? 0;
      }

      const stateResult = await client.query(
        `INSERT INTO bb_signal_states (
           code, side, status, upper_regime, active, entered_trade_date,
           last_seen_trade_date, updated_at
         ) VALUES ${stateRows.join(",")}
         ON CONFLICT (code) DO UPDATE SET
           side = EXCLUDED.side,
           status = EXCLUDED.status,
           upper_regime = EXCLUDED.upper_regime,
           active = EXCLUDED.active,
           entered_trade_date = CASE
             WHEN bb_signal_states.active = FALSE OR
                  bb_signal_states.side IS DISTINCT FROM EXCLUDED.side OR
                  bb_signal_states.status IS DISTINCT FROM EXCLUDED.status OR
                  bb_signal_states.upper_regime IS DISTINCT FROM EXCLUDED.upper_regime
             THEN EXCLUDED.entered_trade_date
             ELSE bb_signal_states.entered_trade_date
           END,
           last_seen_trade_date = EXCLUDED.last_seen_trade_date,
           updated_at = NOW()
         WHERE bb_signal_states.last_seen_trade_date <= EXCLUDED.last_seen_trade_date`,
        stateValues,
      );
      updatedStates += stateResult.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return {
      created,
      continued,
      reset,
      processed: stocks.length,
      updatedStates,
      batchCount,
      batchSize,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function toTradeDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp * 1_000));
}

async function fetchDailyCandles(
  code: string,
  timeoutMs = BB_EVALUATION_REQUEST_TIMEOUT_MS,
): Promise<TradingCandle[]> {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}.T?range=1y&interval=1d`,
    { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) },
  );
  if (!response.ok) throw new Error(`BB evaluation chart failed: ${code}`);
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];
  return timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    return Number.isFinite(close)
      ? [{ tradeDate: toTradeDate(timestamp), close: Number(close) }]
      : [];
  });
}

export type BbEvaluationOptions = {
  limit?: number;
  concurrency?: number;
  requestTimeoutMs?: number;
  timeBudgetMs?: number;
  fetchCandles?: (code: string, timeoutMs: number) => Promise<TradingCandle[]>;
  database?: BbObservationDatabase;
};

export async function evaluatePendingBbEvents(options: BbEvaluationOptions = {}) {
  const { limit, concurrency, requestTimeoutMs, timeBudgetMs } =
    clampBbEvaluationOptions(options);
  const fetcher = options.fetchCandles ?? fetchDailyCandles;
  const database = options.database ?? (pool as unknown as BbObservationDatabase);
  const startedAt = Date.now();
  const pending = await database.query(
    `SELECT e.id, e.code, e.signal_date::text, e.entry_price
       FROM bb_signal_events e
      WHERE EXISTS (
        SELECT 1 FROM unnest(ARRAY[1,5,10,20]) AS h(horizon)
         WHERE NOT EXISTS (
           SELECT 1 FROM bb_signal_event_results r
            WHERE r.event_id = e.id AND r.horizon = h.horizon
         )
      )
      ORDER BY e.signal_date ASC, e.id ASC
      LIMIT $1`,
    [limit],
  );
  const candleCache = new Map<string, Promise<TradingCandle[]>>();
  const settled = await allSettledWithConcurrency(pending.rows, concurrency, async (event) => {
    if (Date.now() - startedAt >= timeBudgetMs) {
      return { evaluated: 0, apiFailed: false, budgetSkipped: true };
    }
    const code = String(event.code);
    let candlePromise = candleCache.get(code);
    if (!candlePromise) {
      candlePromise = fetcher(code, requestTimeoutMs);
      candleCache.set(code, candlePromise);
    }
    let candles: TradingCandle[];
    try {
      candles = await candlePromise;
    } catch {
      candleCache.delete(code);
      return { evaluated: 0, apiFailed: true, budgetSkipped: false };
    }
    let evaluated = 0;
    for (const horizon of BB_EVALUATION_HORIZONS) {
      const value = getFutureTradingEvaluation(
        candles,
        String(event.signal_date).slice(0, 10),
        horizon,
        finite(event.entry_price),
      );
      if (!value) continue;
      const inserted = await database.query(
        `INSERT INTO bb_signal_event_results (
           event_id, horizon, future_price, return_percent, evaluated_trade_date
         ) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT ON CONSTRAINT bb_signal_event_results_idempotency_key DO NOTHING`,
        [event.id, horizon, value.futurePrice, value.returnPercent, value.evaluatedTradeDate],
      );
      evaluated += inserted.rowCount ?? 0;
    }
    return { evaluated, apiFailed: false, budgetSkipped: false };
  });
  const summary = settled.reduce(
    (result, item) => {
      if (item.status === "rejected") {
        result.failedEvents += 1;
      } else {
        result.evaluated += item.value.evaluated;
        if (item.value.apiFailed) result.apiFailedEvents += 1;
        if (item.value.budgetSkipped) result.budgetSkippedEvents += 1;
      }
      return result;
    },
    { evaluated: 0, failedEvents: 0, apiFailedEvents: 0, budgetSkippedEvents: 0 },
  );
  return {
    pendingEvents: pending.rowCount ?? 0,
    attemptedEvents: settled.length,
    ...summary,
    remainingExpected: (pending.rowCount ?? 0) === limit,
    durationMs: Date.now() - startedAt,
    limit,
    concurrency,
    requestTimeoutMs,
    timeBudgetMs,
  };
}
