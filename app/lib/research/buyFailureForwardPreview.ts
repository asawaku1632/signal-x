import pool from "@/app/lib/postgres";
import { resolveTseTradingDatesAfter, isTseTargetDateReady, isTseTradingDate } from "@/app/lib/technicalObservation/tseMarketCalendar";
import { getBuyActivationPreview } from "@/app/lib/research/buyFailureReadOnly";
import { evaluateBuySignalForward } from "@/app/lib/research/buySignalForwardCore.mjs";
import { classifyResearchCheckpoint, tokyoDateOnly } from "@/app/lib/research/buyFailureCheckpointPolicy.mjs";


type PriceRow = { session_date: Date | string; price: string | number };
const dateOnly = (value: Date | string) => value instanceof Date
  ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

/**
 * Strictly read-only preview. daily_stock_results.price is NOT established as
 * corporate-action-adjusted, independently verified, or confirmed to be closing prices. Therefore its values
 * must never be counted as verified returns or recovered outcomes.
 */
export async function previewBuySignalForward(limit = 20) {
  const { total, rows, excluded, sampled, exclusionReasons } = await getBuyActivationPreview(limit);
  const items = [];
  const now = new Date();
  for (const event of rows) {
    const signalDate = tokyoDateOnly(event.triggeredAt);
    let tradingDates: string[];
    let calendarAnchor = signalDate;
    try {
      // For non-trading-day activations, anchor to the preceding TSE session
      // so the first future checkpoint is the next actual trading session.
      if (!isTseTradingDate(calendarAnchor)) {
        let found = false;
        for (let offset = 1; offset <= 14; offset++) {
          const prior = new Date(Date.parse(signalDate + "T00:00:00Z") - offset * 86400000)
            .toISOString().slice(0, 10);
          if (isTseTradingDate(prior)) { calendarAnchor = prior; found = true; break; }
        }
        if (!found) throw new Error("CALENDAR_ANCHOR_UNAVAILABLE");
      }
      tradingDates = resolveTseTradingDatesAfter(calendarAnchor, 20, { maxLookaheadDays: 50 });
    } catch {
      items.push({ ...event, signalDate, status: "CALENDAR_UNAVAILABLE", outcomes: [] });
      continue;
    }
    const result = await pool.query<PriceRow>(
      `SELECT DISTINCT ON (date::date) date::date AS session_date, price
       FROM public.daily_stock_results
       WHERE code = $1 AND date::date = ANY($2::date[]) AND price > 0
       ORDER BY date::date ASC, created_at DESC`,
      [event.code, tradingDates],
    );
    const observations = result.rows.filter((row) => {
      const date = dateOnly(row.session_date);
      return isTseTargetDateReady(date, now);
    }).map((row) => ({
      tradeDate: dateOnly(row.session_date), close: Number(row.price),
      verified: false, corporateActionAdjusted: false,
    }));
    const evaluation = evaluateBuySignalForward({
      signalPrice: event.referencePrice, signalDate: calendarAnchor, tradingDates, observations,
    });
    items.push({
      ...event, signalDate, calendarAnchor, status: "HISTORICAL_UNVERIFIED",
      availablePriceSessions: observations.length,
      notYetDueSessions: tradingDates.filter((date) => !isTseTargetDateReady(date, now)).length,
      outcomes: evaluation.outcomes.map((outcome) => ({
        ...outcome,
        status: classifyResearchCheckpoint(outcome.status, outcome.targetDate,
          outcome.targetDate ? isTseTargetDateReady(outcome.targetDate, now) : false),
      })),
      worstCloseDrawdownPct: evaluation.worstCloseDrawdownPct,
      firstCloseRecoverySession: evaluation.firstCloseRecoverySession,
    });
  }
  return { total, excluded, sampled, exclusionReasons, items,
    caveat: "daily_stock_results.price is a scan-derived reference, not an established official closing price; recent 2026-10-16 through 2026-10-21 daily-save provenance logs show mostly 15:15 JST or earlier intraday candle timestamps, with different times across 953 stocks per day. Prices remain unverified/unadjusted; daily_stock_results timestamps lack timezone information. No historical win rate, recovery rate or trade recommendation can be calculated yet." };
}
