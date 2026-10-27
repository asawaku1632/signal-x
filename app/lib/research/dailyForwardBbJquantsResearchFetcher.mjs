/**
 * Research-only J-Quants V2 HTTP fetcher. No database, Cron, notification or
 * model side effects. Explicit invocation only; never runs on import.
 * API key stays in server process environment and is never returned.
 */
const CODES=Object.freeze(["8591","9432","9983"]);
const START="2026-08-24",END="2026-09-04";
export async function fetchBbResearchJquantsBars({
 apiKey,fetchImpl=globalThis.fetch,enabled=false
}={}) {
 if(enabled!==true) return {status:"BLOCKED",reason:"EXPLICIT_OPT_IN_REQUIRED",barsByCode:{}};
 if(typeof apiKey!=="string"||!apiKey.trim()) return {status:"BLOCKED",reason:"MISSING_SERVER_API_KEY",barsByCode:{}};
 if(typeof fetchImpl!=="function") return {status:"BLOCKED",reason:"FETCH_UNAVAILABLE",barsByCode:{}};
 const barsByCode={};
 for(const code of CODES) {
  const url=new URL("https://api.jquants.com/v2/equities/bars/daily");
  url.searchParams.set("code",code);
  url.searchParams.set("from",START.replaceAll("-",""));
  url.searchParams.set("to",END.replaceAll("-",""));
  let response;
  try {
   response=await fetchImpl(url.toString(),{method:"GET",headers:{"x-api-key":apiKey,"Accept":"application/json"},redirect:"error",signal:AbortSignal.timeout(12000)});
   if(!response.ok) return {status:"BLOCKED",reason:response.status===429?"RATE_LIMITED":"PROVIDER_REQUEST_FAILED",barsByCode:{}};
   const payload=await response.json();
   if(!Array.isArray(payload?.data)||payload.pagination_key)
     return {status:"BLOCKED",reason:payload?.pagination_key?"PAGINATION_UNSUPPORTED":"INVALID_PROVIDER_RESPONSE",barsByCode:{}};
   const normalized=payload.data.filter(b=>
    (b?.Code===code||b?.Code===`${code}0`)&&
    typeof b.Date==="string"&&b.Date>=START&&b.Date<=END
   ).map(b=>({...b,Code:code}));
   if(normalized.length!==payload.data.length)
     return {status:"BLOCKED",reason:"UNEXPECTED_PROVIDER_RECORD",barsByCode:{}};
   barsByCode[code]=normalized;
  } catch {
   return {status:"BLOCKED",reason:"PROVIDER_UNAVAILABLE_OR_INVALID_JSON",barsByCode:{}};
  }
 }
 return {status:"RESEARCH_ONLY_BARS_FETCHED",barsByCode,productionWrites:false,
  autoApply:false,productionApproval:false,licenseReview:"NOT_VERIFIED"};
}
