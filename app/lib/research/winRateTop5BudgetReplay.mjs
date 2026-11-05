/**
 * Historical REPLAY of the audited portion of the WIN/LOSE/HOLD leaderboard.
 * This is NOT a historical capture of the live ranking, nor proof of actual
 * broker fills. Every selection uses only rows recorded before 09:00 JST on
 * the hypothetical trade day. Archive prices may be examined only afterward.
 * Shadow-only, immutable inputs, no side effects.
 */
export const TOP5_REPLAY_VERSION="PROVENANCE_ONLY_WINRATE_TOP5_0930_EXIT135_SHADOW_V1";
export const TOP5_REPLAY_HORIZONS=Object.freeze([1,3,5]);
export const TOP5_REPLAY_BUDGETS=Object.freeze([100000,300000,350000,380000,500000]);
export const TOP5_REPLAY_MIN_CASES=30;
export const TOP5_REPLAY_MIN_DAYS=10;
export const TOP5_REPLAY_FRICTION_PER_SIDE=0.001;
const good=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  !Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const ms=x=>typeof x==="string"&&/(Z|[+-]\d{2}:\d{2})$/.test(x)?Date.parse(x):NaN;
const jst=(day,clock)=>Date.parse(day+"T"+clock+":00+09:00");
const money=x=>Number(x.toFixed(2));
const rate=(num,den)=>den>0?money(100*num/den):null;
const average=a=>money(a.reduce((sum,x)=>sum+x,0)/a.length);
const median=a=>{const v=[...a].sort((x,y)=>x-y),mid=Math.floor(v.length/2);
  return money(v.length%2?v[mid]:(v[mid-1]+v[mid])/2);};

