import { calculateBollingerObservationStatistics, validateBollingerStatisticsFilter } from "./bollingerObservationStatistics.ts";
import type { BollingerStatisticsFilter, BollingerStatisticsRow } from "./bollingerObservationStatisticsTypes.ts";

type QueryResult = { rows: Record<string, unknown>[] };
export type BollingerStatisticsDatabase = { query(text: string, values?: unknown[]): Promise<QueryResult> };

export function buildBollingerStatisticsQuery(filter: BollingerStatisticsFilter) {
  validateBollingerStatisticsFilter(filter);
  const values: unknown[] = [];
  const parameter = (value: unknown) => { values.push(value); return `$${values.length}`; };
  const where = [
    `s.timeframe = ${parameter(filter.timeframe)}`,
    `e.side = ${parameter(filter.side)}`,
    `e.sigma_level = ${parameter(filter.sigmaLevel)}`,
    `e.event_type = ${parameter(filter.eventType)}`,
    `s.detector_version = ${parameter(filter.detectorVersion)}`,
  ];
  if (filter.fromDate) where.push(`s.observation_date >= ${parameter(filter.fromDate)}`);
  if (filter.toDate) where.push(`s.observation_date <= ${parameter(filter.toDate)}`);
  if (filter.code) where.push(`s.code = ${parameter(filter.code.trim())}`);
  const addRange = (column: string, availability: string, min: number | undefined, max: number | undefined) => {
    if (min === undefined && max === undefined) return;
    where.push(`s.${availability} = 'AVAILABLE'`);
    if (min !== undefined) where.push(`s.${column} >= ${parameter(min)}`);
    if (max !== undefined) where.push(`s.${column} <= ${parameter(max)}`);
  };
  addRange("rsi14", "rsi_availability", filter.rsiMin, filter.rsiMax);
  if (filter.macdCross !== undefined || filter.macdHistogramMin !== undefined
    || filter.macdHistogramMax !== undefined) {
    where.push("s.macd_availability = 'AVAILABLE'");
    if (filter.macdCross !== undefined) where.push(`s.macd_cross = ${parameter(filter.macdCross)}`);
    if (filter.macdHistogramMin !== undefined) where.push(`s.macd_histogram >= ${parameter(filter.macdHistogramMin)}`);
    if (filter.macdHistogramMax !== undefined) where.push(`s.macd_histogram <= ${parameter(filter.macdHistogramMax)}`);
  }
  addRange("ema20", "ema_availability", filter.ema20Min, filter.ema20Max);
  addRange("ema75", "ema_availability", filter.ema75Min, filter.ema75Max);
  addRange("ema200", "ema_availability", filter.ema200Min, filter.ema200Max);
  addRange("volume_ratio_20", "volume_ratio_availability", filter.volumeRatioMin, filter.volumeRatioMax);
  const horizon = parameter(filter.horizon);
  const resultVersion = parameter(filter.resultVersion);
  return {
    text: `SELECT e.id AS event_id, r.return_percent, r.max_rise_percent, r.max_drawdown_percent
      FROM technical_bb_observation_events e
      JOIN technical_bb_observation_snapshots s ON s.id = e.snapshot_id
      LEFT JOIN technical_bb_observation_results r
        ON r.event_id = e.id
       AND r.horizon = ${horizon}
       AND r.horizon_unit = 'TRADING_DAY'
       AND r.result_version = ${resultVersion}
       AND r.result_quality = 'COMPLETE'
      WHERE ${where.join(" AND ")}
      ORDER BY e.id`,
    values,
  };
}

async function defaultDatabase(): Promise<BollingerStatisticsDatabase> {
  const { default: pool } = await import("../postgres.ts");
  return pool as unknown as BollingerStatisticsDatabase;
}

export async function getBollingerObservationStatistics(
  filter: BollingerStatisticsFilter,
  database?: BollingerStatisticsDatabase,
) {
  const query = buildBollingerStatisticsQuery(filter);
  const result = await (database ?? await defaultDatabase()).query(query.text, query.values);
  const rows: BollingerStatisticsRow[] = result.rows.map((row) => ({
    eventId: Number(row.event_id),
    rawReturn: row.return_percent === null || row.return_percent === undefined ? null : Number(row.return_percent),
    maxRise: row.max_rise_percent === null || row.max_rise_percent === undefined ? null : Number(row.max_rise_percent),
    maxDrawdown: row.max_drawdown_percent === null || row.max_drawdown_percent === undefined ? null : Number(row.max_drawdown_percent),
  }));
  return calculateBollingerObservationStatistics(filter, rows);
}
