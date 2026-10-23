/** Research-only afternoon rebound classifier. No orders, notifications or forecasts. */
export const AFTERNOON_REBOUND_POLICY = "AFTERNOON_REBOUND_SHADOW_V1";
export function classifyAfternoonRebound(input) {
  const { morningHigh, morningLow, afternoonHigh, afternoonLow, afternoonLast, previousClose } = input ?? {};
  const values = [morningHigh,morningLow,afternoonHigh,afternoonLow,afternoonLast,previousClose];
  if (values.some(x => typeof x !== "number" || !Number.isFinite(x) || x <= 0)) {
    return {status:"UNAVAILABLE",reason:"MISSING_OR_INVALID_OHLC"};
  }
  if (morningLow > morningHigh || afternoonLow > afternoonHigh ||
      afternoonLast < afternoonLow || afternoonLast > afternoonHigh) {
    return {status:"UNAVAILABLE",reason:"INCONSISTENT_OHLC"};
  }
  const drawdownPct = (morningLow / morningHigh - 1) * 100;
  const reboundPct = (afternoonHigh / morningLow - 1) * 100;
  const newHigh = afternoonHigh > morningHigh;
  return {
    status:"OBSERVED", policyVersion:AFTERNOON_REBOUND_POLICY,
    morningDrawdownPct:drawdownPct, afternoonReboundPct:reboundPct,
    afternoonNewHigh:newHigh,
    afternoonLastVsPreviousClosePct:(afternoonLast/previousClose-1)*100,
    // Descriptive only. Never label a future rebound from data not yet observed.
    label:newHigh?"AFTERNOON_NEW_HIGH":"NO_AFTERNOON_NEW_HIGH"
  };
}