function offsetDate(date,delta){
  return new Date(Date.parse(date+"T00:00:00Z")+delta*86400000).toISOString().slice(0,10);
}
function tradingDatesAfter(date,amount,isTradingDate){
  const dates=[];
  for(let step=1;step<=30&&dates.length<amount;step++){
    const d=offsetDate(date,step);
    if(isTradingDate(d))dates.push(d);
  }
  if(dates.length!==amount)throw Error("UNAVAILABLE_CALENDAR");
  return dates;
}
function previousTradingDate(date,isTradingDate){
  for(let step=1;step<=14;step++){
    const d=offsetDate(date,-step);
    if(isTradingDate(d))return d;
  }
  throw Error("UNAVAILABLE_CALENDAR");
}
function verifiedHistoricalOutcome(row,tradeDate,isTradingDate){
  if(!row||!validDate(row.date)||row.date>=tradeDate||
    !/^[0-9]{4}$/.test(String(row.code))||
    !["WIN","LOSE","HOLD"].includes(row.result)||
    row.judgedResult!==row.result||
    !good(Number(row.price))||!good(Number(row.nextPrice))||
    !good(Number(row.sourcePrice))||
    Math.abs(Number(row.sourcePrice)-Number(row.nextPrice))>0.01||
    !validDate(row.sourceTradeDate))return false;
  const cutoff=jst(tradeDate,"09:00");
  const created=ms(row.createdAt),checked=ms(row.checkedAt),recorded=ms(row.recordedAt);
  if(!Number.isFinite(created)||!Number.isFinite(checked)||
    !Number.isFinite(recorded)||created>=cutoff||checked>=cutoff||recorded>=cutoff||
    checked<created||recorded<created||
    created<jst(row.date,"15:35")||
    row.sourceTradeDate>=tradeDate)return false;
  try{
    if(tradingDatesAfter(row.date,1,isTradingDate)[0]!==row.sourceTradeDate)return false;
  }catch{return false;}
  const pct=100*(Number(row.nextPrice)-Number(row.price))/Number(row.price);
  if(!Number.isFinite(pct)||Math.abs(pct-Number(row.changePercent))>0.06)return false;
  return row.result===(pct>=2?"WIN":pct<=-2?"LOSE":"HOLD");
}
function sortedEligibleRanking(rows){
  const byCode=new Map();
  for(const row of rows){
    const code=String(row.code);
    if(!byCode.has(code))byCode.set(code,{
      code,name:String(row.name||code),win:0,lose:0,hold:0,
    });
    const item=byCode.get(code);
    if(row.result==="WIN")item.win++;
    else if(row.result==="LOSE")item.lose++;
    else item.hold++;
  }
  return [...byCode.values()].filter(x=>x.win+x.lose>=10)
    .map(x=>({...x,settled:x.win+x.lose+x.hold,
      reachRate:100*x.win/(x.win+x.lose+x.hold)}))
    .sort((a,b)=>b.reachRate-a.reachRate||
      b.settled-a.settled||b.win-a.win||a.code.localeCompare(b.code));
}
function priceAtSource(rows,sourceDate,code,cutoff){
  const matches=rows.filter(row=>row.date===sourceDate&&String(row.code)===code&&
    good(Number(row.price))&&ms(row.createdAt)>=jst(sourceDate,"15:35")&&
    ms(row.createdAt)<cutoff);
  return matches.length===1?Number(matches[0].price):null;
}
function entryFromArchive(run,code,tradeDate,priorDate,cutoff,nowMs){
  if(run.prior_date!==priorDate||!["COMPLETE","PARTIAL"].includes(run.status)||
    ms(run.finished_at)<jst(tradeDate,"16:40")||ms(run.finished_at)>nowMs||
    !Array.isArray(run.results))return null;
  const matches=run.results.filter(row=>String(row?.code)===code&&row?.date===tradeDate&&
    row?.complete===true&&Array.isArray(row.entries));
  if(matches.length!==1)return null;
  const anchors=matches[0].entries.filter(e=>e?.time==="09:30");
  const price=anchors.length===1?Number(anchors[0].entryPrice):NaN;
  return good(price)&&cutoff<jst(tradeDate,"09:30")?price:null;
}
function exitReference(rows,code,targetDate,nowMs){
  if(nowMs<jst(targetDate,"15:40"))return {status:"PENDING",price:null};
  const matches=rows.filter(row=>row.date===targetDate&&String(row.code)===code&&
    good(Number(row.price))&&ms(row.createdAt)>=jst(targetDate,"15:35")&&
    ms(row.createdAt)<=nowMs);
  if(matches.length!==1)return {status:"MISSING_PRICE",price:null};
  return {status:"OBSERVED",price:Number(matches[0].price)};
}
/** This replays one deterministic policy, NOT the user's discretionary trades:
 * use the highest-ranked member of the prior as-of top five whose prior-close
 * 100-share reference cost fits the selected per-position budget.
 * Never refill the first five with ranks 6+.
 */
