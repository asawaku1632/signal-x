import pool from "@/app/lib/postgres";
import { getLatestScanSnapshot } from "@/app/lib/scanSnapshot";
import { getJstDateString, isJstBusinessDay } from "@/app/lib/learning/learningSaveStatus";
import { getSwingDecision } from "@/app/lib/swingDecision";

// Once an EXIT is verified, preserve the then-current price and reasons.
// Subsequent checks use saved market-day prices, not live prices or user-submitted values.
const MAX_SNAPSHOT_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_OPEN_TRADES_PER_RUN = 2000;
const MAX_OUTCOMES_PER_RUN = 200;
const HORIZONS = [1, 3, 5, 10] as const;

type OpenTradeRow = {
  id: number | string;
  user_email: string;
  code: string;
  name: string;
  entry_price: number | string;
  started_at: Date | string;
  tracking_days: number | null;
  ai_score: number | string | null;
};
type ScanStock = {
  code?: string;
  price?: unknown;
  currentPrice?: unknown;
  score?: unknown;
  aiPower?: unknown;
  rsi?: unknown;
  volumeRatio?: unknown;
  changePercent?: unknown;
  takeProfit?: unknown;
  stopLoss?: unknown;
};
type OutcomeRow = {
  id: string | number;
  code: string;
  signal_date: Date | string;
  outcome_1d_price: string | null;
  outcome_3d_price: string | null;
  outcome_5d_price: string | null;
  outcome_10d_price: string | null;
};
const dateOnly = (value: Date | string) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const optionalNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const positiveNumber = (value: unknown): number | null => {
  const number = optionalNumber(value);
  return number !== null && number > 0 ? number : null;
};

export async function captureSwingExitSignals(userEmail?: string) {
  const now = new Date();
  if (!isJstBusinessDay(now)) return { captured: 0, checked: 0, skipped: "MARKET_CLOSED" };

  const snapshot = await getLatestScanSnapshot();
  const timestamp = snapshot?.updatedAt ? new Date(snapshot.updatedAt).getTime() : NaN;
  if (!Number.isFinite(timestamp) || timestamp > now.getTime() ||
      now.getTime() - timestamp > MAX_SNAPSHOT_AGE_MS ||
      getJstDateString(new Date(timestamp)) !== getJstDateString(now)) {
    return { captured: 0, checked: 0, skipped: "SCAN_SNAPSHOT_NOT_FRESH" };
  }

  const stocks = Array.isArray(snapshot?.payload?.stocks)
    ? snapshot.payload.stocks as ScanStock[] : [];
  const byCode = new Map(stocks.map((stock) => [String(stock.code ?? ""), stock]));
  if (byCode.size === 0) return { captured: 0, checked: 0, skipped: "NO_STOCKS" };

  const rows = await pool.query<OpenTradeRow>(
    `SELECT id, user_email, code, name, entry_price, started_at, tracking_days, ai_score
     FROM public.paper_trades
     WHERE status = 'OPEN' AND ($1::text IS NULL OR user_email = $1)
     ORDER BY id DESC LIMIT $2`,
    [userEmail?.trim().toLowerCase() ?? null, MAX_OPEN_TRADES_PER_RUN],
  );

  let captured = 0;
  for (const trade of rows.rows) {
    const stock = byCode.get(String(trade.code));
    const price = positiveNumber(stock?.price ?? stock?.currentPrice);
    const entryPrice = positiveNumber(trade.entry_price);
    const power = optionalNumber(stock?.score ?? stock?.aiPower);
    // No fresh complete scan data => no inference from an old purchase-time score.
    if (!stock || !price || !entryPrice || power == null ||
        power <= 0 || power > 100 || new Date(trade.started_at).getTime() > timestamp) continue;

    const decision = getSwingDecision({
      currentPrice: price,
      entryPrice,
      aiPower: power,
      rsi: optionalNumber(stock.rsi),
      volumeRatio: optionalNumber(stock.volumeRatio),
      changePercent: optionalNumber(stock.changePercent),
      takeProfit: optionalNumber(stock.takeProfit),
      stopLoss: optionalNumber(stock.stopLoss),
      startedAt: new Date(trade.started_at).toISOString(),
      trackingDays: trade.tracking_days,
    });
    if (decision.status !== "EXIT") continue;

    const inserted = await pool.query(
      `INSERT INTO public.swing_exit_audits
       (paper_trade_id, user_email, code, name, signal_date, snapshot_at,
        signal_price, entry_price, ai_power, reasons)
       VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10::jsonb)
       ON CONFLICT (paper_trade_id) DO NOTHING`,
      [trade.id, trade.user_email, trade.code, trade.name, getJstDateString(now),
       snapshot.updatedAt, price, entryPrice, power, JSON.stringify(decision.reasons)],
    );
    captured += inserted.rowCount ?? 0;
  }
  return { captured, checked: rows.rows.length, skipped: null };
}

