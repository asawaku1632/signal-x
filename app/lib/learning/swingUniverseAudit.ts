import pool from "@/app/lib/postgres";
import { getFallbackTotalStockList } from "@/app/lib/learning/scanEngine";
import { validateDailyScanCoverage } from "@/app/lib/learning/dailyScanGuard";
import { getSwingEntryDecision, type SwingEntryDecisionStatus } from "@/app/lib/swingDecision";
import {
  isTseTradingDate,
  isTseTargetDateReady,
  resolveTseTradingDatesAfter,
} from "@/app/lib/technicalObservation/tseMarketCalendar";

// Historical daily_stock_results stores AI POWER + price, but NOT all technical
// indicators. Explicitly evaluate with AI POWER alone; do not misrepresent
// this as the complete live stock-detail decision.
export const UNIVERSE_SWING_RULE_VERSION = "ai_power_only_v1";
export const UNIVERSE_SWING_HORIZONS = [1, 3, 5, 10] as const;
const MIN_STOCK_COVERAGE_RATIO = 0.8;
const MAX_OBSERVATIONS_PER_DAY = 1300;
const INSERT_BATCH_SIZE = 200;
const MAX_BACKLOG_DATES = 55;

type DailyStockRow = {
  code: string;
  name: string;
  score: string | number | null;
  price: string | number | null;
};
type PendingDateRow = { trade_date: string | Date };
type OutcomePair = { signalDate: string; priceDate: string };
type GroupRow = {
  decision_status: SwingEntryDecisionStatus;
  decision_label: string;
  records: string;
  days: string;
  completed_1d: string;
  completed_3d: string;
  completed_5d: string;
  completed_10d: string;
  up_1d: string;
  up_3d: string;
  up_5d: string;
  up_10d: string;
  avg_1d: string | null;
  avg_3d: string | null;
  avg_5d: string | null;
  avg_10d: string | null;
};
type ExampleRow = {
  code: string;
  name: string;
  trade_date: Date | string;
  decision_status: SwingEntryDecisionStatus;
  decision_label: string;
  entry_price: string;
  ai_power: string;
  return_1d: string | null;
  return_3d: string | null;
  return_5d: string | null;
  return_10d: string | null;
};

