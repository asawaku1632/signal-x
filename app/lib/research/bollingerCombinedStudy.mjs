/**
 * READ-ONLY research. Rule boundaries fixed independently of returns.
 * Chronological 5-session embargo: discovery <= Aug 31, excluded Sep 1–7,
 * later period >= Sep 8. These are historical comparisons, NOT a genuinely
 * unseen out-of-sample validation because researchers have seen 2026 results.
 */
export const COMBINED_RESEARCH_VERSION="BB_COMBINED_HISTORICAL_V1";
export const RULES=Object.freeze([
 {id:"BASELINE",name:"同じ上抜け全件"},
 {id:"RSI70_VOLUME_HIGH",name:"RSI70以上 × 出来高1.3倍以上"},
 {id:"RSI50_70_VOLUME_HIGH",name:"RSI50〜70 × 出来高1.3倍以上"},
 {id:"TREND0_5_VOLUME_LOW",name:"直前10日0〜5%未満 × 出来高1.3倍未満"},
 {id:"TREND5_VOLUME_HIGH",name:"直前10日+5%以上 × 出来高1.3倍以上"},
 {id:"BREAKOUT2_VOLUME_HIGH",name:"上抜け幅2%以上 × 出来高1.3倍以上"},
 {id:"RSI70_TREND0_5",name:"RSI70以上 × 直前10日0〜5%未満"}
]);
export const MIN_SAMPLE=30;
const HORIZONS=[1,3,5];
const GROUPS=["SQUEEZE_UP_BREAKOUT","OTHER_UP_BREAKOUT"];
const PERIODS=["EARLY","LATE","ALL"];
function finiteNumber(n){
 if(typeof n!=="string"&&typeof n!=="number")return null;
 const v=Number(n);
 return Number.isFinite(v)?v:null;
}
export function signalLocalDate(seconds){
 const n=Number(seconds);
 if(!Number.isSafeInteger(n)||n<1)throw Error("INVALID_SIGNAL_TIME");
 return new Date(n*1000).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});
}
export function researchPeriod(seconds){
 const d=signalLocalDate(seconds);
 return d<"2026-09-01"?"EARLY":d>="2026-09-08"?"LATE":"EMBARGO";
}
export function matchesResearchRule(r,id){
 switch(id){
 case "BASELINE":return true;
 case "RSI70_VOLUME_HIGH":return r.rsi_group==="RSI_70_PLUS"&&r.volume_bucket==="HIGH_1_3X";
 case "RSI50_70_VOLUME_HIGH":return r.rsi_group==="RSI_50_TO_70"&&r.volume_bucket==="HIGH_1_3X";
 case "TREND0_5_VOLUME_LOW":return r.trend_group==="TREND_FLAT_TO_5"&&r.volume_bucket==="BELOW_1_3X";
 case "TREND5_VOLUME_HIGH":return r.trend_group==="TREND_UP_5_PLUS"&&r.volume_bucket==="HIGH_1_3X";
 case "BREAKOUT2_VOLUME_HIGH":return r.breakout_group==="BREAKOUT_2_PLUS"&&r.volume_bucket==="HIGH_1_3X";
 case "RSI70_TREND0_5":return r.rsi_group==="RSI_70_PLUS"&&r.trend_group==="TREND_FLAT_TO_5";
 default:throw Error("UNKNOWN_RESEARCH_RULE");
 }
}
function summarizeSubset(items){
 const n=items.length;
 const complete=n>=MIN_SAMPLE;
 const returns=items.map(x=>x.return_percent).sort((a,b)=>a-b);
 const median=n?(n%2?returns[(n-1)/2]:(returns[n/2-1]+returns[n/2])/2):null;
 return {count:n,uniqueStocks:new Set(items.map(x=>x.code)).size,
  wins:items.filter(x=>x.return_percent>0).length,
  qualified:complete,
  positiveRate:complete?items.filter(x=>x.return_percent>0).length/n:null,
  meanReturnPercent:complete?items.reduce((a,b)=>a+b.return_percent,0)/n:null,
  medianReturnPercent:complete?median:null,
  meanAdversePercent:complete?items.reduce((a,b)=>a+b.max_adverse_percent,0)/n:null
 };
}
/** Never rely on output count alone: require every frozen horizon to belong to
 * one stock-time identity; reject duplicate, missing as-of factors, invalid
 * volume categories and numeric anomalies instead of silently changing n.
 */
