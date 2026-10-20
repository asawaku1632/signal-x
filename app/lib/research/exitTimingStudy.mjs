/** Exit-time observation on the SAME prior-night 5 symbols, one 09:10 5m OPEN.
 * Added as optional immutable shadow data to the existing 16:45 one-shot archive.
 * Does not change any original entry-time scores, scans or notification logic.
 * The 09:10 price is indicative, not a guaranteed executable quote.
 */
import {jstParts} from "./entryTimeShadow.mjs";
export const EXIT_TIME_COMPARE_VERSION="NINE_TEN_FOUR_EXITS_V1";
export const EXIT_TIMES=Object.freeze(["09:30","10:00","11:30","15:30"]);
export const EXIT_TIME_MIN_DAYS=10;
export const EXIT_TIME_MIN_STOCK_DAYS=30;
const positive=n=>typeof n==="number"&&Number.isFinite(n)&&n>0;
const clock=minute=>String(Math.floor(minute/60)).padStart(2,"0")+":"+
  String(minute%60).padStart(2,"0");
const windowBars=Object.freeze({
 "09:30":{end:9*60+25,last:"09:25"},
 "10:00":{end:9*60+55,last:"09:55"},
 "11:30":{end:11*60+25,last:"11:25"},
 "15:30":{end:15*60+25,last:"15:25"}
});
const round=n=>Number(n.toFixed(4));
function intervals(end){
  const result=[];
  for(const [from,to] of [[9*60+10,11*60+25],[12*60+30,15*60+25]]){
    for(let m=from;m<=Math.min(end,to);m+=5)result.push(clock(m));
  }
  return result;
}

/** All four exit prices and continuous lows must be available for fair comparison.
 * 09:30/10:00/11:30 refer to the preceding 5m candle CLOSE, avoiding
 * peeking at a bar that starts at the stated exit time.
 * The 15:30 reference uses 15:30 closing auction if provided, else
 * 15:25 candle close (same convention as existing shadow research).
 */
export function evaluateExitTimeStudy(tradeDate,candidate,bars){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)||
    !candidate||!/^[0-9]{4}$/.test(String(candidate.code)))
    throw Error("INVALID_EXIT_STUDY_INPUT");
  const byTime=new Map();
  for(const bar of Array.isArray(bars)?bars:[]){
    if(!Number.isFinite(bar?.time))continue;
    const j=jstParts(bar.time*1000);
    if(j.date!==tradeDate||byTime.has(j.hhmm))continue;
    byTime.set(j.hhmm,bar);
  }
  const entryPrice=byTime.get("09:10")?.open;
  const results=EXIT_TIMES.map(time=>{
    const definition=windowBars[time];
    const final=byTime.get(definition.last);
    const auction=time==="15:30"?byTime.get("15:30"):null;
    const exitPrice=time==="15:30"?(auction??final)?.close:final?.close;
    const times=intervals(definition.end);
    const complete=positive(entryPrice)&&positive(exitPrice)&&times.every(t=>{
      const bar=byTime.get(t);
      return !!bar&&positive(bar.open)&&positive(bar.low)&&
        positive(bar.high)&&positive(bar.close)&&bar.low<=bar.high&&
        bar.low<=Math.min(bar.open,bar.close)&&
        bar.high>=Math.max(bar.open,bar.close);
    });
    if(!complete)return {time,complete:false,reason:"MISSING_OR_INCONSISTENT_FIVE_MINUTE_BARS"};
    const series=times.map(t=>byTime.get(t));
    const low=Math.min(...series.map(b=>b.low),exitPrice);
    const high=Math.max(...series.map(b=>b.high),exitPrice);
    const pnl100=Number(((exitPrice-entryPrice)*100).toFixed(2));
    return {time,complete:true,exitPrice,pnl100,returnPct:round((exitPrice-entryPrice)/entryPrice*100),
      maxAdversePct:round(Math.min(0,(low-entryPrice)/entryPrice*100)),
      maxAdversePnl100:Math.min(0,Number(((low-entryPrice)*100).toFixed(2))),
      maxFavorablePct:round(Math.max(0,(high-entryPrice)/entryPrice*100)),
      maxFavorablePnl100:Math.max(0,Number(((high-entryPrice)*100).toFixed(2)))};
  });
  return {version:EXIT_TIME_COMPARE_VERSION,entryTime:"09:10",
    entryPrice:positive(entryPrice)?entryPrice:null,
    complete:results.every(r=>r.complete),results};
}

/** Market decisions must have been successfully SAVED before 09:10 JST.
 * A 09:11 classification can never be used as if it existed at 09:10.
 */
