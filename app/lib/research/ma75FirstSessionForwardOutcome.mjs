/**
 * SHADOW_NOT_APPROVED: descriptive, retrospective first-session entry-open
 * to same-session close evaluation for the immutable 2026-11-02 MA75 cohort.
 * Uses only a separately completed 2026-11-04 original J-Quants V2 day.
 * Does not claim as-of tradability, provider authenticity, broker fill, signal
 * quality, or independent forward validation. No I/O, API, trading or alerts.
 */
import {verifyMa75FirstDayResearchFreeze} from './ma75FirstDayResearchFreeze.mjs';
export const FIRST_SESSION_FORWARD_VERSION='ma75_first_session_forward_observation_v1';
const FIRST='2026-11-04', SIGNAL='2026-11-02';
const FRICTION=0.001;
const fail=s=>{throw new TypeError('MA75_FIRST_SESSION_'+s)};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const round=(v,d=4)=>Number(v.toFixed(d));
const empty=()=>({records:0,measured:0,pending:0,quarantined:0,
 meanReturnPercent:null,medianReturnPercent:null,positiveRatePercent:null,
 meanProfitYen100:null,minimumReturnPercent:null,maximumReturnPercent:null});
const summarize=rows=>{
 const result=empty();result.records=rows.length;
 const complete=rows.filter(x=>x.status==='HYPOTHETICAL_FIRST_SESSION_ONLY');
 result.measured=complete.length;
 result.pending=rows.filter(x=>x.status.startsWith('PENDING_')).length;
 result.quarantined=rows.filter(x=>x.status.startsWith('QUARANTINED_')).length;
 if(!complete.length)return result;
 const returns=complete.map(x=>x.return1Percent).sort((a,b)=>a-b);
 const total=returns.reduce((s,n)=>s+n,0);
 const half=Math.floor(returns.length/2);
 const profit=complete.reduce((s,x)=>s+x.profitYen100,0);
 return {...result,meanReturnPercent:round(total/returns.length),
  medianReturnPercent:returns.length%2?returns[half]:
   round((returns[half-1]+returns[half])/2),
  positiveRatePercent:round(100*returns.filter(v=>v>0).length/returns.length,2),
  meanProfitYen100:round(profit/complete.length,2),
  minimumReturnPercent:returns[0],maximumReturnPercent:returns.at(-1)};
};
const codeSetEqual=(a,b)=>a.length===b.length&&
 a.every((x,i)=>x===b[i]);

