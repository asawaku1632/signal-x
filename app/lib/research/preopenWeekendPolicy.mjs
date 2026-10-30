/** Offline, conservative weekend-only calendar policy; not a US holiday calendar.
 * Applies longer age window solely to Friday-source US equity indexes on Monday JST.
 * Provider claims and license are never authenticated.
 */
import {auditPreopenMarketReference} from "./preopenReferenceAgeAudit.mjs";
const dayJst=instant=>new Date(Date.parse(instant)+9*3600000);
const valid=x=>typeof x==="string"&&/^(\d{4}-\d\d-\d\d)T\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
export function auditPreopenWeekendPolicy(row,{baseAgeHours=12,weekendIndexAgeHours=72}={}){
 if(!Number.isFinite(baseAgeHours)||baseAgeHours<=0||!Number.isFinite(weekendIndexAgeHours)||weekendIndexAgeHours<baseAgeHours)
  throw Error("INVALID_WEEKEND_AGE_POLICY");
 const overrides={};
 if(row&&valid(row.capturedAt)){
  const captured=dayJst(row.capturedAt);
  if(captured.getUTCDay()===1){ // Monday in JST
   for(const index of ["dow","nasdaq"]){
    const source=row.quotes?.[index]?.sourceTimestamp;
    if(valid(source)&&new Date(Date.parse(source)).getUTCDay()===5&&
       Date.parse(source)<=Date.parse(row.capturedAt))overrides[index]=weekendIndexAgeHours;
   }
  }
 }
 const result=auditPreopenMarketReference(row,{maxAgeHours:baseAgeHours,maximumAgeByInstrument:overrides});
 return {...result,policy:"WEEKEND_INDEX_REFERENCE_SHADOW_V1",appliedOverrides:overrides,
   calendarVerified:false,providerVerified:false,signalEnabled:false,
   warning:"Friday/Monday weekend allowance is a descriptive heuristic, not a verified exchange schedule or quote availability guarantee."};
}
