/**
 * Offline daily-result baseline. This uses SIGNALX's existing historical
 * daily_stock_results columns, NOT intraday bars and NOT a trading backtest.
 * Rows must come from a read-only, approved export.
 */
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const pct=x=>Math.round(x*10000)/100;
export function summarizeSavedDailyResults(rows,{minSamples=30,scoreThreshold=85}={}){
  if(!Array.isArray(rows)||!Number.isInteger(minSamples)||minSamples<1||
    !finite(scoreThreshold))throw Error("INVALID_DAILY_BASELINE_INPUT");
  const seen=new Set(),selected=[],excluded={invalid:0,duplicate:0,belowScore:0,missingOutcome:0};
  for(const row of rows){
    if(!row||!validDate(row.date)||typeof row.code!=="string"||
      !/^\d{4}$|^\d{3}[A-Z]$/.test(row.code)||!finite(Number(row.score))||
      !finite(Number(row.price))||Number(row.price)<=0){
      excluded.invalid++;continue;
    }
    const key=row.date+"|"+row.code;
    if(seen.has(key)){excluded.duplicate++;continue;}
    seen.add(key);
    if(Number(row.score)<scoreThreshold){excluded.belowScore++;continue;}
    // next_price is a later observation and must never be a pre-day feature.
    const later=Number(row.next_price);
    if(row.next_price==null||!finite(later)||later<=0){
      excluded.missingOutcome++;continue;
    }
    selected.push({date:row.date,code:row.code,returnPct:100*(later/Number(row.price)-1)});
  }
  const returns=selected.map(x=>x.returnPct).sort((a,b)=>a-b);
  const days=new Set(selected.map(x=>x.date)).size;
  const positive=returns.filter(x=>x>0).length;
  const median=returns.length?(returns.length%2?returns[(returns.length-1)/2]:
    (returns[returns.length/2-1]+returns[returns.length/2])/2):null;
  return {version:"SAVED_DAILY_RESULTS_BASELINE_V1",scoreThreshold,
    samples:returns.length,days,eligible:returns.length>=minSamples,
    meanReturnPct:returns.length?Math.round(returns.reduce((a,b)=>a+b,0)/returns.length*10000)/10000:null,
    medianReturnPct:median===null?null:Math.round(median*10000)/10000,
    positiveCount:positive,positiveRatePct:returns.length>=minSamples?pct(positive/returns.length):null,
    excluded,warning:"Saved price and next_price are not verified executable fills. No intraday low-time inference or next-day predictive claim."};
}


/**
 * Prospective shadow evaluation of a PRE-REGISTERED rule.
 * rule.frozenAt is an immutable ISO timestamp; evaluation includes only
 * observations strictly after its JST freeze date. No network or DB writes.
 * Conditions are fixed constants, not learned from outcomes.
 */
export const FROZEN_DAILY_DROP_RULE_V1=Object.freeze({
  id:"DAILY_DROP_SCORE_SHADOW_V1",
  frozenAt:"2026-10-29T00:00:00+09:00",
  minScore:85, maxScoreDeltaExclusive:10, maxPrior3ReturnPct:-5
});
export function evaluateFrozenDailyDropRule(rows,{rule=FROZEN_DAILY_DROP_RULE_V1,minSamples=30}={}){
  if(!Array.isArray(rows)||!Number.isInteger(minSamples)||minSamples<1||
    !rule||rule.id!==FROZEN_DAILY_DROP_RULE_V1.id||
    rule.frozenAt!==FROZEN_DAILY_DROP_RULE_V1.frozenAt||
    rule.minScore!==85||rule.maxScoreDeltaExclusive!==10||
    rule.maxPrior3ReturnPct!==-5)throw Error("INVALID_FROZEN_RULE");
  const cutoff=rule.frozenAt.slice(0,10);
  const seen=new Set(),returns=[],dates=new Set();
  const validInstant=(stamp,date)=>typeof stamp==="string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(stamp) &&
    Number.isFinite(Date.parse(stamp)) &&
    Date.parse(stamp)<Date.parse(date+"T00:00:00+09:00");
  const excluded={beforeFreeze:0,invalid:0,duplicate:0,unqualified:0,missingOutcome:0,unverifiedFeatures:0,unverifiedOutcome:0};
  for(const row of rows){
    if(!row||!validDate(row.date)||typeof row.code!=="string"||
      !/^(?:\d{4}|\d{3}[A-Z])$/.test(row.code)){
      excluded.invalid++;continue;
    }
    if(row.date<=cutoff){excluded.beforeFreeze++;continue;}
    const key=row.date+"|"+row.code;
    if(seen.has(key)){excluded.duplicate++;continue;}
    seen.add(key);
    // Required fields must be point-in-time saved; no reconstruction from outcomes.
    const {score,previousScore,prior3ReturnPct,price,next_price}=row;
    if(![score,previousScore,prior3ReturnPct,price].every(finite)||price<=0){
      excluded.invalid++;continue;
    }
    if(row.featureProvenanceVerified!==true||
      !validInstant(row.featureAvailableAt,row.date)){
      excluded.unverifiedFeatures++;continue;
    }
    if(score<85||score-previousScore>=10||prior3ReturnPct> -5){
      excluded.unqualified++;continue;
    }
    if(!positivePrice(next_price)){excluded.missingOutcome++;continue;}
    if(row.outcomeProvenanceVerified!==true||!validDate(row.outcomeTradeDate)||
      row.outcomeTradeDate<=row.date){
      excluded.unverifiedOutcome++;continue;
    }
    returns.push(100*(next_price/price-1));dates.add(row.date);
  }
  const n=returns.length,positive=returns.filter(x=>x>0).length;
  const sorted=[...returns].sort((a,b)=>a-b);
  const middle=n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null;
  return {version:rule.id,freezeDate:cutoff,samples:n,days:dates.size,
    eligible:n>=minSamples,meanReturnPct:n?Number((returns.reduce((a,b)=>a+b,0)/n).toFixed(4)):null,
    medianReturnPct:middle===null?null:Number(middle.toFixed(4)),
    positiveCount:positive,positiveRatePct:n>=minSamples?Number((positive/n*100).toFixed(2)):null,
    excluded,shadowOnly:true,
    warning:"Prospective descriptive audit only. Source provenance and as-of feature timestamps require independent verification; no trading/notifications."};
}
const positivePrice=x=>finite(x)&&x>0;