export function evaluateMa75FirstSessionForward(frozen,comparison,{
 outcomeDay=FIRST,projection=null,sourceReceiptAt=null,asOf=null
}={}){
 if(!verifyMa75FirstDayResearchFreeze(frozen)||
   frozen.firstForwardDate!==SIGNAL||
   frozen.breakoutsTotal!==27||frozen.risingBreakoutCount!==22||
   frozen.frozenPopulation!==953||
   comparison?.status!=='SHADOW_NOT_APPROVED'||
   comparison.frozenCohortSha256!==frozen.freezeSha256||
   comparison.originalAllBreakouts!==27||
   comparison.originalRisingBreakouts!==22||
   comparison.notEvaluableBreakouts!==0||
   !Array.isArray(comparison.perFrozenBreakout)||
   comparison.perFrozenBreakout.length!==27)
  fail('INVALID_PINNED_FIRST_DATE_COMPARISON');
 const originals=[...frozen.breakoutsAll].sort((a,b)=>a.code.localeCompare(b.code));
 const observed=[...comparison.perFrozenBreakout].sort((a,b)=>a.code.localeCompare(b.code));
 if(!codeSetEqual(originals.map(x=>x.code),observed.map(x=>x.code))||
   observed.some((x,i)=>x.risingMA75!==originals[i].sma75Rising||
    !['COMPOUND_SHADOW_MATCH','BASELINE_BREAKOUT_ONLY'].includes(x.classification)||
    typeof x.compoundMatched!=='boolean'||
    x.compoundMatched!==(x.classification==='COMPOUND_SHADOW_MATCH')))
  fail('ORIGINAL_BREAKOUTS_RESELECTED_OR_CHANGED');
 const compound=observed.filter(x=>x.compoundMatched).map(x=>x.code);
 if(!codeSetEqual(compound,['1878','7172','9832'])||
   compound.some(code=>!originals.find(x=>x.code===code)?.sma75Rising))
  fail('NOV2_COMPOSITE_SUBGROUP_CHANGED');
 if(outcomeDay!==FIRST)fail('FIRST_SESSION_DATE_REQUIRED');
 if(projection!==null&&(!Number.isFinite(Date.parse(asOf))||
   !Number.isFinite(Date.parse(sourceReceiptAt))||
   Date.parse(sourceReceiptAt)<Date.parse(FIRST+'T07:30:00Z')||
   Date.parse(sourceReceiptAt)>Date.parse(asOf)||
   Date.parse(asOf)<Date.parse(FIRST+'T07:30:00Z')))
  fail('UNVERIFIED_OR_IMPOSSIBLE_RECEIPT_TIME');
 let byCode=null;
 if(projection!==null){
  if(projection.date!==outcomeDay||
     projection.completeProviderPagination!==true||
     projection.audit?.failures?.length!==0||
     !Array.isArray(projection.audit?.rows)||
     projection.audit.rows.length!==953||
     projection.originalAllListedRows<953||
     projection.projectedFrozenRows<0||
     projection.projectedFrozenRows>953)
   fail('INVALID_ALL_LISTED_DATE_PROJECTION');
  byCode=new Map();
  for(const row of projection.audit.rows){
   if(typeof row?.code!=='string'||byCode.has(row.code)||
      row.tradeDate!==outcomeDay||typeof row.status!=='string')
    fail('DUPLICATED_OR_WRONG_DATE_FROZEN_ROW');
   byCode.set(row.code,row);
  }
  if(byCode.size!==953)fail('MISSING_FROZEN_UNIVERSE_ROWS');
 }
 const rows=originals.map(item=>{
  const membership=observed.find(x=>x.code===item.code);
  let status='PENDING_NOV04_ORIGINAL_CAPTURE',reason=status;
  let one=null,profit=null,mae=null,capital=null,budget=null;
  if(byCode!==null){
   const entry=byCode.get(item.code);
   if(entry.status!=='DAILY_BAR'){
    status=entry.status==='NO_TRADE'||entry.status==='MISSING_PROVIDER_ROW'?
     'PENDING_'+entry.status:'QUARANTINED_'+entry.status;
    reason=status;
   }else{
    const b=entry.bar;
    if(!b||b.tradeDate!==FIRST||b.code!==item.code||
       ![b.open,b.high,b.low,b.close,b.volume].every(finite)||
       b.open<=0||b.high<=0||b.low<=0||b.close<=0||
       b.volume<=0||b.high<Math.max(b.open,b.close,b.low)||
       b.low>Math.min(b.open,b.close,b.high)){
     status='QUARANTINED_INVALID_ORIGINAL_OHLCV';reason=status;
    }else if(b.high===b.low){
     status='QUARANTINED_FLAT_BAR_FILL_UNVERIFIED';reason=status;
    }else{
     // The signal-day closing price is NOT persisted in the original
     // hash-only freeze. Do not manufacture a close-to-next-open gap check
     // without reloading and verifying the signal-day original page.
     one=round(100*(b.close*(1-FRICTION)/(b.open*(1+FRICTION))-1));
     profit=round(100*(b.close*(1-FRICTION)-b.open*(1+FRICTION)),2);
     mae=round(100*(b.low/(b.open*(1+FRICTION))-1));
     capital=round(b.open*(1+FRICTION)*100,2);
     const minimumLots=Math.max(1,Math.ceil(100000/capital));
     const maximumLots=Math.floor(500000/capital);
     budget={eligible:maximumLots>=minimumLots,
      minLots:maximumLots>=minimumLots?minimumLots:null,
      maxLots:maximumLots>=minimumLots?maximumLots:null};
     status='HYPOTHETICAL_FIRST_SESSION_ONLY';reason=null;
    }
   }
  }
  return {
   code:item.code,signalDate:SIGNAL,outcomeDate:FIRST,
   originalBreakout:true,risingMA75:item.sma75Rising,
   compoundWickVolume:membership.compoundMatched,
   status,reason,return1Percent:one,profitYen100:profit,
   firstSessionAdverseLowPercent:mae,
   modeledEntryCostYen100:capital,modeledBudgetLots:budget,
   actualFillVerified:false,entryOpenAvailableBeforeOpenIndependentlyVerified:false,
   return3Percent:null,return5Percent:null
  };
 });
 const all=summarize(rows);
 const rising=summarize(rows.filter(r=>r.risingMA75));
 const three=summarize(rows.filter(r=>r.compoundWickVolume));
 if(all.records!==27||rising.records!==22||three.records!==3||
   all.measured+all.pending+all.quarantined!==27)
  fail('ORIGINAL_COHORT_ACCOUNTING_FAILED');
 return {
  version:FIRST_SESSION_FORWARD_VERSION,status:'SHADOW_NOT_APPROVED',
  frozenCohortSha256:frozen.freezeSha256,
  originallyCapturedSourceSha256:frozen.capturedSourceSha256,
  signalDate:SIGNAL,firstSessionDate:FIRST,
  futureSession3:'2026-11-06',futureSession5:'2026-11-10',
  originalCodesRetained:27,risingCodesRetained:22,compoundCodesRetained:3,
  prospectiveEntryFillVerified:false,sourceTimingIndependentlyVerified:false,
  outcomeSourceRightsIndependentlyVerified:false,marketCalendarIndependentlyVerified:false,
  originalNoReSelection:true,originalCohortChanged:false,
  firstDayObservedSource:projection!==null,
  // A daily bar acquired after closing cannot prove trade execution at
  // that morning's open. Derived calculations remain retrospective.
  modeledPriceMethod:'2026-11-04_OPEN_to_same_day_CLOSE_with_0.1pct_each_side',
  groups:{allBreakouts:all,risingBreakouts:rising,compoundBreakouts:three},
  byFrozenCode:rows,
  independentValidatedForwardOutcomes:0,independentlyValidatedWinRate:null,
  return3Percent:null,return5Percent:null,
  productionEligible:false,notificationsEligible:false,
  tradingEligible:false,aiPowerEligible:false,
  filesWritten:0,networkRequests:0
 };
}
