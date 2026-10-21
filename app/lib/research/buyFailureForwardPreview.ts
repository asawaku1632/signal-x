import pool from "@/app/lib/postgres";
import { resolveTseTradingDatesAfter, isTseTargetDateReady, isTseTradingDate } from "@/app/lib/technicalObservation/tseMarketCalendar";
import { getBuyActivationPreview } from "@/app/lib/research/buyFailureReadOnly";
import { evaluateBuySignalForward } from "@/app/lib/research/buySignalForwardCore.mjs";


type PriceRow = { session_date: Date | string; price: string | number };
const dateOnly = (value: Date | string) => value instanceof Date
  ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

/**
 * Strictly read-only preview. daily_stock_results.price is NOT established as
 * corporate-action-adjusted or independently verified. Therefore its values
 * must never be counted as verified returns or recovered outcomes.
 */
export async function previewBuySignalForward(limit = 20) {
  const { total, rows, excluded } = await getBuyActivationPreview(limit);
  const items = [];
  const now = new Date();
  for (const event of rows) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(event.triggeredAt));
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
    const signalDate = [part("year"), part("month"), part("day")].join("-");
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
        status: outcome.status === "PENDING_OR_MISSING" && outcome.targetDate &&
          !isTseTargetDateReady(outcome.targetDate, now) ? "NOT_YET_DUE" :
          outcome.status === "PENDING_OR_MISSING" ? "MISSING" : outcome.status,
      })),
      worstCloseDrawdownPct: evaluation.worstCloseDrawdownPct,
      firstCloseRecoverySession: evaluation.firstCloseRecoverySession,
    });
  }
  return { total, excluded, items,
    caveat: "Prices are unverified/unadjusted. No historical win rate, recovery rate or trade recommendation can be calculated yet." };
}
