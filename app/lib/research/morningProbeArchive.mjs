/**
 * Offline evidence container. SHA-256 detects accidental modifications but is
 * NOT a server signature, official-market-data attestation or proof of fills.
 * Runs only on an owner-triggered manual probe; does not call an upstream API.
 */
import {createHash} from "node:crypto";
import {MORNING_PROBE_POLICY,MORNING_PROBE_SLOTS} from "./morningProbeShadow.mjs";
import {isJpxStockCode} from "./jpxStockCode.mjs";
export const MORNING_PROBE_ARCHIVE_VERSION="OWNER_MANUAL_ASOF_EVIDENCE_V1";
const observedStatuses=new Set([
  "AVAILABLE_AS_OF_RECEIPT","MISSING_COMPLETED_BARS",
  "INCONSISTENT_UPSTREAM_BARS","UNVERIFIED_EXCHANGE_TIMEZONE",
  "INVALID_UPSTREAM_RESPONSE","UPSTREAM_HTTP_ERROR",
  "UPSTREAM_TIMEOUT","UPSTREAM_RESPONSE_UNAVAILABLE",
  "OUTSIDE_SLOT_OR_ROLLOVER",
]);
const asMillis=x=>{
  if(typeof x!=="string"||!/(Z|[+-]\d{2}:\d{2})$/.test(x))return NaN;
  return Date.parse(x);
};
const dayValid=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+"T00:00:00Z"))&&
  new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const dateTime=(date,hhmm)=>Date.parse(date+"T"+hhmm+":00+09:00");
const laterReference=(slot)=>MORNING_PROBE_SLOTS.includes(slot)?
  (Number(slot.slice(3))+5>=60?"10:00":
    slot.slice(0,3)+String(Number(slot.slice(3))+5).padStart(2,"0")):null;
const hash=data=>createHash("sha256").update(JSON.stringify(data)).digest("hex");
const err=msg=>{throw Error("INVALID_MORNING_PROBE_ARCHIVE:"+msg);};

/** Assembles one owner-received session slot; all symbols must have the SAME
 * frozen night and source batch. No retrospective aggregation of candidate list.
 */
export function sealMorningProbeArchive(batch){
  if(batch?.policy!==MORNING_PROBE_POLICY||
     batch?.status!=="REFERENCE_RESEARCH_ONLY"||
     !dayValid(batch.date)||!MORNING_PROBE_SLOTS.includes(batch.slot))err("BATCH");
  if(!dayValid(batch.priorDate)||batch.priorDate>=batch.date)err("PRIOR_DATE");
  const started=asMillis(batch.serverStartedAt),ended=asMillis(batch.serverFinishedAt),
    frozen=asMillis(batch.cohortFrozenAt);
  if(!Number.isFinite(started)||!Number.isFinite(ended)||!Number.isFinite(frozen)||
    started>ended||frozen>=dateTime(batch.date,"09:00")||
    frozen<dateTime(batch.priorDate,"18:00"))err("TIMELINE");
  if(!Array.isArray(batch.probes)||batch.probes.length<1||batch.probes.length>5||
     !Array.isArray(batch.frozenCodes)||batch.frozenCodes.length!==batch.probes.length)
    err("COHORT");
  const seen=new Set();
  const codes=batch.frozenCodes.map(String);
  if(codes.some(c=>!isJpxStockCode(c)||seen.has(c)?true:(seen.add(c),false)))
    err("COHORT_CODES");
  const checked=new Set(),observations=[];
  for(const p of batch.probes){
    if(!isJpxStockCode(p?.code)||!seen.has(p.code)||checked.has(p.code)||
       p.tradeDate!==batch.date||p.probeSlot!==batch.slot||
       !observedStatuses.has(p.status))err("OBSERVATION");
    checked.add(p.code);
    const requested=asMillis(p.requestedAt),received=asMillis(p.receivedAt);
    if(!Number.isFinite(requested)||!Number.isFinite(received)||
       received<requested||requested<started||received>ended)err("RECEIPT_TIME");
    const slotStart=dateTime(batch.date,batch.slot);
    const slotEnd=slotStart+5*60_000;
    if(requested<slotStart||received>=slotEnd)err("SLOT_ROLLOVER");
    if(p.status==="AVAILABLE_AS_OF_RECEIPT"){
      if(p.earliestFutureReferenceSlot!==laterReference(batch.slot)||
         !Array.isArray(p.observedBars)||p.observedBars.length<3||
         p.observedBars.some(b=>!b.barClosedByReceipt||
           !Number.isFinite(asMillis(b.barStartAt))||
           asMillis(b.barStartAt)+5*60_000>received))err("LEAKED_BAR");
    }
    observations.push(p);
  }
  if(checked.size!==codes.length)err("MISSING_CODE");
  const evidence={
    archiveVersion:MORNING_PROBE_ARCHIVE_VERSION,
    policy:MORNING_PROBE_POLICY,
    tradeDate:batch.date,priorDate:batch.priorDate,
    probeSlot:batch.slot,serverStartedAt:batch.serverStartedAt,
    serverFinishedAt:batch.serverFinishedAt,cohortFrozenAt:batch.cohortFrozenAt,
    frozenCodes:codes,probes:observations,
    source:"YAHOO_V8_CHART_5M",
    fillEvidence:false,priceForecastEvidence:false,
    note:"The checksum is not a signature. Receipt-time research only.",
  };
  return {evidence,checksum:{algorithm:"SHA-256",digest:hash(evidence)}};
}

