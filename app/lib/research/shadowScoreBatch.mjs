import {createHash} from "node:crypto";
/** Offline two-model snapshot envelope. SHA256 detects accidental changes, NOT independently attested capture time. */
export function sealShadowScoreBatch({tradeDate,capturedAt,sourceId,sourceVersion,baselineVersion,candidateVersion,rows}){
 const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
 if(!date(tradeDate)||typeof capturedAt!=="string"||!Number.isFinite(Date.parse(capturedAt))||
  Date.parse(capturedAt)>=Date.parse(tradeDate+"T09:05:00+09:00")||
  [sourceId,sourceVersion,baselineVersion,candidateVersion].some(x=>typeof x!=="string"||!x.trim())||
  !Array.isArray(rows)||rows.length===0||rows.length>5000)throw Error("INVALID_SHADOW_BATCH");
 const seen=new Set(),sorted=rows.map(r=>{
  if(!r||typeof r.code!=="string"||!/^(?:\d{4}|\d{3}[A-Z])$/.test(r.code)||
    !Number.isFinite(r.baselineScore)||!Number.isFinite(r.candidateScore)||seen.has(r.code))throw Error("INVALID_OR_DUPLICATE_SHADOW_SCORE");
  seen.add(r.code);return {code:r.code,baselineScore:r.baselineScore,candidateScore:r.candidateScore};
 }).sort((a,b)=>a.code.localeCompare(b.code));
 const payload={schema:"SHADOW_SCORE_BATCH_V1",tradeDate,capturedAt,sourceId,sourceVersion,baselineVersion,candidateVersion,rows:sorted};
 const digest=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
 return {...payload,digest,independentlyTimestamped:false,approvedForTrading:false};
}
export function inspectShadowScoreBatch(record){
 try{const r=sealShadowScoreBatch(record);return {intact:r.digest===record.digest,independentlyTimestamped:false};}catch{return {intact:false,independentlyTimestamped:false};}
}
