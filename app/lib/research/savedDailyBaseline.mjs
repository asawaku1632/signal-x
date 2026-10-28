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
