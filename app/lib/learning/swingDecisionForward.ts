import pool from "@/app/lib/postgres";
import { getLatestScanSnapshot } from "@/app/lib/scanSnapshot";
import { getJstDateString } from "@/app/lib/learning/learningSaveStatus";
import { getSwingDecision } from "@/app/lib/swingDecision";
import { isTseTradingDate, resolveTseTradingDatesAfter } from "@/app/lib/technicalObservation/tseMarketCalendar";
import { FORWARD_DAYS, summarizeDecisionForward } from "@/app/lib/learning/swingDecisionForwardMath";
import type { ForwardCohort, ForwardItem, ForwardStatus } from "@/app/lib/learning/swingDecisionForwardMath";

const MAX_SNAPSHOT_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_OPEN = 2000;
const MAX_PENDING = 120;
const asDate = (value: Date | string) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const finite = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const positive = (value: unknown): number | null => {
  const n = finite(value);
  return n !== null && n > 0 ? n : null;
};
type OpenTrade = {
  id: string | number; user_email: string; code: string; name: string;
  entry_price: string | number; started_at: Date | string;
  tracking_days: number | null;
};
type ScanStock = {
  code?: string; price?: unknown; currentPrice?: unknown;
  score?: unknown; aiPower?: unknown; rsi?: unknown; volumeRatio?: unknown;
  changePercent?: unknown; takeProfit?: unknown; stopLoss?: unknown;
};
type AuditRow = {
  id: number | string; code: string; name: string; signal_date: Date | string;
  snapshot_at: Date | string; signal_price: string; ai_power: string;
  decision_status: ForwardStatus; cohort: ForwardCohort;
  reasons: string[] | null;
  outcome_1d_date: Date | string | null; outcome_1d_price: string | null;
  outcome_3d_date: Date | string | null; outcome_3d_price: string | null;
  outcome_5d_date: Date | string | null; outcome_5d_price: string | null;
  outcome_10d_date: Date | string | null; outcome_10d_price: string | null;
};

export async function captureSwingDecisionForward(cohort: ForwardCohort, userEmail?: string) {
  const now = new Date();
  const signalDate = getJstDateString(now);
  if (!isTseTradingDate(signalDate)) return { captured: 0, checked: 0, skipped: "MARKET_CLOSED" };
  const snapshot = await getLatestScanSnapshot();
  const updatedAt = snapshot?.updatedAt;
  const timestamp = updatedAt ? new Date(updatedAt).getTime() : NaN;
  if (!updatedAt || !Number.isFinite(timestamp) || timestamp > now.getTime() ||
      now.getTime() - timestamp > MAX_SNAPSHOT_AGE_MS ||
      getJstDateString(new Date(timestamp)) !== signalDate) {
    return { captured: 0, checked: 0, skipped: "SCAN_SNAPSHOT_NOT_FRESH" };
  }
  const stocks = Array.isArray(snapshot?.payload?.stocks)
    ? snapshot.payload.stocks as ScanStock[] : [];
  const byCode = new Map(stocks.map(stock => [String(stock.code ?? ""), stock]));
  if (!byCode.size) return { captured: 0, checked: 0, skipped: "NO_STOCKS" };

  // No browser-supplied AI scores, prices, symbols, or judgement.
  const positions = await pool.query<OpenTrade>(
    "SELECT id, user_email, code, name, entry_price, started_at, tracking_days " +
    "FROM public.paper_trades WHERE status='OPEN' " +
    "AND ($1::text IS NULL OR user_email=$1) ORDER BY id DESC LIMIT $2",
    [userEmail?.trim().toLowerCase() ?? null, MAX_OPEN],
  );
  let captured = 0, holds = 0, exits = 0, eligible = 0;
  for (const trade of positions.rows) {
    const stock = byCode.get(String(trade.code));
    const price = positive(stock?.price ?? stock?.currentPrice);
    const entryPrice = positive(trade.entry_price);
    const aiPower = finite(stock?.score ?? stock?.aiPower);
    if (!stock || price === null || entryPrice === null || aiPower === null ||
        aiPower < 0 || aiPower > 100 ||
        new Date(trade.started_at).getTime() > timestamp) continue;
    const decision = getSwingDecision({
      currentPrice: price, entryPrice, aiPower,
      rsi: finite(stock.rsi), volumeRatio: finite(stock.volumeRatio),
      changePercent: finite(stock.changePercent), takeProfit: finite(stock.takeProfit),
      stopLoss: finite(stock.stopLoss), startedAt: new Date(trade.started_at).toISOString(),
      trackingDays: trade.tracking_days,
    });
    // TAKE_PROFIT_WATCH is not silently classified as either group.
    if (decision.status !== "HOLD" && decision.status !== "EXIT") continue;
    eligible++;
    const inserted = await pool.query(
      "INSERT INTO public.swing_decision_forward_observations " +
      "(paper_trade_id,user_email,code,name,signal_date,cohort,decision_status," +
      "snapshot_at,signal_price,entry_price,ai_power,reasons) " +
      "VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11,$12::jsonb) " +
      "ON CONFLICT (paper_trade_id,signal_date,cohort) DO NOTHING",
      [trade.id, trade.user_email, trade.code, trade.name, signalDate, cohort,
       decision.status, updatedAt, price, entryPrice, aiPower, JSON.stringify(decision.reasons)],
    );
    if ((inserted.rowCount ?? 0) === 1) {
      captured++;
      if (decision.status === "HOLD") holds++;
      else exits++;
    }
  }
  return { captured, holds, exits, checked: positions.rows.length, eligible, skipped: null,
    snapshotAt: updatedAt, cohort };
}

