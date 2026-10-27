import { inspectForwardResearchExport } from "./dailyForwardResearchExportReadiness.mjs";

/**
 * Offline, read-only adapter for joined BB snapshot/event/outcome exports.
 * The Yahoo-based source is deliberately NEVER marked independently verified.
 * This does not fetch a database, promote prices, or modify production.
 */
export function inspectBbForwardResearchRows(rows) {
  if(!Array.isArray(rows)) return {status:"BLOCKED",candidateCount:0,
    reasonCounts:{INVALID_INPUT:1},candidates:[],autoApply:false,productionWrites:false};
  const reasons=new Map(),candidates=[],seen=new Set();
  const reject=(reason)=>reasons.set(reason,(reasons.get(reason)??0)+1);
  for(const row of rows) {
    if(row?.horizon!==5||row?.horizon_unit!=="TRADING_DAY") {
      reject("OUTSIDE_FIVE_DAY_HORIZON");continue;
    }
    if(typeof row?.code!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(row?.observation_date??"")||
       typeof row?.event_id!=="string"||!row.event_id) {
      reject("INVALID_SOURCE_IDENTITY");continue;
    }
    const key=`${row.event_id}|5`;
    if(seen.has(key)){reject("DUPLICATE_EVENT_HORIZON");continue;}
    seen.add(key);
    if(row.result_quality!=="COMPLETE"||row.has_return!==true) {
      reject("OUTCOME_INCOMPLETE");continue;
    }
    if(row.provider!=="JQUANTS_V2"||row.independentPriceEvidenceVerified!==true||
       row.licenseReview!=="VERIFIED") {
      reject("PRICE_OR_LICENSE_NOT_INDEPENDENTLY_VERIFIED");continue;
    }
    candidates.push({code:row.code,date:row.observation_date,horizon:5,
      sourceRecordId:key,provider:row.provider});
  }
  // BB events are not AI model predictions, and cannot be passed off as
  // experiment baseline/experimental outcomes.
  const diagnostic=inspectForwardResearchExport(candidates.map(c=>({
    ...c,status:"NOT_VERIFIED",priceBasisVerified:false,returnPct:null,
    licenseReview:"NOT_VERIFIED",modelVersion:"",
  })),{source:"BB_SHADOW_OFFLINE_EXPORT"});
  return {status:"RESEARCH_ONLY_NOT_ELIGIBLE_FOR_AI_EXPERIMENT",
    candidateCount:candidates.length,candidates,reasonCounts:Object.fromEntries(reasons),
    diagnostic,autoApply:false,productionWrites:false,productionApproval:false,
    note:"BB observations are not matched AI model predictions; independent evidence and frozen model comparisons are required.",
  };
}
