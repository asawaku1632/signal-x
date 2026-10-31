/**
 * SHADOW ONLY. Validates ALREADY ACQUIRED J-Quants API v2
 * /equities/bars/daily `date`-query responses. NO fetch, API key, cron, DB or trade.
 * Unadjusted O/H/L/C/Vo are preserved, including explicit NO_TRADE nulls.
 * Adj* history is excluded because it can be recomputed after corporate actions.
 * "Complete pages" means only response pagination integrity, never licensed,
 * independently timestamped source, complete TSE listing or trade eligibility.
 */
import { validateMa75FrozenUniverse } from './ma75FrozenUniverse.mjs';
export const MA75_JQUANTS_PAGE_VERSION='ma75_jquants_v2_offline_daily_v1';
const isDay=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&
  Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const time=s=>typeof s==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(s)?Date.parse(s):NaN;
const val=x=>typeof x==='number'&&Number.isFinite(x);
const ordinaryCode=s=>{
  if(typeof s!=='string')return null;
  if(/^[0-9]{3}[0-9A-Z]$/.test(s))return s;
  if(/^[0-9]{3}[0-9A-Z]0$/.test(s))return s.slice(0,4);
  return null; // never merge different class / suffix silently
};
const key=s=>String(s??'?');
/**
 * pages: ordered {requestPaginationKey: null|string, receivedAt: ISO8601,
 * response:{data:[{Date,Code,O,H,L,C,Vo,...}],pagination_key?:string}}.
 * The *first* request must have no pagination key, each continuation must
 * match the prior response token, and the final response must have none.
 */
export function parseMa75JQuantsDailyPages(freeze,{date,pages=[]}={}){
  validateMa75FrozenUniverse(freeze);
  if(!isDay(date)||!Array.isArray(pages)||pages.length===0)
    throw new TypeError('Need a valid date and at least one previously captured page');
  const failures=[],seenKeys=new Set(),seenCode=new Map(),rawRows=[];
  let expected=null,terminated=false,firstCapture=null,lastCapture=null;
  let previousReceiptMs=null;
  for(let i=0;i<pages.length;i++){
    const page=pages[i],request=page?.requestPaginationKey??null;
    const payload=page?.response,captured=time(page?.receivedAt);
    if(terminated){failures.push({page:i,reason:'PAGE_AFTER_TERMINAL'});break}
    if(!page||!Object.prototype.hasOwnProperty.call(page,'requestPaginationKey')){
      failures.push({page:i,reason:'MISSING_REQUEST_PAGINATION_KEY'});break;
    }
    if(!Number.isFinite(captured)||captured<Date.parse(date+'T06:30:00Z')){
      failures.push({page:i,reason:'INVALID_OR_EARLY_RECEIPT'});break;
    }
    if(previousReceiptMs!==null&&captured<previousReceiptMs){
      failures.push({page:i,reason:'PAGE_RECEIPT_TIME_REVERSED'});break;
    }
    previousReceiptMs=captured;
    if(firstCapture===null)firstCapture=page.receivedAt;
    lastCapture=page.receivedAt;
    if(request!==expected){
      failures.push({page:i,reason:'BROKEN_PAGINATION_CHAIN'});break;
    }
    if(!payload||!Array.isArray(payload.data)){
      failures.push({page:i,reason:'INVALID_RESPONSE_ENVELOPE'});break;
    }
    // Provider FAQ: absent or empty pagination_key both mean terminal page.
    const token=payload.pagination_key;
    const continuation=token===undefined||token===null||token===''?null:token;
    if(continuation!==null&&typeof continuation!=='string'){
      failures.push({page:i,reason:'INVALID_PAGINATION_KEY'});break;
    }
    if(continuation!==null&&(seenKeys.has(continuation)||continuation===request)){
      failures.push({page:i,reason:'REPEATED_PAGINATION_KEY'});break;
    }
    if(continuation!==null)seenKeys.add(continuation);
    for (const item of payload.data) rawRows.push(item);
    expected=continuation;
    if(expected===null)terminated=true;
  }
  if(!terminated&&!failures.length)failures.push({page:pages.length,reason:'TRUNCATED_PAGINATION'});
  const complete=terminated&&failures.length===0;
  const allowed=new Set(freeze.codes),outOfCohort=[];
  const entries=[],duplicateIds=new Set();
  for(const r of rawRows){
    const code=ordinaryCode(r?.Code),rowDate=r?.Date;
    if(!code||!isDay(rowDate)||rowDate!==date){
      entries.push({code:code??null,reason:'WRONG_DATE_OR_SECURITY_CLASS'});continue;
    }
    const id=code+':'+rowDate;
    if(seenCode.has(id)){duplicateIds.add(id);continue}
    seenCode.set(id,r);
    if(!allowed.has(code)){outOfCohort.push(code);continue}
    let status='DAILY_BAR',bar=null;
    if([r.O,r.H,r.L,r.C].every(x=>x===null)&&
        (r.Vo===null||r.Vo===0)){
      status='NO_TRADE';
    }else if(![r.O,r.H,r.L,r.C,r.Vo].every(val)||
      !(r.O>0&&r.H>0&&r.L>0&&r.C>0&&r.Vo>0)||
      r.H<Math.max(r.O,r.C,r.L)||r.L>Math.min(r.O,r.C,r.H)){
      status='INVALID_OHLCV';
    }else {
      bar={tradeDate:date,code,open:r.O,high:r.H,low:r.L,
        close:r.C,volume:r.Vo,unadjusted:true};
    }
    entries.push({code,status,bar});
  }
  const results=[];
  const entriesByCode=new Map(entries.filter(e=>e.code&&allowed.has(e.code)&&typeof e.status==='string')
    .map(e=>[e.code,e]));
  for(const code of freeze.codes){
    const e=entriesByCode.get(code);
    let status=e?.status??'MISSING_PROVIDER_ROW';
    if(duplicateIds.has(code+':'+date))status='DUPLICATE_CODE_DATE';
    if(!complete)status='BLOCKED_PAGINATION';
    results.push({code,tradeDate:date,status,
      bar:complete&&status==='DAILY_BAR'?e.bar:null});
  }
  const counts={};
  for(const r of results)counts[r.status]=(counts[r.status]??0)+1;
  const invalidExtra=entries.filter(x=>x.reason);
  return {
    version:MA75_JQUANTS_PAGE_VERSION,date,expectedFrozenCodes:freeze.codes.length,
    readPages:pages.length,rawProviderRows:rawRows.length,
    lastReceivedAt:lastCapture,firstReceivedAt:firstCapture,
    paginationComplete:complete,failures,unmappedRows:invalidExtra,
    duplicateCodeDates:[...duplicateIds].sort(),outsideFrozenCodes:[...new Set(outOfCohort)].sort(),
    counts,rows:results,
    structurallyUsableRawBars:complete?(counts.DAILY_BAR??0):0,
    verifiedOriginalProviderCapture:false,providerRightsVerified:false,
    adjustedHistoricalAsOfValidated:false,eligibleForForwardSignal:false,
    eligibleForProduction:false,eligibleForNotifications:false,
    note:'An offline response-envelope consistency check, not proof that data was accessible as-of the historical trade or that an external provider was licensed.',
  };
}