export async function updateSwingExitOutcomes() {
  const observations = await pool.query<OutcomeRow>(
    `SELECT id, code, signal_date, outcome_1d_price, outcome_3d_price,
       outcome_5d_price, outcome_10d_price
     FROM public.swing_exit_audits
     WHERE outcome_10d_price IS NULL
     ORDER BY signal_date DESC, id DESC LIMIT $1`,
    [MAX_OUTCOMES_PER_RUN],
  );
  let updated = 0;
  for (const event of observations.rows) {
    const signalDate = dateOnly(event.signal_date);
    // Count distinct saved market dates globally: missing one stock's price
    // must NOT silently turn the second session into the "next day".
    const dates = await pool.query<{ session_date: Date | string }>(
      `SELECT DISTINCT date::date AS session_date
       FROM public.daily_stock_results
       WHERE date::date > $1::date
       ORDER BY session_date ASC LIMIT 10`,
      [signalDate],
    );
    const sessions = dates.rows.map((r) => dateOnly(r.session_date));
    const due = HORIZONS.filter((days) => sessions.length >= days);
    if (!due.length) continue;
    const prices = await pool.query<{ session_date: Date | string; price: string }>(
      `SELECT DISTINCT ON (date::date)
         date::date AS session_date, price
       FROM public.daily_stock_results
       WHERE code = $1 AND date::date = ANY($2::date[]) AND price > 0
       ORDER BY date::date ASC, created_at DESC`,
      [event.code, due.map((days) => sessions[days - 1])],
    );
    const byDate = new Map(prices.rows.map((row) => [dateOnly(row.session_date), positiveNumber(row.price)]));
    const newValues = HORIZONS.flatMap((days) => {
      const date = sessions[days - 1];
      const price = date ? byDate.get(date) : null;
      return [date && price ? date : null, price ?? null];
    });
    if (HORIZONS.every((days, i) => event[`outcome_${days}d_price` as keyof OutcomeRow] != null || newValues[i * 2 + 1] == null)) continue;
    const result = await pool.query(
      `UPDATE public.swing_exit_audits
       SET outcome_1d_date = COALESCE(outcome_1d_date, $2::date),
           outcome_1d_price = COALESCE(outcome_1d_price, $3::numeric),
           outcome_3d_date = COALESCE(outcome_3d_date, $4::date),
           outcome_3d_price = COALESCE(outcome_3d_price, $5::numeric),
           outcome_5d_date = COALESCE(outcome_5d_date, $6::date),
           outcome_5d_price = COALESCE(outcome_5d_price, $7::numeric),
           outcome_10d_date = COALESCE(outcome_10d_date, $8::date),
           outcome_10d_price = COALESCE(outcome_10d_price, $9::numeric),
           updated_at = now()
       WHERE id = $1`,
      [event.id, ...newValues],
    );
    updated += result.rowCount ?? 0;
  }
  return { checked: observations.rows.length, updated };
}

type AuditRow = {
  id: string;
  code: string;
  name: string;
  signal_date: Date | string;
  signal_price: string;
  reasons: string[] | null;
  outcome_1d_date: Date | string | null;
  outcome_1d_price: string | null;
  outcome_3d_date: Date | string | null;
  outcome_3d_price: string | null;
  outcome_5d_date: Date | string | null;
  outcome_5d_price: string | null;
  outcome_10d_date: Date | string | null;
  outcome_10d_price: string | null;
};

export async function getSwingExitAuditReport(userEmail: string) {
  const result = await pool.query<AuditRow>(
    `SELECT id, code, name, signal_date, signal_price, reasons,
            outcome_1d_date, outcome_1d_price, outcome_3d_date, outcome_3d_price,
            outcome_5d_date, outcome_5d_price, outcome_10d_date, outcome_10d_price
     FROM public.swing_exit_audits WHERE user_email = $1
     ORDER BY signal_date DESC, id DESC LIMIT 100`,
    [userEmail.trim().toLowerCase()],
  );
  const items = result.rows.map((row) => {
    const reference = Number(row.signal_price);
    const outcomes = HORIZONS.map((days) => {
      const date = row[`outcome_${days}d_date` as keyof AuditRow] as Date | string | null;
      const rawPrice = row[`outcome_${days}d_price` as keyof AuditRow];
      const price = positiveNumber(rawPrice);
      return { days, date: date ? dateOnly(date) : null, price,
        changePercent: price ? ((price / reference) - 1) * 100 : null };
    });
    return { id: String(row.id), code: row.code, name: row.name,
      signalDate: dateOnly(row.signal_date), signalPrice: reference,
      reasons: Array.isArray(row.reasons) ? row.reasons : [], outcomes };
  });
  const summary = HORIZONS.map((days, index) => {
    const completed = items.map((item) => item.outcomes[index])
      .filter((outcome) => outcome.changePercent !== null);
    const declined = completed.filter((outcome) => outcome.changePercent! < 0).length;
    return { days, evaluated: completed.length, declined,
      declineRatePercent: completed.length ? declined / completed.length * 100 : null };
  });
  return { items, summary, count: items.length, horizons: [...HORIZONS],
    note: "同一疑似ポジションの最初の撤退候補を記録し、翌取引日以降の保存株価と比較します。投資成果やAIの有効性を保証するものではありません。" };
}
