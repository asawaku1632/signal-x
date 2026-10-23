/** Frozen hypothesis evaluator. Pure function: no fetch, writes, orders, or notifications. */
export const FROZEN_AFTERNOON_REBOUND_VERSION = "FROZEN_AFTERNOON_REBOUND_20261023_V1";
const positive = x => typeof x === "number" && Number.isFinite(x) && x > 0;
const parseTime = x => typeof x === "string" && /(?:Z|[+-]\\d{2}:\\d{2})$/.test(x) ? Date.parse(x) : NaN;
/**
 * A record is an independently approved source's three observations.
 * observedAt: market quote timestamp; availableAt: timestamp the quote and score were available to research.
 * Caller must verify the rights to use the provider's data; this evaluator never grants rights.
 */
export function evaluateFrozenAfternoonRebound(record = {}) {
  const {tradeDate,code,source,commercialRightsApproved,permission,early,decision,outcome} = record;
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(tradeDate ?? "") || !/^\\d{4}$/.test(code ?? ""))
    return {status:"EXCLUDED",reason:"INVALID_ID"};
  if (!source || permission !== "APPROVED" || commercialRightsApproved !== true)
    return {status:"EXCLUDED",reason:"SOURCE_RIGHTS_NOT_VERIFIED"};
  const points=[early,decision,outcome];
  if (points.some(p => !p || !positive(p.price) || !Number.isFinite(parseTime(p.observedAt)) || !Number.isFinite(parseTime(p.availableAt))))
    return {status:"EXCLUDED",reason:"INVALID_OBSERVATION"};
  const times=points.map(p=>({observed:parseTime(p.observedAt),available:parseTime(p.availableAt)}));
  if (times.some(t=>t.observed>t.available) || !(times[0].available < times[1].available && times[1].available < times[2].available))
    return {status:"EXCLUDED",reason:"TIME_ORDER_OR_AVAILABILITY_INVALID"};
  const day = ms => new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
  if (times.some(t=>day(t.observed)!==tradeDate || day(t.available)!==tradeDate))
    return {status:"EXCLUDED",reason:"WRONG_TRADING_DAY"};
  if (typeof decision.score!=="number" || !Number.isFinite(decision.score) || decision.score<0 || decision.score>100)
    return {status:"EXCLUDED",reason:"INVALID_DECISION_SCORE"};
  if (decision.price >= early.price) return {status:"EXCLUDED",reason:"NO_EARLY_DECLINE"};
  const group=decision.score>=60 && decision.score<80 ? "HYPOTHESIS_60_79" : decision.score<60 ? "CONTROL_UNDER_60" : "OUTSIDE_FROZEN_GROUPS";
  if(group==="OUTSIDE_FROZEN_GROUPS") return {status:"EXCLUDED",reason:"OUTSIDE_FROZEN_GROUPS"};
  return {status:"RESEARCH_ONLY",version:FROZEN_AFTERNOON_REBOUND_VERSION,tradeDate,code,group,
    rebound:outcome.price>decision.price,changePct:(outcome.price/decision.price-1)*100,
    limitFillStatus:"NOT_EVALUATED",productionEnabled:false};
}
