import {auditProspectiveScoreLedger} from "./prospectiveScoreLedger.mjs";
import {auditProspectiveGapStability} from "./prospectiveGapStability.mjs";
/** Offline descriptive report; never authorizes deployment or trading. */
export function summarizeProspectiveResearch(rows, options={}){
 const minDays=options.minDays??20, minMonths=options.minMonths??3;
 if(!Number.isInteger(minMonths)||minMonths<2)throw Error("INVALID_MONTH_REQUIREMENT");
 const ledger=auditProspectiveScoreLedger(rows);
 const stability=auditProspectiveGapStability(ledger,{minDays});
 const blockers=[];
 if(stability.dates<minDays)blockers.push("INSUFFICIENT_DATES");
 if(ledger.excluded.duplicate>0)blockers.push("DUPLICATE_STOCK_DAY_RECORDS");
 if(ledger.excluded.invalid>0)blockers.push("INVALID_INPUT_RECORDS");
 if(ledger.excluded.featureNotAsOf>0)blockers.push("FEATURE_AS_OF_EVIDENCE_MISSING");
 if(ledger.excluded.outcomeUnconfirmed>0)blockers.push("OUTCOME_PROVENANCE_MISSING");
 if(ledger.excluded.incompletePair>0)blockers.push("INCOMPLETE_PRICE_PAIR");
 if(stability.months<minMonths)blockers.push("INSUFFICIENT_MONTHS");
 if(!ledger.independentlyAuthenticatedByFunction)blockers.push("EXTERNAL_AUTHENTICATION_MISSING");
 if(stability.leaveOneOutMeanRange?.[0]<=0)blockers.push("UNSTABLE_LEAVE_ONE_OUT");
 return {ledger,stability,blockers,reviewOnly:true,trainingEnabled:false,tradingEnabled:false,notificationsEnabled:false};
}
