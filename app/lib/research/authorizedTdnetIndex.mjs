/** Opt-in TDnet index adapter (J-Quants v2).
 * JPX free disclosure site disallows automated scraping. This adapter never
 * contacts it. TDnet /td/list requires a paid add-on. A disabled call performs
 * ZERO network requests and does not even inspect an API credential.
 * Returned titles are INDEX_HINT_ONLY, not verified earnings revisions.
 */
export const TDNET_ADAPTER_POLICY="TDNET_V2_OPTIONAL_INDEX_RESEARCH_V1";
const validDay=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
  Number.isFinite(Date.parse(s+"T00:00:00Z"))&&
  new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const validTime=s=>typeof s==="string"&&/^\d{2}:\d{2}$/.test(s)&&
  Number(s.slice(0,2))<24&&Number(s.slice(3))<60;
const codeOf=x=>{
  const raw=String(x??"");
  if(/^[0-9]{4}$/.test(raw))return raw;
  if(/^[0-9]{4}0$/.test(raw))return raw.slice(0,4);
  return null; // Never guess letter-containing identifiers.
};
function titleHint(title){
  if(/(?:業績予想|通期業績|利益予想).*?(?:上方修正|上方に修正|上方へ修正)/.test(title))
    return "UPWARD_REVISION_TITLE_ONLY";
  if(/(?:配当予想|配当金).*?(?:増額|増配|修正)/.test(title))
    return "DIVIDEND_REVISION_TITLE_ONLY";
  if(/(?:自己株式|自社株).*(?:取得|買付)/.test(title))
    return "SHAREHOLDER_RETURN_TITLE_ONLY";
  return "UNCLASSIFIED";
}
/** The API has no "known to this subscriber at" historical field.
 * observedAt is set at response reception, NEVER replaced with DiscTime.
 * A 2026-11-02 query performed on Nov 9 may not be used for Nov 2 forecasts.
 */
export function normalizeTdnetIndex(payload,{observedAt,date}={}){
  const seen=new Set(),items=[];let invalid=0;
  const obs=Date.parse(observedAt??"");
  if(!validDay(date)||!Number.isFinite(obs)||typeof observedAt!=="string"||
     !/(Z|[+-]\d{2}:\d{2})$/.test(observedAt))throw Error("INVALID_TDNET_ASOF");
  const rows=payload?.data;
  if(!Array.isArray(rows)||rows.length>3000)throw Error("INVALID_TDNET_RESPONSE");
  for(const x of rows){
    const code=codeOf(x?.Code),day=x?.DiscDate,clock=x?.DiscTime;
    const title=x?.Title;
    const id=String(x?.DiscNo??"");
    if(!code||!validDay(day)||!validTime(clock)||
      day!==date||!/^\d{14}$/.test(id)||
      typeof title!=="string"||!title.trim()||title.length>250){
      invalid++;continue;
    }
    const publication=Date.parse(day+"T"+clock+":00+09:00");
    if(!Number.isFinite(publication)||publication>obs){invalid++;continue;}
    if(seen.has(id))continue;seen.add(id);
    items.push({code,discNo:id,companyName:String(x?.Name??""),
      title:title.trim(),publishedAt:new Date(publication).toISOString(),
      observedAt:new Date(obs).toISOString(),hint:titleHint(title),
      source:"JQUANTS_TDNET_INDEX",status:"INDEX_HINT_ONLY",
      discStatus:x?.DiscStatus??null});
  }
  items.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)||a.discNo.localeCompare(b.discNo));
  return {policy:TDNET_ADAPTER_POLICY,items,invalid,
    cursor:typeof payload?.cursor==="string"?payload.cursor:null,
    paginationKey:typeof payload?.pagination_key==="string"?payload.pagination_key:null};
}
/** Enabled only with explicit operator approval and already-entitled API key.
 * This function is never called automatically by the release branch.
 * No pagination cursor is followed here; must return incomplete if paged.
 */
export async function readAuthorizedTdnetIndex({date,enabled=false,approved=false,
 apiKey,fetcher=fetch,now=new Date()}){
  if(!enabled||!approved)return {status:"DISABLED_NO_COST",items:[],networkCalls:0};
  if(!validDay(date)||typeof apiKey!=="string"||!apiKey)
    return {status:"NOT_CONFIGURED",items:[],networkCalls:0};
  const query=new URL("https://api.jquants.com/v2/td/list");
  query.searchParams.set("date",date);
  const res=await fetcher(query.toString(),{
    method:"GET",headers:{"x-api-key":apiKey},cache:"no-store",
    signal:AbortSignal.timeout(8000),
  });
  if(!res.ok)return {status:"UPSTREAM_ERROR",httpStatus:res.status,items:[],networkCalls:1};
  const data=await res.json();
  const result=normalizeTdnetIndex(data,{date,observedAt:now.toISOString()});
  return {status:result.paginationKey?"INCOMPLETE_PAGINATION":"INDEX_ONLY",
    ...result,networkCalls:1};
}
