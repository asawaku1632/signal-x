/** Read-only, fail-closed adapter for approved intraday observations.
 * The caller must supply observations from an independently reviewed source.
 * This module does not fetch, persist, schedule, trade or notify.
 */
import {validateIntradayObservation} from "./intradayObservationContract.mjs";
import {evaluateAfternoonLimitStudy} from "./afternoonLimitStudy.mjs";
export function evaluateApprovedAfternoonObservationPair({decision,outcome,targetLimit} = {}) {
  const a=validateIntradayObservation(decision);
  if(a.status!=="VALID") return {status:"UNAVAILABLE",reason:"DECISION_"+a.reason};
  const b=validateIntradayObservation(outcome);
  if(b.status!=="VALID") return {status:"UNAVAILABLE",reason:"OUTCOME_"+b.reason};
  if(decision.code!==outcome.code || decision.tradingDate!==outcome.tradingDate)
    return {status:"UNAVAILABLE",reason:"DIFFERENT_SECURITY_OR_DAY"};
  if(decision.source!==outcome.source)
    return {status:"UNAVAILABLE",reason:"MIXED_PROVIDER"};
  if(Date.parse(outcome.observedAt)<=Date.parse(decision.observedAt))
    return {status:"UNAVAILABLE",reason:"OUTCOME_NOT_AFTER_DECISION"};
  // A single later quote is not a post-decision high/low range.
  // Never substitute it for the missing extrema or infer a limit touch.
  return {status:"OBSERVED_PAIR_ONLY",policyVersion:"AFTERNOON_PAIR_V1",
    code:decision.code,tradingDate:decision.tradingDate,
    decisionPrice:decision.quotePrice,outcomePrice:outcome.quotePrice,
    priceChangePct:(outcome.quotePrice/decision.quotePrice-1)*100,
    limitStudyStatus:"UNAVAILABLE",limitStudyReason:"POST_DECISION_HIGH_LOW_NOT_OBSERVED",
    targetLimit:typeof targetLimit==="number"&&Number.isFinite(targetLimit)?targetLimit:null,
    executionStatus:"NOT_EVALUATED"};
}