const dateOnly = (v: string | Date) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
function validPrice(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
function validPower(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}
function checkDate(date: string) {
  if (!/^20\d\d-\d\d-\d\d$/.test(date) || !isTseTradingDate(date)) {
    throw new Error("Invalid market date");
  }
}

export async function captureSwingUniverseDay(targetDate: string, now = new Date()) {
  checkDate(targetDate);
  if (!isTseTargetDateReady(targetDate, now)) {
    return { date: targetDate, saved: 0, eligible: 0, skipped: "BEFORE_MARKET_CLOSE" };
  }

  const rows = await pool.query<DailyStockRow>(
    `SELECT code, name, score, price FROM public.daily_stock_results
     WHERE date = $1 ORDER BY code ASC LIMIT $2`,
    [targetDate, MAX_OBSERVATIONS_PER_DAY + 1],
  );
  const expected = getFallbackTotalStockList();
  const coverage = validateDailyScanCoverage(rows.rows.length, expected);
  if (!coverage.valid || rows.rows.length > MAX_OBSERVATIONS_PER_DAY) {
    return { date: targetDate, saved: 0, eligible: 0, skipped: "DAILY_COVERAGE_INSUFFICIENT",
      expected, actual: rows.rows.length, minimum: Math.ceil(expected * MIN_STOCK_COVERAGE_RATIO) };
  }
  const prepared = rows.rows.flatMap((row) => {
    const price = validPrice(row.price);
    const aiPower = validPower(row.score);
    if (!/^[0-9]{4}$/.test(row.code) || !row.name || price == null || aiPower == null) return [];
    const decision = getSwingEntryDecision({ aiPower });
    return [{ code: row.code, name: row.name, price, aiPower, decision }];
  });

  // Never register a selectively tiny subset of a large daily scan as an
  // apparent "whole market" signal; report insufficient coverage instead.
  if (prepared.length < coverage.minimumCount) {
    return { date: targetDate, saved: 0, eligible: prepared.length, skipped: "INVALID_PRICES_OR_SCORES" };
  }

  let saved = 0;
  for (let offset = 0; offset < prepared.length; offset += INSERT_BATCH_SIZE) {
    const batch = prepared.slice(offset, offset + INSERT_BATCH_SIZE);
    const values: unknown[] = [];
    const placeholders = batch.map((row, index) => {
      const base = index * 7;
      values.push(targetDate, row.code, row.name, row.price, row.aiPower,
        row.decision.status, row.decision.label);
      return `(${Array.from({ length: 7 }, (_, column) => `$${base + column + 1}`).join(",")}, '${UNIVERSE_SWING_RULE_VERSION}')`;
    });
    const inserted = await pool.query(
      `INSERT INTO public.swing_universe_observations
       (trade_date, code, name, entry_price, ai_power,
        decision_status, decision_label, rule_version)
       VALUES ${placeholders.join(",")}
       ON CONFLICT (trade_date, code) DO NOTHING`,
      values,
    );
    saved += inserted.rowCount ?? 0;
  }
  return { date: targetDate, saved, eligible: prepared.length, skipped: null,
    ruleVersion: UNIVERSE_SWING_RULE_VERSION };
}

export function buildSwingOutcomeTargets(
  signalDates: string[],
  currentDate: string,
): Record<(typeof UNIVERSE_SWING_HORIZONS)[number], OutcomePair[]> {
  const result = {
    1: [] as OutcomePair[], 3: [] as OutcomePair[],
    5: [] as OutcomePair[], 10: [] as OutcomePair[],
  };
  for (const signalDate of signalDates) {
    let sessions: string[];
    try {
      sessions = resolveTseTradingDatesAfter(signalDate, 10, { maxLookaheadDays: 45 });
    } catch {
      // A calendar outside its supported coverage is NOT estimated.
      continue;
    }
    for (const horizon of UNIVERSE_SWING_HORIZONS) {
      if (sessions[horizon - 1] <= currentDate) {
        result[horizon].push({ signalDate, priceDate: sessions[horizon - 1] });
      }
    }
  }
  return result;
}

export async function updateSwingUniverseOutcomes(targetDate: string) {
  checkDate(targetDate);
  const pending = await pool.query<PendingDateRow>(
    `SELECT DISTINCT trade_date FROM public.swing_universe_observations
     WHERE trade_date < $1::date AND trade_date >= ($1::date - INTERVAL '65 days')
       AND outcome_10d_date IS NULL
     ORDER BY trade_date ASC LIMIT $2`,
    [targetDate, MAX_BACKLOG_DATES],
  );
  const pairs = buildSwingOutcomeTargets(
    pending.rows.map((row) => dateOnly(row.trade_date)), targetDate,
  );
  const updated: Record<number, number> = { 1: 0, 3: 0, 5: 0, 10: 0 };
  for (const days of UNIVERSE_SWING_HORIZONS) {
    const targets = pairs[days];
    if (!targets.length) continue;
    // One set-based update per horizon rather than a remote query per stock.
    // Missing price/date remains NULL; the exact exchange trading day must match.
    const values: unknown[] = [];
    const placeholders = targets.map((pair, index) => {
      values.push(pair.signalDate, pair.priceDate);
      return `($${index * 2 + 1}::date, $${index * 2 + 2}::text)`;
    });
    const result = await pool.query(
      `WITH targets(signal_date, price_date) AS (VALUES ${placeholders.join(",")})
       UPDATE public.swing_universe_observations AS obs
       SET outcome_${days}d_date = targets.price_date::date,
           return_${days}d = ROUND(
             (100.0 * (future.price - obs.entry_price) / obs.entry_price)::numeric, 4),
           updated_at = NOW()
       FROM targets, public.daily_stock_results AS future
       WHERE obs.trade_date = targets.signal_date
         AND obs.code = future.code
         AND future.date = targets.price_date
         AND future.price > 0
         AND obs.outcome_${days}d_date IS NULL`,
      values,
    );
    updated[days] = result.rowCount ?? 0;
  }
  return { pendingDates: pending.rows.length, updated };
}

const asNumber = (value: string | number | null) =>
  value == null ? null : Number(value);

export async function getSwingUniverseReport(code?: string) {
  const [meta, groups, examples] = await Promise.all([
    pool.query<{ total: string; latest_date: Date | string | null; distinct_dates: string }>(
      `SELECT COUNT(*) AS total, MAX(trade_date) AS latest_date,
         COUNT(DISTINCT trade_date) AS distinct_dates
       FROM public.swing_universe_observations
       WHERE rule_version = $1`,
      [UNIVERSE_SWING_RULE_VERSION],
    ),
    pool.query<GroupRow>(
      `SELECT decision_status, MAX(decision_label) AS decision_label,
         COUNT(*)::text AS records, COUNT(DISTINCT trade_date)::text AS days,
         COUNT(return_1d)::text AS completed_1d,
         COUNT(return_3d)::text AS completed_3d,
         COUNT(return_5d)::text AS completed_5d,
         COUNT(return_10d)::text AS completed_10d,
         COUNT(*) FILTER (WHERE return_1d > 0)::text AS up_1d,
         COUNT(*) FILTER (WHERE return_3d > 0)::text AS up_3d,
         COUNT(*) FILTER (WHERE return_5d > 0)::text AS up_5d,
         COUNT(*) FILTER (WHERE return_10d > 0)::text AS up_10d,
         ROUND(AVG(return_1d), 2)::text AS avg_1d,
         ROUND(AVG(return_3d), 2)::text AS avg_3d,
         ROUND(AVG(return_5d), 2)::text AS avg_5d,
         ROUND(AVG(return_10d), 2)::text AS avg_10d
       FROM public.swing_universe_observations WHERE rule_version = $1
       GROUP BY decision_status
       ORDER BY CASE decision_status WHEN 'CANDIDATE' THEN 1
         WHEN 'WAIT' THEN 2 WHEN 'WATCH' THEN 3 ELSE 4 END`,
      [UNIVERSE_SWING_RULE_VERSION],
    ),
    pool.query<ExampleRow>(
      `SELECT code, name, trade_date, decision_status, decision_label,
         entry_price, ai_power, return_1d, return_3d, return_5d, return_10d
       FROM public.swing_universe_observations
       WHERE rule_version = $1
         AND ($2::text IS NULL OR code = $2)
       ORDER BY trade_date DESC, code ASC
       LIMIT 40`,
      [UNIVERSE_SWING_RULE_VERSION, code ?? null],
    ),
  ]);
  const records = groups.rows.map((g) => ({
    status: g.decision_status, label: g.decision_label,
    count: Number(g.records), distinctDates: Number(g.days),
    outcomes: UNIVERSE_SWING_HORIZONS.map((days) => ({
      days, checked: Number(g[`completed_${days}d` as keyof GroupRow]),
      up: Number(g[`up_${days}d` as keyof GroupRow]),
      averageReturnPercent: asNumber(g[`avg_${days}d` as keyof GroupRow]),
    })),
  }));
  return {
    total: Number(meta.rows[0]?.total ?? 0),
    latestDate: meta.rows[0]?.latest_date ? dateOnly(meta.rows[0].latest_date) : null,
    distinctDates: Number(meta.rows[0]?.distinct_dates ?? 0),
    groups: records,
    latest: examples.rows.map((r) => ({
      code: r.code, name: r.name, date: dateOnly(r.trade_date),
      status: r.decision_status, label: r.decision_label,
      price: Number(r.entry_price), power: Number(r.ai_power),
      outcomes: UNIVERSE_SWING_HORIZONS.map((days) => ({
        days, returnPercent: asNumber(r[`return_${days}d` as keyof ExampleRow]),
      })),
    })),
    ruleVersion: UNIVERSE_SWING_RULE_VERSION,
    note: "購入なしでも全銘柄を検証。日次保存のAI POWERだけを使う簡易スイング判定で、RSI等を使う個別銘柄画面の判定と異なる場合があります。見送りは『下落予想』ではありません。ルールの自動変更はしません。",
  };
}
