/**
 * Strict as-of catalyst evidence intake, SHADOW ONLY.
 * Never infer that an issuer revised guidance from price action or a title.
 * No network or DB operations; callers must pass reviewed source records.
 */
export const CATALYST_TYPES=Object.freeze([
  "UPWARD_REVISION","DIVIDEND_INCREASE","EARNINGS_BEAT","SHAREHOLDER_RETURN",
]);
export const CATALYST_POLICY="ASOF_TIMESTAMPED_SOURCE_V1";
const validTime=value=>typeof value==="string"&&/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)&&
  /(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
const urlOk=value=>{
  try { const url=new URL(value);return url.protocol==="https:"&&!!url.hostname&&
    !url.username&&!url.password; } catch{return false;}
};
/**
 * Published time AND record-observed time must precede the frozen decision.
 * Unknown timing/data is never converted into a positive catalyst.
 * One event is counted at most once even if duplicate records are supplied.
 */
export function assessAsOfCatalysts({code,freezeAt,records=[]}){
  if(!/^[0-9]{4}$/.test(String(code))||!validTime(freezeAt))throw Error("INVALID_CATALYST_TARGET");
  const cutoff=Date.parse(freezeAt);
  const accepted=[],seen=new Set();
  let rejected=0,afterFreeze=0;
  for(const row of Array.isArray(records)?records:[]){
    if(String(row?.code)!==String(code)||!CATALYST_TYPES.includes(row?.type)||
      !validTime(row?.publishedAt)||!validTime(row?.observedAt)||
      typeof row?.title!=="string"||!row.title.trim()||
      row.title.length>240||!urlOk(row?.sourceUrl)) {rejected++;continue;}
    const published=Date.parse(row.publishedAt),observed=Date.parse(row.observedAt);
    if(published>cutoff||observed>cutoff||observed<published){afterFreeze++;continue;}
    const key=[row.type,row.publishedAt,row.sourceUrl].join("|");
    if(seen.has(key))continue;
    seen.add(key);
    accepted.push({
      code:String(code),type:row.type,title:row.title.trim(),
      sourceUrl:row.sourceUrl,publishedAt:row.publishedAt,observedAt:row.observedAt,
    });
  }
  accepted.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||
    a.sourceUrl.localeCompare(b.sourceUrl));
  return {policy:CATALYST_POLICY,code:String(code),freezeAt,
    status:accepted.length?"VERIFIED_AS_OF":"NOT_VERIFIED",
    accepted,rejected,afterFreeze};
}

/** A stored night cohort is not automatically equivalent to an unrelated
 * budget-filtered list. Only exact score/price/stock membership may be paired.
 * Morning verification also requires an actual 09:05 saved evaluation.
 */
export function assessFrozenBudgetMorning(watch,run){
  const no=reason=>({status:reason,price0905:null,morningLabel:null,referenceCostYen:null});
  if(!watch||!/^[0-9]{4}$/.test(String(watch.code))||
     !/^\d{4}-\d{2}-\d{2}$/.test(String(watch.targetTradeDate))||
     !Number.isFinite(watch.referencePrice)||watch.referencePrice<=0||
     !Number.isFinite(watch.score)||!Number.isFinite(watch.budgetYen)||
     !Number.isInteger(watch.shares)||watch.shares!==100)return no("INVALID_WATCH");
  if(!run||run.trade_date!==watch.targetTradeDate||
    run.prior_date!==watch.referencePriceDate)return no("NOT_FROZEN");
  // PostgreSQL timestamptz::text can be YYYY-MM-DD HH:MM:SS+00.
  // A timestamp without an explicit timezone is not accepted.
  const dbTime=value=>{
    const raw=String(value??"");
    if(!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(raw))return NaN;
    const tz=raw.replace(" ","T").replace(/([+-]\d{2})$/, "$1:00")
      .replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
    return Date.parse(tz);
  };
  const freeze=dbTime(run.frozen_at);
  const earliest=Date.parse(run.prior_date+"T18:00:00+09:00");
  const latest=Date.parse(run.trade_date+"T09:00:00+09:00");
  if(!Number.isFinite(freeze)||freeze<earliest||freeze>=latest)return no("NOT_FROZEN");
  const matches=(Array.isArray(run.cohort)?run.cohort:[]).filter(x=>
    String(x?.code)===watch.code);
  if(matches.length!==1||
    Number(matches[0].score)!==watch.score||
    Math.abs(Number(matches[0].referencePrice)-watch.referencePrice)>0.001)
    return no("NOT_FROZEN");
  const saved=dbTime(run.morning_saved_at);
  const windowStart=Date.parse(run.trade_date+"T09:05:00+09:00");
  const windowEnd=Date.parse(run.trade_date+"T09:19:00+09:00");
  if(!["COMPLETE","PARTIAL"].includes(run.morning_state)||
    !Number.isFinite(saved)||saved<windowStart||saved>windowEnd||
    saved<freeze)return no("MORNING_UNVERIFIED");
  const observed=(Array.isArray(run.morning_observations)?run.morning_observations:[])
    .filter(x=>String(x?.code)===watch.code);
  if(observed.length!==1)return no("MORNING_UNVERIFIED");
  const m=observed[0];
  if(!["BUY_CANDIDATE","CAUTION","SKIP"].includes(m.label)||
     !Number.isFinite(m.price0905)||m.price0905<=0||
     Number(m.priorScore)!==watch.score||
     Math.abs(Number(m.priorReferencePrice)-watch.referencePrice)>0.001)
    return no("MORNING_UNVERIFIED");
  const total=m.price0905*watch.shares;
  return {status:total>watch.budgetYen?"OVER_BUDGET":
    m.label==="BUY_CANDIDATE"?"RESEARCH_CONDITION":"RESEARCH_WAIT",
    price0905:m.price0905,morningLabel:m.label,referenceCostYen:Number(total.toFixed(2))};
}
