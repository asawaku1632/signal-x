import pool from "@/app/lib/postgres";
import {
  collectYahooDailyReferences, compareDailyLearningPrice,
  isValidJapanStockCode, isValidPriceAuditDate,
} from "@/app/lib/learning/dailyPriceAudit";
import { isTseTradingDate } from "@/app/lib/technicalObservation/tseMarketCalendar";

export const REFERENCE_SOURCE = "YAHOO_CHART_1D" as const;
export const MAX_MANUAL_REFERENCE_CODES = 5;
const MAX_REFERENCE_AGE_YEARS = 2;

type SavedRow = {
  id: string; date: string; code: string; name: string;
  price: number | string; created_at: Date | string | null;
};
type AuditRow = {
  code: string; name: string; trade_date: Date | string;
  baseline_price: number | string; baseline_saved_at: Date | string | null;
  reference_price: number | string; reference_source: string;
  reference_bar_at: Date | string; observation_date_jst: Date | string;
  observed_at: Date | string; difference_yen: number | string;
  comparison_status: "MATCH" | "MISMATCH";
};
const iso = (value: Date | string | null) =>
  value == null ? null : value instanceof Date ? value.toISOString() : String(value);
const dateOnly = (value: Date | string) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
export const jstToday = (now = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);

export function parseReferenceBatch(input: unknown, today: string) {
  if (!input || typeof input !== "object") throw new Error("INVALID_REQUEST");
  const { date, codes } = input as Record<string, unknown>;
  if (typeof date !== "string" || !isValidPriceAuditDate(date)) throw new Error("INVALID_DATE");
  if (date >= today) throw new Error("REFERENCE_DATE_NOT_FINAL");
  if (!isTseTradingDate(date)) throw new Error("TSE_MARKET_CLOSED");
  const earliest = new Date(today + "T00:00:00Z");
  earliest.setUTCFullYear(earliest.getUTCFullYear() - MAX_REFERENCE_AGE_YEARS);
  if (date < earliest.toISOString().slice(0, 10)) throw new Error("DATE_OUTSIDE_REFERENCE_WINDOW");
  if (!Array.isArray(codes) || codes.length < 1 || codes.length > MAX_MANUAL_REFERENCE_CODES
    || codes.some((code) => typeof code !== "string" || !isValidJapanStockCode(code))) {
    throw new Error("INVALID_CODES");
  }
  // Duplicates cannot force extra upstream requests; enforce fixed batch limit first.
  return { date, codes: [...new Set(codes as string[])] };
}
export function auditRowForClient(row: AuditRow) {
  return {
    code: row.code, name: row.name, date: dateOnly(row.trade_date),
    baselinePrice: Number(row.baseline_price), baselineSavedAt: iso(row.baseline_saved_at),
    referencePrice: Number(row.reference_price), referenceSource: row.reference_source,
    referenceBarAt: iso(row.reference_bar_at), observationDateJst: dateOnly(row.observation_date_jst),
    observedAt: iso(row.observed_at), differenceYen: Number(row.difference_yen),
    status: row.comparison_status,
  };
}

export async function getPriceReferenceObservations(date: string, codes: string[]) {
  const result = await pool.query<AuditRow>(
    `SELECT code, name, trade_date, baseline_price, baseline_saved_at,
            reference_price, reference_source, reference_bar_at,
            observation_date_jst, observed_at, difference_yen, comparison_status
       FROM public.daily_learning_price_reference_audits
      WHERE trade_date = $1::date AND code = ANY($2::text[])
      ORDER BY observed_at DESC, code LIMIT 50`,
    [date, codes],
  );
  return result.rows.map(auditRowForClient);
}

