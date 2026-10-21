// Pure research calculations. No database access, notifications, or trades.
export const RESEARCH_HORIZONS = Object.freeze([1, 3, 5, 10, 20]);

const validPrice = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const percent = (price, base) => ((price / base) - 1) * 100;

/**
 * @param {{signalPrice:number,signalDate:string,observations:Array<{
 * tradeDate:string,close:number|null,low?:number|null,high?:number|null,
 * verified?:boolean,corporateActionAdjusted?:boolean}>,
 * tradingDates:string[]}} input
 * tradingDates must be authoritative consecutive TSE sessions AFTER signalDate.
 * Never generate calendar dates from weekdays. No missing-session interpolation.
 */
export function evaluateBuySignalForward(input) {
  if (!validPrice(input?.signalPrice) || !/^\d{4}-\d{2}-\d{2}$/.test(input?.signalDate ?? "")) {
    throw new Error("INVALID_SIGNAL_REFERENCE");
  }
  const dates = input.tradingDates;
  if (!Array.isArray(dates) || dates.some((date, i) =>
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date <= input.signalDate || (i > 0 && date <= dates[i - 1]))) {
    throw new Error("INVALID_TRADING_CALENDAR");
  }
  const observations = new Map();
  for (const row of input.observations ?? []) {
    if (!row || !dates.includes(row.tradeDate) || observations.has(row.tradeDate)) {
      throw new Error("DUPLICATE_OR_UNEXPECTED_OBSERVATION");
    }
    observations.set(row.tradeDate, row);
  }
  const isUsable = (row) => row?.verified === true &&
    row.corporateActionAdjusted === true && validPrice(row.close);
  const outcomes = RESEARCH_HORIZONS.map((horizon) => {
    const targetDate = dates[horizon - 1] ?? null;
    const observation = targetDate ? observations.get(targetDate) : null;
    return {
      horizon, targetDate,
      status: !targetDate ? "CALENDAR_UNAVAILABLE" :
        !observation ? "PENDING_OR_MISSING" :
        !isUsable(observation) ? "UNVERIFIED" : "VERIFIED",
      returnPct: isUsable(observation) ? percent(observation.close, input.signalPrice) : null,
      recoveredToSignal: isUsable(observation) ? observation.close >= input.signalPrice : null,
    };
  });
  // Use only consecutive, verified observations for path-dependent metrics.
  let worstCloseDrawdownPct = null;
  let firstCloseRecoverySession = null;
  for (let i = 0; i < dates.length; i++) {
    const row = observations.get(dates[i]);
    if (!isUsable(row)) break;
    const change = percent(row.close, input.signalPrice);
    worstCloseDrawdownPct = worstCloseDrawdownPct === null ? Math.min(0, change) :
      Math.min(worstCloseDrawdownPct, change);
    if (firstCloseRecoverySession === null && row.close >= input.signalPrice) {
      firstCloseRecoverySession = i + 1;
    }
  }
  return { outcomes, worstCloseDrawdownPct, firstCloseRecoverySession,
    caveat: "Verified adjusted closes only; intraday drawdown and executable fills are not inferred." };
}
