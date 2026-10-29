/** Offline age and as-of gate for stored preopen market references.
 * Validity of claimed source timestamps and licensing is NOT authenticated.
 */
const valid=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
export function auditPreopenMarketReference(row,{maxAgeHours=12}={}){
 if(!Number.isFinite(maxAgeHours)||maxAgeHours<=0)throw Error("INVALID_MARKET_AGE_LIMIT");
 if(!row||!valid(row.capturedAt)||typeof row.quotes!=="object"||!row.quotes)return {eligible:false,reason:"INVALID_RECORD",quoteAudits:[],verified:false};
 const quoteAudits=["dow","nasdaq","usdJpy"].map(name=>{
  const q=row.quotes[name],source=q?.sourceTimestamp;
  const ageHours=valid(source)?(Date.parse(row.capturedAt)-Date.parse(source))/3600000:null;
  const reason=ageHours===null?"MISSING_SOURCE_TIMESTAMP":ageHours<0?"FUTURE_SOURCE_TIMESTAMP":ageHours>maxAgeHours?"STALE_REFERENCE":"WITHIN_DECLARED_AGE";
  return {name,ageHours:ageHours===null?null:Number(ageHours.toFixed(4)),reason,sourceTimeAuthenticated:false};
 });
 return {eligible:quoteAudits.every(q=>q.reason==="WITHIN_DECLARED_AGE"),quoteAudits,
  verified:false,usableForTrading:false,
  warning:"Freshness is arithmetic on claimed times, not proof of quote publication, source integrity or license."};
}
