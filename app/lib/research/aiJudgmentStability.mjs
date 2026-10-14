/** Research-only comparison of archived AI score bands.
 * DO NOT equate these bands to the independently calculated swing,
 * morning-recheck or 5-minute chart predictions. Missing snapshots
 * are not signal changes. Future reference prices are never backfilled.
 */
export const AI_STABILITY_STUDY_VERSION = "GOLDEN_ZONE_SCORE_BANDS_V1";
export const AI_STABILITY_BANDS = Object.freeze([
  {minimum:95,key:"PRIME",label:"大本命"},
  {minimum:85,key:"BUY_CANDIDATE",label:"買い候補"},
  {minimum:75,key:"PULLBACK",label:"押し目待ち"},
  {minimum:65,key:"WATCH",label:"様子見"},
  {minimum:0,key:"PASS",label:"見送り"},
]);
export const JST_SLOTS = Object.freeze(["09:15","09:30","10:30","12:40","13:00","14:30","15:15"]);
export function bandForScore(value) {
  if(value===null||value===undefined||String(value).trim()==="") return null;
  const score=Number(value);
  if(!Number.isFinite(score)||score<0||score>100) return null;
  return AI_STABILITY_BANDS.find(b=>score>=b.minimum)?.key??null;
}
export function bandLabel(key){
  return AI_STABILITY_BANDS.find(b=>b.key===key)?.label??"不明";
}
const numberOrNull=(v)=>{
  if(v===null||v===undefined||v==="") return null;
  const n=Number(v);return Number.isFinite(n)?n:null;
};
export function evaluateJudgmentStability(rows) {
  const byStockDay=new Map();
  for(const row of rows) {
    const date=String(row.trade_date??"");
    const code=String(row.code??"");
    const slot=String(row.time_slot??"");
    const band=bandForScore(row.ai_power);
    const price=numberOrNull(row.entry_price);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^[0-9A-Z]{4}$/.test(code)||
      !JST_SLOTS.includes(slot)||band===null||price===null||price<=0)continue;
    const key=date+":"+code;
    if(!byStockDay.has(key))byStockDay.set(key,[]);
    byStockDay.get(key).push({...row,trade_date:date,code,slot,band,
      score:Number(row.ai_power),price});
  }
  const result=[];
  for(const [key,records] of byStockDay){
    records.sort((a,b)=>{
      const da=Date.parse(String(a.sampled_at??"")),db=Date.parse(String(b.sampled_at??""));
      const ta=Number.isFinite(da)?da:Infinity,tb=Number.isFinite(db)?db:Infinity;
      return ta-tb || JST_SLOTS.indexOf(a.slot)-JST_SLOTS.indexOf(b.slot);
    });
    const seen=new Set();
    const observations=records.filter(r=>{if(seen.has(r.slot))return false;seen.add(r.slot);return true;});
    // The first and subsequent observations must refer to different stored time slots.
    let changes=0,largestScoreChange=0;const switches=[];
    for(let i=1;i<observations.length;i++){
      const prev=observations[i-1],next=observations[i];
      largestScoreChange=Math.max(largestScoreChange,Math.abs(next.score-prev.score));
      if(prev.band!==next.band){changes++;switches.push({from:prev.band,to:next.band,fromSlot:prev.slot,toSlot:next.slot});}
    }
    const first=observations[0];
    const last=observations.at(-1);
    // Bias guard: a classification that uses changes observed throughout the
    // session cannot be compared against a hypothetical earlier purchase.
    // The evaluation clock begins AFTER the last required observation.
    const outcomePrice=numberOrNull(last.outcome_price);
    const comparable=outcomePrice!==null&&outcomePrice>0&&
      String(last.outcome_date??"")>last.trade_date;
    const futureReturn=comparable?(outcomePrice-last.price)/last.price*100:null;
    result.push({
      key,date:first.trade_date,code:first.code,name:String(first.name??""),
      samples:observations.length,firstSlot:first.slot,lastSlot:observations.at(-1).slot,
      firstScore:first.score,lastScore:observations.at(-1).score,
      firstBand:first.band,lastBand:observations.at(-1).band,
      scoreRange:Math.max(...observations.map(r=>r.score))-Math.min(...observations.map(r=>r.score)),
      maxConsecutiveScoreChange:largestScoreChange,
      changes,switches,observations:observations.map(r=>({time:r.slot,score:r.score,
        band:r.band,price:r.price,sampledAt:r.sampled_at})),
      firstPrice:first.price,entryPriceForOutcome:last.price,
      evaluationSlot:last.slot,outcomePrice:comparable?outcomePrice:null,
      outcomeDate:comparable?last.outcome_date:null,
      futureReturnPct:futureReturn,
      // A single observation is not evidence of stability.
      group:observations.length<2?"INSUFFICIENT":changes>0?"CHANGED":"STABLE",
    });
  }
  return result.sort((a,b)=>b.date.localeCompare(a.date)||b.changes-a.changes||
    b.scoreRange-a.scoreRange||a.code.localeCompare(b.code));
}
export function summarizeStability(dailyRows){
  const considered=dailyRows.filter(r=>r.samples>=2);
  const groups=["CHANGED","STABLE"].map(name=>{
    const rows=considered.filter(r=>r.group===name);
    const judged=rows.filter(r=>Number.isFinite(r.futureReturnPct));
    const n=judged.length;
    return {key:name,candidates:rows.length,days:new Set(rows.map(r=>r.date)).size,
      judged:n,wins:judged.filter(r=>r.futureReturnPct>0).length,
      winRate:n?100*judged.filter(r=>r.futureReturnPct>0).length/n:null,
      avgReturn:n?judged.reduce((a,r)=>a+r.futureReturnPct,0)/n:null,
      worstReturn:n?Math.min(...judged.map(r=>r.futureReturnPct)):null};
  });
  return {total:dailyRows.length,comparable:considered.length,
    noComparison:dailyRows.length-considered.length,
    changed:groups[0],stable:groups[1],
    days:new Set(dailyRows.map(r=>r.date)).size};
}
