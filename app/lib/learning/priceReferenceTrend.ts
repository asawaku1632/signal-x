import pool from "@/app/lib/postgres";
import { getSectorKey, sectorLabelMap } from "@/app/lib/sectorMap";
import { jstToday } from "@/app/lib/learning/priceReferenceObservations";

const MAX_RESEARCH_ROWS = 5_000;
const RESEARCH_DAYS = 90;

export type PriceReferenceTrendRow = {
  trade_date: string; code: string; name: string;
  baseline_price: string | number; reference_price: string | number;
  baseline_saved_hour_jst: string | number | null;
  observation_date_jst: string; reference_source: string;
};

export type TrendItem = {
  label: string; records: number; matched: number; differing: number;
  large: number; meanAbsPercent: number; maxAbsPercent: number;
};

type Observation = {
  date: string; code: string; name: string; baseline: number;
  reference: number; differenceYen: number; differencePercent: number;
  absPercent: number; matched: boolean; saveHourJst: number | null; sector: string;
  observationDate: string;
};

export function priceRangeLabel(price: number) {
  if (price < 1_000) return "1,000円未満";
  if (price < 3_000) return "1,000〜2,999円";
  if (price < 10_000) return "3,000〜9,999円";
  return "10,000円以上";
}

function numeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function hour(value: PriceReferenceTrendRow["baseline_saved_hour_jst"]): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : null;
}
function round(n: number, places = 3) { return Number(n.toFixed(places)); }

function summarizeGroup(label: string, rows: Observation[]): TrendItem {
  return {
    label, records: rows.length,
    matched: rows.filter((x) => x.matched).length,
    differing: rows.filter((x) => !x.matched).length,
    large: rows.filter((x) => x.absPercent >= 0.5).length,
    meanAbsPercent: round(rows.reduce((sum, x) => sum + x.absPercent, 0) / rows.length),
    maxAbsPercent: round(Math.max(...rows.map((x) => x.absPercent))),
  };
}

function group(rows: Observation[], key: (row: Observation) => string) {
  const map = new Map<string, Observation[]>();
  for (const row of rows) {
    const label = key(row);
    map.set(label, [...(map.get(label) ?? []), row]);
  }
  return [...map].map(([label, observations]) => summarizeGroup(label, observations));
}

/** Pure aggregation: neither model training nor stock recommendations. */
export function buildPriceReferenceTrend(rawRows: PriceReferenceTrendRow[], truncated = false) {
  const rows: Observation[] = rawRows.flatMap((row) => {
    const baseline = numeric(row.baseline_price);
    const reference = numeric(row.reference_price);
    if (baseline == null || reference == null) return [];
    const delta = round(baseline - reference, 4);
    const pct = round(100 * delta / reference, 4);
    const key = getSectorKey(row.code);
    return [{
      date: row.trade_date, code: row.code, name: row.name,
      baseline, reference, differenceYen: delta, differencePercent: pct,
      absPercent: Math.abs(pct), matched: Math.abs(delta) <= 0.01, saveHourJst: hour(row.baseline_saved_hour_jst),
      sector: key === "OTHER" ? "その他・未分類" : sectorLabelMap[key],
      observationDate: row.observation_date_jst,
    }];
  });
  const tradeDates = new Set(rows.map((x) => x.date));
  const hours = new Set(rows.filter((x) => x.saveHourJst !== null).map((x) => x.saveHourJst));
  const sorted = [...rows].sort((a, b) =>
    b.absPercent - a.absPercent || b.date.localeCompare(a.date) || a.code.localeCompare(b.code),
  );
  return {
    lookbackDays: RESEARCH_DAYS,
    truncated,
    summary: {
      records: rows.length,
      tradeDays: tradeDates.size,
      distinctSecurities: new Set(rows.map((x) => x.code)).size,
      matched: rows.filter((x) => x.matched).length,
      differing: rows.filter((x) => !x.matched).length,
      overHalfPercent: rows.filter((x) => x.absPercent >= 0.5).length,
      meanAbsPercent: rows.length ? round(rows.reduce((a, x) => a + x.absPercent, 0) / rows.length) : null,
      enoughDatesForTrend: tradeDates.size >= 5,
      enoughSaveHoursForComparison: tradeDates.size >= 5 && hours.size >= 2,
    },
    byTradeDate: group(rows, (x) => x.date).sort((a, b) => b.label.localeCompare(a.label)).slice(0, 30),
    bySector: group(rows, (x) => x.sector).sort((a, b) => b.records - a.records || a.label.localeCompare(b.label)),
    byPriceRange: group(rows, (x) => priceRangeLabel(x.baseline)).sort((a, b) =>
      ["1,000円未満", "1,000〜2,999円", "3,000〜9,999円", "10,000円以上"].indexOf(a.label) -
      ["1,000円未満", "1,000〜2,999円", "3,000〜9,999円", "10,000円以上"].indexOf(b.label)),
    bySaveHour: group(rows, (x) => x.saveHourJst === null ? "時刻未記録" :
      String(x.saveHourJst).padStart(2, "0") + "時台（JST）").sort((a, b) => a.label.localeCompare(b.label)),
    examples: sorted.slice(0, 12).map((x) => ({
      date: x.date, code: x.code, name: x.name,
      baseline: x.baseline, reference: x.reference,
      differenceYen: x.differenceYen, differencePercent: x.differencePercent,
      sector: x.sector, observationDate: x.observationDate,
    })),
  };
}

/** Read-only query, latest observation per date+code, bounded to 90 days. */
export async function getPriceReferenceTrend(now = new Date()) {
  const today = jstToday(now);
  const result = await pool.query<PriceReferenceTrendRow>(
    `WITH latest AS (
       SELECT DISTINCT ON (trade_date, code)
         trade_date::text AS trade_date, code, name,
         baseline_price, reference_price, observation_date_jst::text,
         reference_source,
         EXTRACT(HOUR FROM ((baseline_saved_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo'))
           AS baseline_saved_hour_jst
       FROM public.daily_learning_price_reference_audits
       WHERE trade_date >= $1::date - INTERVAL '89 days'
         AND trade_date < $1::date
       ORDER BY trade_date DESC, code, observation_date_jst DESC, observed_at DESC, id DESC
     )
     SELECT * FROM latest ORDER BY trade_date DESC, code ASC LIMIT $2`,
    [today, MAX_RESEARCH_ROWS + 1],
  );
  return buildPriceReferenceTrend(result.rows.slice(0, MAX_RESEARCH_ROWS), result.rows.length > MAX_RESEARCH_ROWS);
}
