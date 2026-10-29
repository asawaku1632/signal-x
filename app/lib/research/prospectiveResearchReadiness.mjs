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
 if(stability.months<minMonths)blockers.push("INSUFFICIENT_MONTHS");
 if(!ledger.independentlyAuthenticatedByFunction)blockers.push("EXTERNAL_AUTHENTICATION_MISSING");
 if(stability.leaveOneOutMeanRange?.[0]<=0)blockers.push("UNSTABLE_LEAVE_ONE_OUT");
 return {ledger,stability,blockers,reviewOnly:true,trainingEnabled:false,tradingEnabled:false,notificationsEnabled:false};
}
