import {createHash} from "node:crypto";
import {inspectDualSurge,DUAL_SURGE_VERSION} from "./dualSurgeDetectors.mjs";
const dateJst=t=>new Date(t*1000).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});
/**
 * Build only fresh, completed-session, provider-authorized research rows.
 * No backfill and no network. Caller must independently verify the source close,
 * exchange calendar, provider license and that the observation is being captured now.
 */
export function prepareDualSurgeCandidates({code,candles,signalDate,completedDate,provider,licenseStatus,calendarVersion,sourceVerified}) {
 if(!/^\d{4}$/.test(code||""))throw Error("INVALID_CODE");
 if(!provider||licenseStatus!=="APPROVED"||sourceVerified!==true)throw Error("PROVIDER_NOT_APPROVED");
 if(!calendarVersion||!/^\d{4}-\d{2}-\d{2}$/.test(signalDate||"")||signalDate!==completedDate)
  throw Error("NOT_FRESH_COMPLETED_SESSION");
 const t=candles?.length-1;
 if(!Number.isInteger(t)||t<21||dateJst(candles[t].time)!==signalDate)
  throw Error("SIGNAL_DATE_MISMATCH");
 const result=inspectDualSurge(candles,t);
 if(!result.available)throw Error("DETECTOR_UNAVAILABLE:"+result.reason);
 const sourceHash=createHash("sha256").update(JSON.stringify({version:DUAL_SURGE_VERSION,calendarVersion,provider,candles:candles.slice(t-20,t+1)})).digest("hex");
 return result.signals.map(({cohort,features})=>({
  detector_version:DUAL_SURGE_VERSION,cohort,code,signal_date:signalDate,
  signal_time:candles[t].time,provider,provider_license_status:licenseStatus,
  source_hash:sourceHash,calendar_version:calendarVersion,
  features,signal_close:candles[t].close
 }));
}
/** Insert-only. Conflicting capture must be verified rather than overwritten. */
export async function insertDualSurgeCandidates(db,rows) {
 if(!db||typeof db.query!=="function")throw Error("DATABASE_UNAVAILABLE");
 if(!Array.isArray(rows))throw Error("INVALID_ROWS");
 const ids=[];
 for(const row of rows){
  if(row.detector_version!==DUAL_SURGE_VERSION||!["PRE_SURGE_V1","SURGE_START_V1"].includes(row.cohort)||!/^\d{4}$/.test(row.code)||row.provider_license_status!=="APPROVED"||!/^[a-f0-9]{64}$/.test(row.source_hash)||!Number.isFinite(row.signal_close)||row.signal_close<=0)throw Error("INVALID_CAPTURE");
  const params=[row.detector_version,row.cohort,row.code,row.signal_date,row.signal_time,row.provider,row.provider_license_status,row.source_hash,row.calendar_version,JSON.stringify(row.features),row.signal_close];
  const sql=`insert into public.dual_surge_shadow_candidates
   (detector_version,cohort,code,signal_date,signal_time,provider,provider_license_status,source_hash,calendar_version,features,signal_close)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
   on conflict (detector_version,cohort,code,signal_date) do nothing returning id`;
  const result=await db.query(sql,params);
  if(result.rowCount!==1)throw Error("DUPLICATE_CAPTURE_REQUIRES_REVIEW");
  ids.push(result.rows[0].id);
 }
 return ids;
}