export function morningGateAvailable(tradeDate,morningSavedAt){
  const deadline=Date.parse(tradeDate+"T09:10:00+09:00");
  const saved=Date.parse(String(morningSavedAt??""));
  return Number.isFinite(deadline)&&Number.isFinite(saved)&&
    saved>=Date.parse(tradeDate+"T09:00:00+09:00")&&saved<deadline;
}

/** Only prospective stock-days linked to an actual previous-evening freeze.
 * The frozen code/name/score/referencePrice must match both archives.
 * Exactly the same complete stock-days contribute to all four exit times.
 */
export function pairExitResearch(morningRuns,entryRuns,cutoffDate){
  const indexed=new Map((Array.isArray(entryRuns)?entryRuns:[])
    .filter(x=>Array.isArray(x.results)&&["COMPLETE","PARTIAL"].includes(x.status))
    .map(x=>[String(x.trade_date),x]));
  const matched=[],excluded=[];
  const seen=new Set();
  for(const morning of Array.isArray(morningRuns)?morningRuns:[]){
    const date=String(morning.trade_date??"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>=cutoffDate)continue;
    const closing=indexed.get(date);
    if(!morningGateAvailable(date,morning.morning_saved_at)||
      !Array.isArray(morning.cohort)||!Array.isArray(morning.morning_observations)||
      !closing||morning.prior_date!==closing.prior_date){
      excluded.push({date,reason:"MORNING_GATE_OR_PRICE_ARCHIVE_MISSING"});
      continue;
    }
    const morningByCode=new Map(morning.morning_observations.map(x=>[String(x.code),x]));
    const closingByCode=new Map(closing.results.map(x=>[String(x.code),x]));
    for(const c of morning.cohort){
      const code=String(c.code??"");
      const key=date+":"+code;
      if(seen.has(key))continue;seen.add(key);
      const observation=morningByCode.get(code),saved=closingByCode.get(code);
      const study=saved?.exitTimeStudy;
      const ok=/^[0-9]{4}$/.test(code)&&
        observation&&["BUY_CANDIDATE","CAUTION","SKIP"].includes(observation.label)&&
        saved&&saved.date===date&&
        Number(saved.priorScore)===Number(c.score)&&
        Number(saved.priorReferencePrice)===Number(c.referencePrice)&&
        Number(saved.rank)===Number(c.rank)&&
        study?.version===EXIT_TIME_COMPARE_VERSION&&study.complete===true&&
        Array.isArray(study.results)&&study.results.length===EXIT_TIMES.length&&
        study.results.every((e,i)=>e.time===EXIT_TIMES[i]&&e.complete&&
          positive(e.exitPrice)&&Number.isFinite(e.pnl100)&&Number.isFinite(e.maxAdversePct));
      if(!ok){excluded.push({date,code,reason:"MISSING_OR_UNMATCHED_FOUR_EXIT_DATA"});continue;}
      matched.push({date,code,name:String(c.name),label:observation.label,
        priorScore:Number(c.score),entryPrice:Number(study.entryPrice),
        exits:study.results});
    }
  }
  return {matched,excluded};
}

/** Keep group comparisons matched and hide premature performance claims. */
export function summarizeExitResearch(matched){
  const rows=Array.isArray(matched)?matched:[];
  const dates=new Set(rows.map(x=>x.date)).size;
  const sufficient=rows.length>=EXIT_TIME_MIN_STOCK_DAYS&&dates>=EXIT_TIME_MIN_DAYS;
  const summarize=items=>EXIT_TIMES.map((time,i)=>{
    const series=items.map(s=>s.exits[i]),count=series.length;
    return {time,count,
      positiveCount:series.filter(x=>x.pnl100>0).length,
      positiveRate:sufficient&&count?100*series.filter(x=>x.pnl100>0).length/count:null,
      avgPnl100:sufficient&&count?series.reduce((a,b)=>a+b.pnl100,0)/count:null,
      worstPnl100:sufficient&&count?Math.min(...series.map(x=>x.pnl100)):null,
      avgMaxAdversePct:sufficient&&count?series.reduce((a,b)=>a+b.maxAdversePct,0)/count:null,
      worstAdversePct:sufficient&&count?Math.min(...series.map(x=>x.maxAdversePct)):null,
      avgMaxFavorablePct:sufficient&&count?series.reduce((a,b)=>a+b.maxFavorablePct,0)/count:null};
  });
  const morningOnly=rows.filter(x=>x.exits[0].pnl100>0&&x.exits[3].pnl100<=0).length;
  const nearHighThenLoss=rows.filter(x=>x.exits[0].maxFavorablePct>=2&&x.exits[3].pnl100<0).length;
  const green=rows.filter(x=>x.label==="BUY_CANDIDATE");
  return {count:rows.length,days:dates,sufficient,morningOnly,
    nearHighThenLoss,greenCount:green.length,all:summarize(rows),green:summarize(green)};
}