export async function updateSwingDecisionForwardOutcomes() {
  // User cancellations are not research outcomes.
  await pool.query(
    "DELETE FROM public.swing_decision_forward_observations AS audit " +
    "WHERE NOT EXISTS (SELECT 1 FROM public.paper_trades AS trade " +
    "WHERE trade.id=audit.paper_trade_id AND trade.user_email=audit.user_email)",
  );
  const pending = await pool.query<AuditRow>(
    "SELECT id, code, signal_date, outcome_1d_price, outcome_3d_price, " +
    "outcome_5d_price, outcome_10d_price " +
    "FROM public.swing_decision_forward_observations " +
    "WHERE outcome_1d_price IS NULL OR outcome_3d_price IS NULL " +
    "OR outcome_5d_price IS NULL OR outcome_10d_price IS NULL " +
    "ORDER BY signal_date ASC, id ASC LIMIT $1", [MAX_PENDING],
  );
  let updated = 0;
  const today = getJstDateString();
  for (const event of pending.rows) {
    let sessions: string[];
    try {
      sessions = resolveTseTradingDatesAfter(asDate(event.signal_date), 10, { maxLookaheadDays: 45 });
    } catch { continue; }
    // Strictly earlier sessions only: today's provisional observations never count as outcomes.
    const due = FORWARD_DAYS.filter(days => sessions[days - 1] < today &&
      event[("outcome_" + days + "d_price") as keyof AuditRow] == null);
    if (!due.length) continue;
    const prices = await pool.query<{ session_date: Date | string; price: string }>(
      "SELECT DISTINCT ON (date::date) date::date AS session_date, price " +
      "FROM public.daily_stock_results WHERE code=$1 " +
      "AND date::date = ANY($2::date[]) AND price>0 " +
      "ORDER BY date::date ASC, created_at DESC",
      [event.code, due.map(days => sessions[days - 1])],
    );
    const byDate = new Map(prices.rows.map(row => [asDate(row.session_date), positive(row.price)]));
    const values = FORWARD_DAYS.flatMap(days => {
      const target = sessions[days - 1];
      const price = due.includes(days) ? byDate.get(target) ?? null : null;
      return [price !== null ? target : null, price];
    });
    if (values.every((_, index) => index % 2 === 0 || values[index] == null)) continue;
    const result = await pool.query(
      "UPDATE public.swing_decision_forward_observations SET " +
      "outcome_1d_date=COALESCE(outcome_1d_date,$2::date), " +
      "outcome_1d_price=COALESCE(outcome_1d_price,$3::numeric), " +
      "outcome_3d_date=COALESCE(outcome_3d_date,$4::date), " +
      "outcome_3d_price=COALESCE(outcome_3d_price,$5::numeric), " +
      "outcome_5d_date=COALESCE(outcome_5d_date,$6::date), " +
      "outcome_5d_price=COALESCE(outcome_5d_price,$7::numeric), " +
      "outcome_10d_date=COALESCE(outcome_10d_date,$8::date), " +
      "outcome_10d_price=COALESCE(outcome_10d_price,$9::numeric), " +
      "updated_at=now() WHERE id=$1",
      [event.id, ...values],
    );
    updated += result.rowCount ?? 0;
  }
  return { checked: pending.rows.length, updated, sameDayExcluded: true };
}

export async function getSwingDecisionForwardReport(userEmail: string) {
  const result = await pool.query<AuditRow>(
    "SELECT id,code,name,signal_date,snapshot_at,signal_price,ai_power,decision_status,cohort,reasons," +
    "outcome_1d_date,outcome_1d_price,outcome_3d_date,outcome_3d_price," +
    "outcome_5d_date,outcome_5d_price,outcome_10d_date,outcome_10d_price " +
    "FROM public.swing_decision_forward_observations AS audit " +
    "WHERE user_email=$1 AND EXISTS (SELECT 1 FROM public.paper_trades AS trade " +
    "WHERE trade.id=audit.paper_trade_id AND trade.user_email=audit.user_email) " +
    "ORDER BY signal_date DESC,id DESC LIMIT 250",
    [userEmail.trim().toLowerCase()],
  );
  const items: ForwardItem[] = result.rows.map(row => {
    const reference = positive(row.signal_price)!;
    return {
      id: String(row.id), code: row.code, name: row.name,
      signalDate: asDate(row.signal_date),
      scanAt: new Date(row.snapshot_at).toISOString(),
      signalPrice: reference, aiPower: Number(row.ai_power),
      decisionStatus: row.decision_status, cohort: row.cohort,
      reasons: Array.isArray(row.reasons) ? row.reasons : [],
      outcomes: FORWARD_DAYS.map(days => {
        const savedDate = row[("outcome_" + days + "d_date") as keyof AuditRow] as Date | string | null;
        const savedPrice = positive(row[("outcome_" + days + "d_price") as keyof AuditRow]);
        return {
          days, date: savedDate ? asDate(savedDate) : null, price: savedPrice,
          changePercent: savedPrice === null ? null : (savedPrice / reference - 1) * 100,
        };
      }),
    };
  });
  return {
    count: items.length, items, groups: summarizeDecisionForward(items),
    note: "研究専用。保存された最初の当日判定を固定し、翌取引日以降の保存日足参考価格で比較します。" +
      "手動保存と定時保存は別集計。保有継続は上昇、撤退は下落を的中として便宜上集計します。" +
      "同じ銘柄・ポジションが日をまたいで含まれるため独立試行とは限りません。" +
      "保存価格は実際の約定価格や確定終値の保証ではなく、手数料・税金・株式分割は未調整。" +
      "本機能は売買判定、通知、実注文を変更しません。",
  };
}
