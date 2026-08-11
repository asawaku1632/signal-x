import pool from "@/app/lib/postgres";
import type { BollingerSignal } from "@/app/lib/bollingerBands";
import {
  BB_EVALUATION_HORIZONS,
  getFutureTradingEvaluation,
  getObservationState,
  shouldCreateBbEvent,
  type BbSignalState,
  type TradingCandle,
} from "@/app/lib/learning/bbObservationCore";

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

function finite(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadStates(codes: string[]) {
  if (codes.length === 0) return new Map<string, BbSignalState>();
  const result = await pool.query(
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
) {
  const states = await loadStates(stocks.map((stock) => stock.code));
  const client = await pool.connect();
  let created = 0;
  let continued = 0;
  let reset = 0;

  try {
    await client.query("BEGIN");
    for (const stock of stocks) {
      const current = getObservationState(stock.bollinger);
      const previous = states.get(stock.code);
      const createEvent = shouldCreateBbEvent(previous, current);

      if (!current.active) {
        if (previous?.active) reset += 1;
      } else if (createEvent && stock.bollinger) {
        const signal = stock.bollinger;
        const eventSignalDate = signal.tradeDate ?? signalDate;
        const inserted = await client.query(
          `INSERT INTO bb_signal_events (
             code, name, signal_date, entry_price, side, status, upper_regime,
             expectation, band_walk_risk, bb_bonus, bb_bonus_reason,
             bb_bonus_enabled, upper_band, middle_band, lower_band,
             distance_percent, band_width_percent,
             raw_ai_power_before_bb, raw_ai_power_after_bb,
             display_ai_power_before_bb, display_ai_power_after_bb,
             confirmations, warnings
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
             $18,$19,$20,$21,$22::jsonb,$23::jsonb
           )
           ON CONFLICT ON CONSTRAINT bb_signal_events_idempotency_key DO NOTHING
           RETURNING id`,
          [
            stock.code,
            stock.name,
            eventSignalDate,
            finite(stock.price),
            signal.side,
            signal.status,
            signal.upperRegime ?? "NONE",
            signal.expectation,
            signal.bandWalkRisk,
            finite(stock.bbBonus),
            stock.bbBonusReason ?? "",
            stock.bbBonusEnabled !== false,
            signal.upper,
            signal.middle,
            signal.lower,
            signal.distancePercent,
            signal.bandWidthPercent,
            finite(stock.rawAiPowerBeforeBollinger),
            finite(stock.rawAiPower),
            finite(stock.displayAiPowerBeforeBollinger),
            finite(stock.aiPower),
            JSON.stringify(signal.confirmations),
            JSON.stringify(signal.warnings),
          ],
        );
        created += inserted.rowCount ?? 0;
      } else if (current.active) {
        continued += 1;
      }

      await client.query(
        `INSERT INTO bb_signal_states (
           code, side, status, upper_regime, active, entered_trade_date,
           last_seen_trade_date, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$6,NOW())
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
           updated_at = NOW()`,
        [
          stock.code,
          current.side,
          current.status,
          current.upperRegime,
          current.active,
          stock.bollinger?.tradeDate ?? signalDate,
        ],
      );
      states.set(stock.code, current);
    }
    await client.query("COMMIT");
    return { created, continued, reset, processed: stocks.length };
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

async function fetchDailyCandles(code: string): Promise<TradingCandle[]> {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}.T?range=1y&interval=1d`,
    { cache: "no-store", signal: AbortSignal.timeout(15_000) },
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

export async function evaluatePendingBbEvents(limit = 1_000) {
  const pending = await pool.query(
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
  const candleCache = new Map<string, TradingCandle[]>();
  let evaluated = 0;

  for (const event of pending.rows) {
    const code = String(event.code);
    let candles = candleCache.get(code);
    if (!candles) {
      try {
        candles = await fetchDailyCandles(code);
        candleCache.set(code, candles);
      } catch {
        continue;
      }
    }
    for (const horizon of BB_EVALUATION_HORIZONS) {
      const value = getFutureTradingEvaluation(
        candles,
        String(event.signal_date).slice(0, 10),
        horizon,
        finite(event.entry_price),
      );
      if (!value) continue;
      const inserted = await pool.query(
        `INSERT INTO bb_signal_event_results (
           event_id, horizon, future_price, return_percent, evaluated_trade_date
         ) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT ON CONSTRAINT bb_signal_event_results_idempotency_key DO NOTHING`,
        [event.id, horizon, value.futurePrice, value.returnPercent, value.evaluatedTradeDate],
      );
      evaluated += inserted.rowCount ?? 0;
    }
  }
  return { pendingEvents: pending.rowCount ?? 0, evaluated };
}

export async function runBbObservation(
  signalDate: string,
  stocks: BbObservationStock[],
) {
  const saved = await saveBbSignalEvents(signalDate, stocks);
  const evaluation = await evaluatePendingBbEvents();
  return { saved, evaluation };
}