export function verifyMorningProbeArchive(container){
  if(!container||container.evidence?.archiveVersion!==MORNING_PROBE_ARCHIVE_VERSION||
     container.checksum?.algorithm!=="SHA-256"||
     !/^[0-9a-f]{64}$/.test(String(container.checksum?.digest??"")))return false;
  try {
    const e=container.evidence;
    const rebuilt=sealMorningProbeArchive({
      policy:e.policy,status:"REFERENCE_RESEARCH_ONLY",
      date:e.tradeDate,priorDate:e.priorDate,slot:e.probeSlot,
      serverStartedAt:e.serverStartedAt,serverFinishedAt:e.serverFinishedAt,
      cohortFrozenAt:e.cohortFrozenAt,frozenCodes:e.frozenCodes,probes:e.probes,
    });
    return JSON.stringify(rebuilt.evidence)===JSON.stringify(e)&&
      rebuilt.checksum.digest===container.checksum.digest;
  }catch{return false;}
}

/** Offline reports: each date+slot+symbol is one independent observation.
 * Repeated manual calls for the same symbol/slot are AMBIGUOUS, even if a
 * later call looks healthier. Neither is silently preferred.
 */
export function summarizeMorningProbeArchives(containers){
  const byKey=new Map();
  let invalidFiles=0,duplicates=0;
  for(const file of Array.isArray(containers)?containers:[]){
    if(!verifyMorningProbeArchive(file)){invalidFiles++;continue;}
    const e=file.evidence;
    for(const p of e.probes){
      const key=e.tradeDate+":"+e.probeSlot+":"+p.code;
      if(byKey.has(key)){byKey.set(key,null);duplicates++;continue;}
      byKey.set(key,{date:e.tradeDate,slot:e.probeSlot,status:p.status,
        receivedAt:p.receivedAt,code:p.code});
    }
  }
  const bySlot=MORNING_PROBE_SLOTS.map(slot=>{
    const rows=[...byKey.values()].filter(x=>x?.slot===slot);
    const available=rows.filter(x=>x.status==="AVAILABLE_AS_OF_RECEIPT").length;
    return {slot,observed:rows.length,available,
      missing:rows.filter(x=>x.status==="MISSING_COMPLETED_BARS").length,
      errors:rows.length-available-
        rows.filter(x=>x.status==="MISSING_COMPLETED_BARS").length,
      dates:new Set(rows.map(x=>x.date)).size,
      availabilityPercent:rows.length?Number((100*available/rows.length).toFixed(2)):null};
  });
  return {policy:MORNING_PROBE_ARCHIVE_VERSION,validEntries:[...byKey.values()].filter(Boolean).length,
    invalidFiles,ambiguousDuplicates:duplicates,bySlot,
    performanceClaimsAllowed:false,
    note:"Availability rates measure observed provider responses, NOT stock win rates."};
}