export function replayProvenanceTop5Budget({
  rows,runs,now,isTradingDate,budgetYen=380000,shares=100,
}){
  if(!TOP5_REPLAY_BUDGETS.includes(budgetYen)||shares!==100||
    typeof isTradingDate!=="function")throw Error("INVALID_REPLAY_POLICY");
  const nowMs=new Date(now).getTime();
  if(!Number.isFinite(nowMs))throw Error("INVALID_REPLAY_NOW");
  const data=Array.isArray(rows)?rows:[];
  const entries=[];
  const seenDates=new Set();
  let noAuditedRank=0,noPriorPrice=0,overBudget=0,missingEntry=0;
  const completedRuns=(Array.isArray(runs)?runs:[]).filter(r=>
    validDate(r?.trade_date)&&isTradingDate(r.trade_date)&&
    ms(r.finished_at)>=jst(r.trade_date,"16:40")&&
    ms(r.finished_at)<=nowMs&&Array.isArray(r.results))
    .sort((a,b)=>a.trade_date.localeCompare(b.trade_date));
  for(const run of completedRuns){
    const tradeDate=run.trade_date;
    if(seenDates.has(tradeDate))continue;
    seenDates.add(tradeDate);
    const cutoff=jst(tradeDate,"09:00");
    const priorDate=previousTradingDate(tradeDate,isTradingDate);
    const audited=data.filter(r=>verifiedHistoricalOutcome(r,tradeDate,isTradingDate));
    const ranking=sortedEligibleRanking(audited).slice(0,5);
    if(ranking.length===0){noAuditedRank++;continue;}
    // Ranking precedes budget filtering, as in the owner's manual workflow.
    const references=ranking.map((r,i)=>({...r,rank:i+1,
      reference:priceAtSource(data,priorDate,r.code,cutoff)}));
    if(references.every(r=>r.reference===null)){noPriorPrice++;continue;}
    const withinBudget=references.filter(r=>r.reference!==null&&
      r.reference*shares<=budgetYen);
    if(withinBudget.length===0){overBudget++;continue;}
    const selected=withinBudget[0];
    const entryPrice=entryFromArchive(run,selected.code,tradeDate,priorDate,cutoff,nowMs);
    if(entryPrice===null){missingEntry++;}
    let targetDates;
    try {targetDates=tradingDatesAfter(tradeDate,5,isTradingDate);}
    catch {continue;}
    const outcomes=TOP5_REPLAY_HORIZONS.map(horizon=>{
      const targetDate=targetDates[horizon-1];
      if(entryPrice===null)return {horizon,targetDate,status:"MISSING_ENTRY",netPnl100:null};
      if(entryPrice*shares>budgetYen)return {horizon,targetDate,status:"ENTRY_OVER_BUDGET",netPnl100:null};
      const future=exitReference(data,selected.code,targetDate,nowMs);
      if(future.status!=="OBSERVED")return {
        horizon,targetDate,status:future.status,netPnl100:null,
      };
      const exitPrice=future.price;
      const gross=(exitPrice-entryPrice)*shares;
      const friction=(entryPrice+exitPrice)*shares*TOP5_REPLAY_FRICTION_PER_SIDE;
      return {horizon,targetDate,status:"OBSERVED",exitPrice,
        netPnl100:money(gross-friction),
        netReturnPct:money((gross-friction)/(entryPrice*shares)*100)};
    });
    entries.push({tradeDate,priorDate,code:selected.code,name:selected.name,
      originalRank:selected.rank,topFiveCount:ranking.length,referencePrice:selected.reference,
      entryPrice,shares,individuallyWithinBudget:entryPrice!==null&&
        entryPrice*shares<=budgetYen,outcomes});
  }
  // Compare horizons on precisely the SAME fully mature stock-days.
  const paired=entries.filter(e=>e.outcomes.every(o=>o.status==="OBSERVED"));
  const distinctDays=new Set(paired.map(e=>e.tradeDate)).size;
  const ready=paired.length>=TOP5_REPLAY_MIN_CASES&&distinctDays>=TOP5_REPLAY_MIN_DAYS;
  const horizons=TOP5_REPLAY_HORIZONS.map(horizon=>{
    const completed=paired.map(e=>e.outcomes.find(o=>o.horizon===horizon).netPnl100);
    const won=completed.filter(x=>x>0).length;
    return {horizon,paired:completed.length,days:distinctDays,wins:won,
      ready,avgNetYen100:ready?average(completed):null,
      medianNetYen100:ready?median(completed):null,
      positiveRate:ready?rate(won,completed.length):null,
      target7000Rate:ready?rate(completed.filter(x=>x>=7000).length,completed.length):null,
      loss10000Count:ready?completed.filter(x=>x<=-10000).length:null};
  });
  return {version:TOP5_REPLAY_VERSION,budgetYen,shares,
    description:"Audited-subset retrospective replay; NOT the originally published ranking",
    status:ready?"REPLAY_SAMPLE_READY":"INSUFFICIENT_REPLAY_EVIDENCE",
    archiveDays:seenDates.size,noAuditedRank,noPriorPrice,overBudget,missingEntry,
    eligibleSelections:entries.length,pairedCount:paired.length,distinctDays,
    incompleteSelections:entries.length-paired.length,horizons,
    recent:entries.slice(-12).reverse().map(e=>({tradeDate:e.tradeDate,
      code:e.code,name:e.name,rank:e.originalRank,
      priorReferenceYen:e.referencePrice,entryYen:e.entryPrice,
      status:e.outcomes.every(o=>o.status==="OBSERVED")?"COMPLETE":
        e.outcomes.map(o=>o.status).filter(s=>s!=="OBSERVED").join(",")}))};
}