async function fetchYahooReference(code: string, date: string) {
  const upstream = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${code}.T?range=2y&interval=1d`,
    { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8_000) },
  );
  if (!upstream.ok) throw new Error("REFERENCE_PROVIDER_UNAVAILABLE");
  const json = await upstream.json();
  const bars = collectYahooDailyReferences(json?.chart?.result?.[0])
    .filter((bar) => bar.date === date);
  if (bars.length !== 1) throw new Error("REFERENCE_BAR_UNAVAILABLE");
  return bars[0];
}

async function persistReference(row: SavedRow, observedDay: string) {
  // A retry during the same JST day is free of Yahoo requests and cannot overwrite evidence.
  const prior = await pool.query<AuditRow>(
    `SELECT code, name, trade_date, baseline_price, baseline_saved_at,
            reference_price, reference_source, reference_bar_at,
            observation_date_jst, observed_at, difference_yen, comparison_status
       FROM public.daily_learning_price_reference_audits
      WHERE trade_date = $1::date AND code = $2 AND reference_source = $3
        AND observation_date_jst = $4::date LIMIT 1`,
    [row.date, row.code, REFERENCE_SOURCE, observedDay],
  );
  if (prior.rows[0]) return { ...auditRowForClient(prior.rows[0]), alreadySaved: true };
  const bar = await fetchYahooReference(row.code, row.date);
  const saved = Number(row.price);
  const comparison = compareDailyLearningPrice(saved, bar);
  const observed = await pool.query<AuditRow>(
    `INSERT INTO public.daily_learning_price_reference_audits
       (daily_result_id, trade_date, code, name,
        baseline_price, baseline_saved_at, reference_price, reference_source,
        reference_bar_at, observation_date_jst, difference_yen, comparison_status)
     VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12)
     ON CONFLICT (trade_date, code, reference_source, observation_date_jst) DO NOTHING
     RETURNING code, name, trade_date, baseline_price, baseline_saved_at,
       reference_price, reference_source, reference_bar_at,
       observation_date_jst, observed_at, difference_yen, comparison_status`,
    [row.id, row.date, row.code, row.name, saved, row.created_at, bar.close,
      REFERENCE_SOURCE, new Date(bar.barTime * 1000).toISOString(), observedDay,
      comparison.differenceYen, comparison.status],
  );
  if (observed.rows[0]) return { ...auditRowForClient(observed.rows[0]), alreadySaved: false };
  // A second request on the same day must return the previously stored immutable observation.
  const existing = await pool.query<AuditRow>(
    `SELECT code, name, trade_date, baseline_price, baseline_saved_at,
            reference_price, reference_source, reference_bar_at,
            observation_date_jst, observed_at, difference_yen, comparison_status
       FROM public.daily_learning_price_reference_audits
      WHERE trade_date = $1::date AND code = $2 AND reference_source = $3
        AND observation_date_jst = $4::date LIMIT 1`,
    [row.date, row.code, REFERENCE_SOURCE, observedDay],
  );
  if (!existing.rows[0]) throw new Error("REFERENCE_WRITE_CONFLICT");
  return { ...auditRowForClient(existing.rows[0]), alreadySaved: true };
}

export async function captureManualPriceReferences(date: string, codes: string[], observedDay: string) {
  const rows = await pool.query<SavedRow>(
    `SELECT id, date, code, name, price, created_at
       FROM public.daily_stock_results
      WHERE date = $1 AND code = ANY($2::text[]) ORDER BY code`,
    [date, codes],
  );
  const found = new Map(rows.rows.map((row) => [row.code, row]));
  const results: Array<
    | { code: string; success: true; observation: Awaited<ReturnType<typeof persistReference>> }
    | { code: string; success: false; reason: string }
  > = [];
  // At most five requests, strictly sequential: avoid sudden Yahoo API spikes.
  for (const code of codes) {
    const row = found.get(code);
    if (!row) { results.push({ code, success: false, reason: "NO_SAVED_LEARNING_ROW" }); continue; }
    try {
      const observation = await persistReference(row, observedDay);
      results.push({ code, success: true, observation });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "REFERENCE_UNAVAILABLE";
      console.warn("[price-reference] capture failed", { code, reason });
      results.push({ code, success: false, reason: "REFERENCE_UNAVAILABLE" });
    }
  }
  return { requested: codes.length, saved: results.filter((item) => item.success && !item.observation.alreadySaved).length,
    results };
}
