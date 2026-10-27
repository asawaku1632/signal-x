import { compareBbOutcomeWithJquantsBars } from "./dailyForwardBbJquantsComparison.mjs";

/** Offline batch comparison. No API access, database access, or production writes. */
export function summarizeBbJquantsComparisons(observations, barsByCode) {
 const result={status:"RESEARCH_ONLY",total:0,matched:0,differed:0,blocked:0,
  reasons:{},details:[],autoApply:false,productionWrites:false,productionApproval:false};
 if(!Array.isArray(observations)||!barsByCode||typeof barsByCode!=="object"||
    Array.isArray(barsByCode)) return {...result,status:"BLOCKED",reasons:{INVALID_INPUT:1}};
 for(const row of observations) {
  const code=typeof row?.code==="string"?row.code:"";
  const bars=Object.hasOwn(barsByCode,code)?barsByCode[code]:[];
  const outcome=compareBbOutcomeWithJquantsBars(row,bars);
  result.total++;
  if(outcome.status==="REFERENCE_CLOSE_MATCHES") result.matched++;
  else if(outcome.status==="REFERENCE_CLOSE_DIFFERS") result.differed++;
  else {result.blocked++;result.reasons[outcome.reason]=(result.reasons[outcome.reason]??0)+1;}
  result.details.push({code,observationDate:row?.observation_date??null,
   status:outcome.status,reason:outcome.reason??null,
   absoluteCloseDifference:outcome.absoluteCloseDifference??null});
 }
 return result;
}
