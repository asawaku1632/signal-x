/**
 * Owner-only, as-of macro risk/short-swing planning study. This is NOT wired
 * into production rankings, notifications, brokerage orders or AI POWER.
 * Thresholds are predeclared review rules, NOT an empirically validated edge.
 */
export const MACRO_RISK_GATE_VERSION = "macro_risk_entry_gate_shadow_v1";
export const MACRO_RISK_RESEARCH_ONLY = Object.freeze({
  eligibleForTrading: false,
  eligibleForNotifications: false,
  eligibleForAiPower: false,
});

const INDEX_KEYS = new Set(["NIKKEI", "TOPIX", "NASDAQ", "SP500", "SOX"]);
const validDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && !Number.isNaN(Date.parse(v + "T00:00:00Z"))
  && new Date(v + "T00:00:00Z").toISOString().slice(0,10) === v;
const validTimestamp = (value) => typeof value === "string"
  && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
const number = (v) => typeof v === "number" && Number.isFinite(v);
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Reject future, stale, fabricated, duplicated, or temporally contradictory quotes.
 * Captured reference index returns are NOT independent verification of their source.
 */
export function checkMarketObservation(raw, asOf) {
  const reasons = [];
  if (!raw || !INDEX_KEYS.has(raw.key)) reasons.push("UNKNOWN_INDEX");
  if (!number(raw?.returnPct) || raw.returnPct < -50 || raw.returnPct > 50) reasons.push("INVALID_CHANGE");
  if (!validDate(raw?.sessionDate)) reasons.push("INVALID_SESSION_DATE");
  if (!validTimestamp(raw?.capturedAt)) reasons.push("INVALID_CAPTURE_TIME");
  if (typeof raw?.sourceUrl !== "string" || !/^https:\/\/[^/\s]+\//.test(raw.sourceUrl)) reasons.push("SOURCE_URL_MISSING");
  if (!(["CLOSED", "INTRADAY"].includes(raw?.quoteStatus))) reasons.push("QUOTE_STATUS_MISSING");
  if (validTimestamp(raw?.capturedAt)) {
    const ageMs = Date.parse(asOf) - Date.parse(raw.capturedAt);
    if (ageMs < 0) reasons.push("FUTURE_CAPTURE");
    if (ageMs > 96 * 60 * 60 * 1000) reasons.push("STALE_CAPTURE");
    if (validDate(raw?.sessionDate) && raw.sessionDate > new Date(Date.parse(raw.capturedAt) + 9 * 3600_000).toISOString().slice(0,10)) {
      reasons.push("FUTURE_SESSION_DATE");
    }
  }
  return {valid: reasons.length === 0, reasons};
}

export function assessMacroRisk({asOf, observations = [], stock = null, tradePlan = null} = {}) {
  if (!validTimestamp(asOf)) throw new Error("INVALID_AS_OF_TIMESTAMP");
  if (!Array.isArray(observations)) throw new Error("INVALID_OBSERVATIONS");
  const byIndex = new Map();
  const exclusions = [];
  for (const [position, raw] of observations.entries()) {
    const check = checkMarketObservation(raw, asOf);
    if (!check.valid) {
      exclusions.push({position, key:raw?.key ?? null, reasons:check.reasons});
      continue;
    }
    if (byIndex.has(raw.key)) {
      // Duplicate means no reliable selection among versions, not first/last wins.
      byIndex.delete(raw.key);
      exclusions.push({position, key:raw.key, reasons:["DUPLICATE_INDEX"]});
      byIndex.set(raw.key, null);
      continue;
    }
    byIndex.set(raw.key, raw);
  }
  // Nulls are poisoned duplicate keys: never accept a third observation either.
  const get = (key) => byIndex.get(key) || null;
  const nikkei=get("NIKKEI"), topix=get("TOPIX");
  const nasdaq=get("NASDAQ"), sp=get("SP500"), sox=get("SOX");
  const marketReasons = [];
  if ((nikkei?.returnPct ?? 0) <= -3) marketReasons.push("NIKKEI_CRASH");
  if ((topix?.returnPct ?? 0) <= -3) marketReasons.push("TOPIX_CRASH");
  if (nikkei && topix && nikkei.sessionDate===topix.sessionDate && nikkei.quoteStatus===topix.quoteStatus &&
      nikkei.returnPct <= -1.5 && topix.returnPct <= -1.5) marketReasons.push("JP_BREADTH_SELL_OFF");
  if (nasdaq && nasdaq.returnPct <= -3) marketReasons.push("NASDAQ_SHOCK");
  if (sp && sp.returnPct <= -2.5) marketReasons.push("SP500_SHOCK");
  if (sox && sox.returnPct <= -5) marketReasons.push("SOX_SHOCK");
  const japanCovered = !!(nikkei && topix && nikkei.sessionDate===topix.sessionDate && nikkei.quoteStatus===topix.quoteStatus);
  const overseasCovered = !!(nasdaq || sp || sox);
  const marketState = marketReasons.length ? "PAUSE_NEW_BUYS_SHADOW"
    : !japanCovered || !overseasCovered ? "INSUFFICIENT_MARKET_EVIDENCE"
    : "NO_CRASH_RULE_TRIGGERED";

  let stockAssessment = {status:"UNKNOWN", excessVsTopixPct:null, reasons:["STOCK_OR_MATCHING_TOPIX_UNAVAILABLE"]};
  if (stock != null) {
    if (!number(stock.returnPct) || stock.returnPct < -50 || stock.returnPct > 50 ||
      !validDate(stock.sessionDate) || !validTimestamp(stock.capturedAt) ||
      Date.parse(stock.capturedAt) > Date.parse(asOf) ||
      Date.parse(asOf)-Date.parse(stock.capturedAt) > 96*3600_000 ||
      !/^\d{4}$/.test(stock.code ?? "") ||
      typeof stock.sourceUrl!=="string" || !/^https:\/\/[^/\s]+\//.test(stock.sourceUrl)) {
      stockAssessment = {status:"UNKNOWN", excessVsTopixPct:null, reasons:["INVALID_OR_STALE_STOCK_OBSERVATION"]};
    } else if (topix && topix.sessionDate===stock.sessionDate &&
       // Do not compare intraday stock quotes to previous-day index closes.
       topix.quoteStatus===stock.quoteStatus) {
      const excess=round(stock.returnPct-topix.returnPct);
      const status=excess<=-2 ? "STOCK_UNDERPERFORMING_MARKET"
        : topix.returnPct<=-2 && excess>=-1 ? "BROAD_SELL_OFF_ALIGNED"
        : "MIXED_OR_UNCLEAR";
      stockAssessment={status, excessVsTopixPct:excess,
        reasons:["RELATIVE_RETURN_ONLY_NOT_CAUSAL_PROOF"]};
    }
  }

  const planAssessment = assessShortSwingPlan(tradePlan);
  return {
    version: MACRO_RISK_GATE_VERSION,
    asOf,
    marketState,
    suggestedNewEntryAction: marketState==="PAUSE_NEW_BUYS_SHADOW" ? "PAUSE_AND_REVIEW"
      : marketState==="INSUFFICIENT_MARKET_EVIDENCE" ? "WAIT_FOR_DATA" : "CONTEXT_REVIEW_ONLY",
    marketReasons, japanCovered, overseasCovered,
    usedIndices:[...byIndex].filter(([,v])=>v).map(([key])=>key).sort(), exclusions,
    stockAssessment, planAssessment,
    ...MACRO_RISK_RESEARCH_ONLY,
    caution:"The shadow gate does not place orders, block production buys, or guarantee a stop fill. Relative market movement does not establish the cause of a stock move.",
  };
}

/** A plan is assessed before entry, not used to silently extend an open trade.
 * Holding sessions are trading sessions, never elapsed calendar days.
 */
export function assessShortSwingPlan(input, maximumBudgetLossYen=10_000) {
  if (input == null) return {status:"MISSING_PLAN", reason:"ENTRY_STOP_TARGET_HORIZON_REQUIRED"};
  const {entryPrice, stopPrice, targetPrice, shares, holdingSessions} = input;
  if (![entryPrice,stopPrice,targetPrice].every(n=>number(n)&&n>0) ||
      !(stopPrice < entryPrice && targetPrice > entryPrice) ||
      !Number.isInteger(shares) || shares<=0 || shares>100_000 ||
      !Number.isInteger(holdingSessions) || holdingSessions<3 || holdingSessions>5 ||
      !number(maximumBudgetLossYen) || maximumBudgetLossYen<=0) {
    return {status:"INVALID_PLAN",reason:"INVALID_PRICE_SIZE_OR_3_TO_5_SESSION_HORIZON"};
  }
  const riskYen=round((entryPrice-stopPrice)*shares);
  const targetProfitYen=round((targetPrice-entryPrice)*shares);
  if (riskYen<=0) return {status:"INVALID_PLAN",reason:"RISK_TOO_SMALL_TO_MEASURE"};
  const rewardRiskRatio=round(targetProfitYen/riskYen);
  const status=riskYen>maximumBudgetLossYen ? "REVIEW_LOSS_CAP"
    : rewardRiskRatio<1.5 ? "REVIEW_WEAK_REWARD_RISK" : "PLAN_STRUCTURALLY_OK";
  return {
    status,riskYen,targetProfitYen,rewardRiskRatio,holdingSessions,
    plannedReview:"REVIEW_BY_SESSION_LIMIT_AND_ON_ANY_STOP_BREACH",
    stopCaution:"A stop or stop-limit may fill below the trigger or not fill at all on gaps; the planned loss is not a hard cap.",
  };
}
