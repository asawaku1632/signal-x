import {auditProspectiveScoreLedger} from "./prospectiveScoreLedger.mjs";
import {auditProspectiveGapStability} from "./prospectiveGapStability.mjs";
import {auditProspectiveCalendarStrata} from "./prospectiveCalendarStrata.mjs";
/** Offline descriptive report; never authorizes deployment or trading. */
export function summarizeProspectiveResearch(rows, options={}){
 const minDays=options.minDays??20, minMonths=options.minMonths??3;
 if(!Number.isInteger(minMonths)||minMonths<2)throw Error("INVALID_MONTH_REQUIREMENT");
 const ledger=auditProspectiveScoreLedger(rows);
 const stability=auditProspectiveGapStability(ledger,{minDays});
 const calendar=auditProspectiveCalendarStrata(ledger.daily);
 const blockers=[];
 if(stability.dates<minDays)blockers.push("INSUFFICIENT_DATES");
 if(ledger.excluded.duplicate>0)blockers.push("DUPLICATE_STOCK_DAY_RECORDS");
 if(ledger.excluded.invalid>0)blockers.push("INVALID_INPUT_RECORDS");
 if(ledger.excluded.featureNotAsOf>0)blockers.push("FEATURE_AS_OF_EVIDENCE_MISSING");
 if(ledger.excluded.outcomeUnconfirmed>0)blockers.push("OUTCOME_PROVENANCE_MISSING");
 if(ledger.excluded.incompletePair>0)blockers.push("INCOMPLETE_PRICE_PAIR");
 if(stability.months<minMonths)blockers.push("INSUFFICIENT_MONTHS");
 if(calendar.descriptiveMonthlyConsistency.supportedMonths<minMonths)blockers.push("INSUFFICIENT_WELL_SAMPLED_MONTHS");
 if(calendar.coverageAudit.lowCoverageMonths.length)blockers.push("LOW_MONTHLY_COHORT_COVERAGE");
 if(calendar.descriptiveMonthlyConsistency.concentratedInOneMonth)blockers.push("CONCENTRATED_IN_ONE_MONTH");
 if(calendar.descriptiveMonthlyConsistency.supportedMonths>=minMonths&&!calendar.descriptiveMonthlyConsistency.allSupportedMonthsConsistent)blockers.push("CROSS_MONTH_CONSISTENCY_NOT_SHOWN");
 if(!ledger.independentlyAuthenticatedByFunction)blockers.push("EXTERNAL_AUTHENTICATION_MISSING");
 if(stability.leaveOneOutMeanRange?.[0]<=0)blockers.push("UNSTABLE_LEAVE_ONE_OUT");
 if(stability.dates>=minDays&&stability.meanGapPp<=0)blockers.push("NO_POSITIVE_AVERAGE_GAP");
 if(stability.dates>=minDays&&stability.medianGapPp<=0)blockers.push("NO_POSITIVE_MEDIAN_GAP");
 if(stability.dates>=minDays&&stability.positiveGapDates<=stability.dates/2)blockers.push("NO_MAJORITY_POSITIVE_DATES");
 const candidateReview={status:"DO_NOT_PROMOTE",reason:"PROSPECTIVE_EVIDENCE_NOT_INDEPENDENTLY_VERIFIED",
  comparableDates:stability.dates,wellSampledMonths:calendar.descriptiveMonthlyConsistency.supportedMonths,
  missingQualityChecks:blockers,eligibleForModelUpdate:false,eligibleForLiveSignal:false};
 const evidence={observedTradingDates:stability.dates,observedMonths:stability.months,descriptiveMeanGapPp:stability.meanGapPp,descriptiveMedianGapPp:stability.medianGapPp,independentSourceAttestation:false,chronologicalHoldoutVerified:false};
 return {ledger,stability,calendar,evidence,candidateReview,blockers,reviewOnly:true,trainingEnabled:false,tradingEnabled:false,notificationsEnabled:false};
}
