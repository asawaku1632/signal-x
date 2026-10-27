/**
 * Read-only readiness inspection for exported SIGNALX research observations.
 * This deliberately does not convert historical Yahoo-derived prices into
 * verified official prices or fabricate experimental model outcomes.
 */
export function inspectForwardResearchExport(rows,{source="UNKNOWN"}={}) {
  const issues=new Map(),eligible=[],blocked=[];
  const add=(reason)=>issues.set(reason,(issues.get(reason)??0)+1);
  if(!Array.isArray(rows)) return {status:"BLOCKED",reasonCounts:{INVALID_EXPORT:1},
    eligibleRows:[],blockedCount:0,productionWrites:false,autoApply:false};
  const keys=new Set();
  for(const row of rows){
    const reasons=[];
    if(!row||typeof row!=="object"||typeof row.code!=="string"||
       !/^\d{4}-\d{2}-\d{2}$/.test(row.date??"")||
       ![5,10,20].includes(row.horizon)) reasons.push("INVALID_OBSERVATION_KEY");
    const key=`${row?.code}|${row?.date}|${row?.horizon}`;
    if(keys.has(key)) reasons.push("DUPLICATE_OBSERVATION");
    keys.add(key);
    if(row?.priceBasisVerified!==true||row?.status!=="VERIFIED"||
       !Number.isFinite(row?.returnPct)) reasons.push("FORWARD_OUTCOME_NOT_VERIFIED");
    if(row?.licenseReview!=="VERIFIED") reasons.push("LICENSE_REVIEW_REQUIRED");
    if(typeof row?.provider!=="string"||!row.provider.trim()||
       typeof row?.sourceRecordId!=="string"||!row.sourceRecordId.trim())
      reasons.push("SOURCE_TRACEABILITY_MISSING");
    if(row?.modelVersion==null||typeof row.modelVersion!=="string"||!row.modelVersion.trim())
      reasons.push("MODEL_VERSION_MISSING");
    if(reasons.length){blocked.push({key,reasons});for(const reason of reasons)add(reason);}
    else eligible.push({code:row.code,date:row.date,horizon:row.horizon,
      modelVersion:row.modelVersion,sourceRecordId:row.sourceRecordId});
  }
  return {status:rows.length>0&&blocked.length===0?"METADATA_READY_FOR_INDEPENDENT_REVIEW":"NOT_READY",
    source,receivedCount:rows.length,eligibleCount:eligible.length,
    blockedCount:blocked.length,reasonCounts:Object.fromEntries(issues),
    eligibleRows:eligible,blockedRows:blocked,
    autoApply:false,productionWrites:false,productionApproval:false,
    note:"Metadata flags are caller assertions. Readiness does not prove official prices, licensed use, predictive edge, or eligibility for a live experiment.",
  };
}
