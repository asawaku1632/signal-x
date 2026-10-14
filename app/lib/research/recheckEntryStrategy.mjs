/** Read-only shadow policy: use the 10:30 cached AI snapshot, then hypothetical
 * purchase at the 11:00 five-minute OPEN; all prices compared to the SAME
 * archived closing reference. No lookahead and no trades or data writes.
 */
export const RECHECK_ENTRY_POLICY_VERSION="PRIOR_TOP5_1030_RECHECK_1100_ENTRY_V1";
export const RECHECK_AI_THRESHOLD=85;
const finitePositive=v=>{
  if(v===null||v===undefined||v==="")return null;
  const n=Number(v);return Number.isFinite(n)&&n>0?n:null;
};
const scoreValue=v=>{
  if(v===null||v===undefined||v==="")return null;
  const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=100?n:null;
};
const amount=v=>Number(v.toFixed(2));
const isSameTradeDate=(ms,date)=>{
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"
  }).format(new Date(ms));
  return parts===date;
};
const key=(date,code)=>date+"|"+code;
function validatedGate(gate,run,candidate){
  if(!gate)return "NO_RECHECK";
  if(gate.time_slot!=="10:30"||gate.prior_date!==run.prior_date||
    gate.trade_date!==run.trade_date||String(gate.code)!==String(candidate.code))
    return "COHORT_MISMATCH";
  const priorRank=Number(gate.prior_rank);
  if(priorRank!==Number(candidate.rank))return "COHORT_MISMATCH";
  const ai=scoreValue(gate.ai_power);
  if(ai===null)return "INVALID_AI_SCORE";
  const saved=Date.parse(gate.snapshot_saved_at);
  const quote=Date.parse(gate.quote_timestamp);
  const tradeOpen=Date.parse(run.trade_date+"T11:00:00+09:00");
  if(!Number.isFinite(saved)||!Number.isFinite(quote)||
    !Number.isFinite(tradeOpen)||saved>=tradeOpen||quote>saved||
    quote>tradeOpen||!isSameTradeDate(saved,run.trade_date)||
    !isSameTradeDate(quote,run.trade_date))return "GATE_NOT_BEFORE_ENTRY";
  return null;
}
function entryAt(stock,slot){
  const e=stock?.entries?.find(e=>e.time===slot);
  const price=finitePositive(e?.entryPrice);
  return price;
}
/** Only paired and auditable candidates enter aggregate comparisons:
 * - same frozen prior-day candidate, present in both archives
 * - 09:05 and 11:00 prices plus common closing reference
 * - 10:30 cached recheck from strictly before 11:00 purchase
 *
 * A missing gate is never interpreted as a skip.
 * A skipped *valid* gate holds cash (0 P&L), not a fictitious win.
 */
export function evaluateRecheckEntryStrategy(runs,gateRows){
  const gates=new Map();
  for(const row of gateRows??[]){
    if(row?.time_slot!=="10:30")continue;
    const id=key(String(row.trade_date),String(row.code));
    if(!gates.has(id))gates.set(id,row);
  }
  const analyzed=[],excluded=[];
  let candidates=0;
  for(const run of runs??[]){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(run.trade_date))||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(run.prior_date))||
      !Array.isArray(run.cohort)||!Array.isArray(run.results))continue;
    const results=new Map(run.results.map(x=>[String(x.code),x]));
    for(const candidate of run.cohort){
      const code=String(candidate.code);
      if(!/^[0-9]{4}$/.test(code))continue;
      candidates++;
      const gate=gates.get(key(run.trade_date,code));
      const rejection=validatedGate(gate,run,candidate);
      if(rejection){excluded.push({date:run.trade_date,code,reason:rejection});continue;}
      const stock=results.get(code);
      const early=entryAt(stock,"09:05"),late=entryAt(stock,"11:00");
      const close=finitePositive(stock?.closePrice);
      if(early===null||late===null||close===null){
        excluded.push({date:run.trade_date,code,reason:"MISSING_PAIR_PRICE"});
        continue;
      }
      const ai=scoreValue(gate.ai_power);
      const bought=ai>=RECHECK_AI_THRESHOLD;
      const earlyPnl=amount((close-early)*100);
      const latePnl=amount((close-late)*100);
      const gatedPnl=bought?latePnl:0;
      analyzed.push({
        date:run.trade_date,code,name:String(candidate.name??stock?.name??""),
        priorScore:Number(candidate.score),recheckScore:ai,
        decision:bought?"BUY":"SKIP",
        recheckSavedAt:gate.snapshot_saved_at,quoteAsOf:gate.quote_timestamp,
        earlyEntry:early,lateEntry:late,closePrice:close,
        earlyPnl100:earlyPnl,alwaysLatePnl100:latePnl,
        gatedPnl100:gatedPnl,missedProfit100:!bought&&latePnl>0?latePnl:0,
        avoidedLoss100:!bought&&latePnl<0?-latePnl:0,
      });
    }
  }
  const sum=(fn)=>amount(analyzed.reduce((v,r)=>v+fn(r),0));
  const bought=analyzed.filter(r=>r.decision==="BUY");
  const skipped=analyzed.filter(r=>r.decision==="SKIP");
  return {
    candidates,evaluated:analyzed.length,excluded:excluded.length,
    missingRechecks:excluded.filter(r=>r.reason==="NO_RECHECK").length,
    missingPairedPrices:excluded.filter(r=>r.reason==="MISSING_PAIR_PRICE").length,
    days:new Set(analyzed.map(r=>r.date)).size,
    buyCount:bought.length,skipCount:skipped.length,
    buyWinCount:bought.filter(r=>r.gatedPnl100>0).length,
    earlyWinCount:analyzed.filter(r=>r.earlyPnl100>0).length,
    alwaysLateWinCount:analyzed.filter(r=>r.alwaysLatePnl100>0).length,
    gateWinRate:bought.length?100*bought.filter(r=>r.gatedPnl100>0).length/bought.length:null,
    earlyWinRate:analyzed.length?100*analyzed.filter(r=>r.earlyPnl100>0).length/analyzed.length:null,
    alwaysLateWinRate:analyzed.length?100*analyzed.filter(r=>r.alwaysLatePnl100>0).length/analyzed.length:null,
    gatedTotalPnl100:sum(r=>r.gatedPnl100),
    earlyTotalPnl100:sum(r=>r.earlyPnl100),
    alwaysLateTotalPnl100:sum(r=>r.alwaysLatePnl100),
    gatedAvgPerCandidate100:analyzed.length?sum(r=>r.gatedPnl100)/analyzed.length:null,
    earlyAvgPerCandidate100:analyzed.length?sum(r=>r.earlyPnl100)/analyzed.length:null,
    alwaysLateAvgPerCandidate100:analyzed.length?sum(r=>r.alwaysLatePnl100)/analyzed.length:null,
    missedOpportunityTotal100:sum(r=>r.missedProfit100),
    avoidedLossTotal100:sum(r=>r.avoidedLoss100),
    analyzed,excluded,
  };
}