export function evaluateCombinedResearch(rows,metadata){
 if(!Array.isArray(rows)||rows.length>6000)throw Error("UNBOUNDED_COHORT");
 const base=Number(metadata?.baseOutcomes);
 const extension=Number(metadata?.expansionOutcomes);
 const volume=Number(metadata?.verifiedBaseVolume);
 const factors=Number(metadata?.factors);
 if(!Number.isSafeInteger(base)||!Number.isSafeInteger(extension)||
    !Number.isSafeInteger(volume)||!Number.isSafeInteger(factors)||
    base<0||extension<0||volume<0||factors<0)
    throw Error("INVALID_COVERAGE");
 if(rows.length!==base+extension)throw Error("SOURCE_ROWS_MISSING");
 const seen=new Set(),events=new Set(),stocks=new Set(),parsed=[];
 for(const row of rows){
  const code=row?.code,group=row?.group_key,h=Number(row?.horizon);
  if(typeof code!=="string"||!/^[0-9]{4}$/.test(code)||!GROUPS.includes(group)||
     !HORIZONS.includes(h))throw Error("INVALID_STOCK_OR_HORIZON");
  const date=signalLocalDate(row?.signal_time);
  const key=code+":"+row.signal_time+":"+h;
  if(seen.has(key))throw Error("DUPLICATE_FROZEN_OUTCOME");
  seen.add(key);events.add(code+":"+row.signal_time);stocks.add(code);
  if(!["RSI_70_PLUS","RSI_50_TO_70","RSI_BELOW_50"].includes(row.rsi_group)||
     !["TREND_UP_5_PLUS","TREND_FLAT_TO_5","TREND_NEGATIVE"].includes(row.trend_group)||
     !["BREAKOUT_2_PLUS","BREAKOUT_BELOW_2"].includes(row.breakout_group)||
     !["HIGH_1_3X","BELOW_1_3X","UNKNOWN"].includes(row.volume_bucket))
    throw Error("MISSING_OR_BAD_FACTOR");
  const ret=finiteNumber(row.return_percent),mae=finiteNumber(row.max_adverse_percent);
  if(ret===null||mae===null||ret< -100||ret>100000||mae< -100||mae>100000)
   throw Error("INVALID_OUTCOME");
  parsed.push({code,signal_time:Number(row.signal_time),group_key:group,
   horizon:h,return_percent:ret,max_adverse_percent:mae,
   rsi_group:row.rsi_group,trend_group:row.trend_group,
   breakout_group:row.breakout_group,volume_bucket:row.volume_bucket,
   period:researchPeriod(row.signal_time),date});
 }
 if(events.size!==factors)throw Error("FACTOR_EVENT_COVERAGE_MISMATCH");
 if(rows.filter(x=>Number(x.horizon)===1).length!==events.size)
  throw Error("MISSING_NEXT_DAY_SOURCE");
 const summaries=[];
 for(const group of GROUPS)for(const h of HORIZONS)for(const rule of RULES){
  const selected=parsed.filter(x=>x.group_key===group&&x.horizon===h&&matchesResearchRule(x,rule.id));
  // 'ALL' omits embargo when paired with split comparisons to avoid leakage.
  for(const period of PERIODS){
   const items=period==="ALL"?selected.filter(x=>x.period!=="EMBARGO"):selected.filter(x=>x.period===period);
   summaries.push({group,horizon:h,rule:rule.id,period,...summarizeSubset(items)});
  }
 }
 const embargoEvents=new Set(parsed.filter(x=>x.period==="EMBARGO").map(x=>x.code+":"+x.signal_time)).size;
 return {version:COMBINED_RESEARCH_VERSION,
  coverage:{outcomes:rows.length,signals:events.size,stocks:stocks.size,
   baseOutcomes:base,expansionOutcomes:extension,verifiedBaseVolume:volume,
   embargoEvents,split:"EARLY <= 2026-08-31; GAP 2026-09-01..07; LATE >= 2026-09-08"},
  rules:RULES,summaries,
  verdict:"EXPLORATORY_ONLY_NO_TRADING_VALIDATION"};
}
