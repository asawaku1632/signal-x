import {
  PHASE7_BEGIN_SQL, PHASE7_COMMIT_SQL, PHASE7_ROLLBACK_SQL, RESULT_COLUMNS, PHASE7_RESULT_SELECT_SQL, PHASE7_RESULT_INSERT_SQL,
} from "./bollingerShadowQueries.ts";
import { canonicalNumericEqual, normalizeDateOnly } from "./bollingerObservationPersistence.ts";
import { assertPhase7LeaseForSave, type Phase7LeaseOwner } from "./bollingerShadowLeaseFence.ts";
import { BOLLINGER_OBSERVATION_RESULT_VERSION } from "./bollingerObservationTypes.ts";
import type { BollingerCompletedFutureResult } from "./bollingerObservationResultTypes.ts";

export type BollingerResultPersistenceInput = BollingerCompletedFutureResult & {
  eventId: number;
};

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };
type QueryClient = { query(text: string, values?: unknown[]): Promise<QueryResult>; release(): void };
export type BollingerResultDatabase = { connect(): Promise<QueryClient> };

const NUMERIC_RESULT_COLUMNS = new Set([
  "event_id", "horizon", "entry_price", "future_close", "return_percent", "max_rise_percent",
  "max_drawdown_percent", "window_candle_count",
]);
const DATE_RESULT_COLUMNS = new Set([
  "max_rise_trade_date", "max_drawdown_trade_date", "evaluated_trade_date",
]);

function resultRow(input: BollingerResultPersistenceInput) {
  return {
    event_id: input.eventId, horizon: input.horizon, horizon_unit: input.horizonUnit,
    entry_price: input.entryPrice, future_close: input.futureClose, return_percent: input.returnPercent,
    max_rise_percent: input.maxRisePercent, max_drawdown_percent: input.maxDrawdownPercent,
    max_rise_trade_date: input.maxRiseTradeDate, max_drawdown_trade_date: input.maxDrawdownTradeDate,
    evaluated_trade_date: input.evaluatedTradeDate, window_candle_count: input.windowCandleCount,
    result_quality: input.resultQuality, result_version: input.resultVersion,
  };
}

function validateResult(input: BollingerResultPersistenceInput) {
  if (!Number.isSafeInteger(input.eventId) || input.eventId <= 0) throw new Error("INVALID_EVENT_ID");
  if (![1, 3, 5].includes(input.horizon)) throw new Error("INVALID_RESULT_HORIZON");
  if (input.horizonUnit !== "TRADING_DAY") throw new Error("INVALID_HORIZON_UNIT");
  for (const value of [input.entryPrice, input.futureClose, input.returnPercent,
    input.maxRisePercent, input.maxDrawdownPercent]) {
    if (!Number.isFinite(value)) throw new Error("INVALID_RESULT_NUMERIC");
  }
  if (input.entryPrice <= 0 || input.futureClose <= 0) throw new Error("INVALID_RESULT_PRICE");
  if (input.windowCandleCount !== input.horizon) throw new Error("INVALID_WINDOW_CANDLE_COUNT");
  if (input.resultQuality !== "COMPLETE") throw new Error("INVALID_RESULT_QUALITY");
  if (input.resultVersion !== BOLLINGER_OBSERVATION_RESULT_VERSION) throw new Error("INVALID_RESULT_VERSION");
  for (const date of [input.maxRiseTradeDate, input.maxDrawdownTradeDate, input.evaluatedTradeDate]) {
    if (!normalizeDateOnly(date)) throw new Error("INVALID_RESULT_DATE");
  }
}

export function findCanonicalResultMismatch(
  actual: Record<string, unknown>,
  expected: BollingerResultPersistenceInput,
) {
  const wanted = resultRow(expected);
  for (const column of RESULT_COLUMNS) {
    const matches = NUMERIC_RESULT_COLUMNS.has(column)
      ? canonicalNumericEqual(actual[column], wanted[column])
      : DATE_RESULT_COLUMNS.has(column)
        ? normalizeDateOnly(actual[column]) !== null
          && normalizeDateOnly(actual[column]) === normalizeDateOnly(wanted[column])
        : String(actual[column]) === String(wanted[column]);
    if (!matches) return column;
  }
  return null;
}

async function defaultDatabase(): Promise<BollingerResultDatabase> {
  const { default: pool } = await import("../postgres.ts");
  return pool as unknown as BollingerResultDatabase;
}

export async function saveBollingerObservationResults(
  inputs: readonly BollingerResultPersistenceInput[],
  options: { database?: BollingerResultDatabase; evaluatedAt?: Date;
    validateParent?: (client: QueryClient, eventId: number) => Promise<void>;
    lease?: Phase7LeaseOwner } = {},
) {
  if (inputs.length === 0) return { created: 0, existing: 0 };
  inputs.forEach(validateResult);
  const eventId = inputs[0].eventId;
  if (inputs.some((input) => input.eventId !== eventId)) throw new Error("MIXED_RESULT_EVENT_IDS");
  const horizons = new Set(inputs.map((input) => input.horizon));
  if (horizons.size !== inputs.length) throw new Error("DUPLICATE_RESULT_HORIZON");
  const evaluatedAt = options.evaluatedAt ?? new Date();
  if (!Number.isFinite(evaluatedAt.getTime())) throw new Error("INVALID_EVALUATED_AT");
  const client = await (options.database ?? await defaultDatabase()).connect();
  let created = 0;
  let existing = 0;
  try {
    await client.query(PHASE7_BEGIN_SQL);
    if (options.lease) await assertPhase7LeaseForSave(client, options.lease);
    // Phase 7 validates and locks provenance in the same transaction as the result INSERTs.
    if (options.validateParent) await options.validateParent(client, eventId);
    for (const input of [...inputs].sort((a, b) => a.horizon - b.horizon)) {
      const expected = resultRow(input);
      let selected = await client.query(
        PHASE7_RESULT_SELECT_SQL,
        [input.eventId, input.horizon, input.horizonUnit, input.resultVersion],
      );
      if (selected.rows[0]) {
        const mismatch = findCanonicalResultMismatch(selected.rows[0], input);
        if (mismatch) throw new Error(`CANONICAL_RESULT_MISMATCH:${mismatch}`);
        existing += 1;
        continue;
      }
      const values = RESULT_COLUMNS.map((column) => expected[column]);
      const inserted = await client.query(
        PHASE7_RESULT_INSERT_SQL, [...values, evaluatedAt.toISOString()],
      );
      if (inserted.rows[0]) {
        created += 1;
        continue;
      }
      selected = await client.query(
        PHASE7_RESULT_SELECT_SQL,
        [input.eventId, input.horizon, input.horizonUnit, input.resultVersion],
      );
      if (!selected.rows[0]) throw new Error("RESULT_CONFLICT_NOT_FOUND");
      const mismatch = findCanonicalResultMismatch(selected.rows[0], input);
      if (mismatch) throw new Error(`CANONICAL_RESULT_MISMATCH:${mismatch}`);
      existing += 1;
    }
    await client.query(PHASE7_COMMIT_SQL);
    return { created, existing };
  } catch (error) {
    await client.query(PHASE7_ROLLBACK_SQL);
    throw error;
  } finally {
    client.release();
  }
}
