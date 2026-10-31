/**
 * SHADOW-ONLY. Pure offline J-Quants v2 /equities/bars/minute audit.
 * No HTTP, secrets, jobs, DB writes, alert, AI POWER, or trade instructions.
 * Historical end-of-day archive != contemporaneous 09:05 feed.
 *
 * Input: {code, date, pages:[{requestPaginationKey:null|string,
 * receivedAt:ISO8601, response:{data:[{Date,Time,Code,O,H,L,C,Vo,Va}],
 * pagination_key?:string}}]}
 * Each page was ALREADY ACQUIRED for the same explicitly requested code/date.
 */
import {validateMa75FrozenUniverse} from './ma75FrozenUniverse.mjs';

export const MORNING_MINUTE_SHADOW_VERSION='morning_minute_shadow_v2';
const realDate=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&
 Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const capturedAt=s=>typeof s==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(s)?Date.parse(s):NaN;
const validNumber=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const toMinutes=t=>{
 if(typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))return null;
 const [h,m]=t.split(':').map(Number);
 return h*60+m;
};
const exchangeMinute=m=>
  (m>=540&&m<=690)||(m>=750&&m<=924)||m===930;
const normalizeCode=value=>{
 if(typeof value!=='string')return null;
 if(/^[0-9]{3}[0-9A-Z]0$/.test(value))return value.slice(0,4);
 if(/^[0-9]{3}[0-9A-Z]$/.test(value))return value;
 return null;
};
const percentage=(start,finish)=>
 Number(((finish/start-1)*100).toFixed(5));
const earliestThreshold=(later,low,pct)=>{
 const b=later.find(x=>x.high/low-1>=pct/100-1e-10);
 return b?.time??null;
};
export function auditMorningMinuteShadow(freeze,{code,date,pages}={}){
 validateMa75FrozenUniverse(freeze);
 if(!freeze.codes.includes(code)||!realDate(date)||
    !Array.isArray(pages)||pages.length===0)
   throw new TypeError('Require an existing frozen-cohort stock code, real trade date and retained response pages');
 let expected=null,finished=false,firstCapture=null,lastCapture=null,priorCapture=null;
 const tokens=new Set(),bars=[],errors=[],observedMinutes=new Set();
 for(let i=0;i<pages.length;i++){
   const p=pages[i];
   if(finished){errors.push('EXTRA_PAGE_AFTER_TERMINAL');break}
   if(!p||!Object.prototype.hasOwnProperty.call(p,'requestPaginationKey')){
     errors.push('UNKNOWN_REQUEST_PAGINATION_KEY');break;
   }
   const request=p.requestPaginationKey??null;
   const stamp=capturedAt(p.receivedAt);
   const releaseFloor=Date.parse(date+'T06:30:00Z'); // only close, NOT official release guarantee
   if(!Number.isFinite(stamp)||stamp<releaseFloor||
      (priorCapture!==null&&stamp<priorCapture)){
     errors.push('INVALID_OR_REVERSED_PAGE_RECEIPT');break;
   }
   if(request!==expected){
     errors.push('BROKEN_PAGE_CHAIN');break;
   }
   if(!p.response||!Array.isArray(p.response.data)){
     errors.push('INVALID_PAGE_RESPONSE');break;
   }
   firstCapture??=p.receivedAt;lastCapture=p.receivedAt;priorCapture=stamp;
   for(const row of p.response.data){
     const m=toMinutes(row?.Time);
     if(row?.Date!==date||normalizeCode(row?.Code)!==code||
        m===null||!exchangeMinute(m)){
       errors.push('WRONG_CODE_DATE_OR_SESSION_TIME');continue;
     }
     if(observedMinutes.has(m)){errors.push('DUPLICATE_MINUTE_BAR');continue}
     observedMinutes.add(m);
     if(![row.O,row.H,row.L,row.C,row.Vo,row.Va].every(validNumber)||
         row.H<Math.max(row.O,row.C,row.L)||
         row.L>Math.min(row.O,row.C,row.H)||
         row.Va<row.L*row.Vo*.99||
         row.Va>row.H*row.Vo*1.01){
       errors.push('INVALID_RAW_OHLCV_TURNOVER');continue;
     }
     bars.push({time:row.Time,minute:m,open:row.O,high:row.H,
       low:row.L,close:row.C,volume:row.Vo,turnover:row.Va});
   }
   const token=p.response.pagination_key;
   const next=token===undefined||token===null||token===''?null:token;
   if(next!==null&&(typeof next!=='string'||tokens.has(next)||next===request)){
      errors.push('INVALID_OR_REPEAT_PAGE_TOKEN');break;
   }
   if(next!==null)tokens.add(next);
   expected=next;
   if(next===null)finished=true;
 }
 if(!finished&&!errors.length)errors.push('INCOMPLETE_PAGE_CHAIN');
 const uniqueErrors=[...new Set(errors)];
 const valid=finished&&uniqueErrors.length===0;
 bars.sort((a,b)=>a.minute-b.minute);
 const dailyObservation=valid?{
   code,date,barCount:bars.length,
   firstTradeMinute:bars[0]?.time??null,
   lastTradeMinute:bars.at(-1)?.time??null,
   unadjusted:true,
   open:bars[0]?.open??null,
   high:bars.length?Math.max(...bars.map(b=>b.high)):null,
   low:bars.length?Math.min(...bars.map(b=>b.low)):null,
   close:bars.at(-1)?.close??null,
   volume:bars.reduce((total,b)=>total+b.volume,0),
   turnover:bars.reduce((total,b)=>total+b.turnover,0),
   independentlyVerifiedSource:false,
 } : null;
 const observedMorning=valid?bars.filter(b=>b.minute>=540&&b.minute<600):[];
 const early=observedMorning.filter(b=>b.minute<545);
 const firstTrade=observedMorning[0]??null;
 let asOf905=null,retrospective=null;
 if(valid){
   if(early.length){
     asOf905={
       assumedClockCutoffJst:'09:05',
       observedMinuteBars:early.length,
       noTradesInSomeMinutesArePossible:early.length<5,
       firstTradeAt:early[0].time,
       openingTradeAfter0900:early[0].minute>540,
       open:early[0].open,
       high:Math.max(...early.map(b=>b.high)),
       low:Math.min(...early.map(b=>b.low)),
       close:early.at(-1).close,
       volume:early.reduce((s,b)=>s+b.volume,0),
       openToClosePercent:percentage(early[0].open,early.at(-1).close),
       quoteAvailableAtActual905:false
     };
   }
   if(observedMorning.length){
     const bottom=Math.min(...observedMorning.map(b=>b.low));
     const lowest=observedMorning.find(b=>b.low===bottom);
     // Later high must occur in a strictly later minute. High/low order
     // within one OHLC minute bar is unknown, never infer same-minute profit.
     const later=observedMorning.filter(b=>b.minute>lowest.minute);
     const highestLater=later.length?Math.max(...later.map(b=>b.high)):null;
     retrospective={
       morningWindowJst:'09:00-09:59',
       firstTradeAt:firstTrade.time,
       bottomMinute:lowest.time,bottomPrice:bottom,
       barCount:observedMorning.length,
       laterMinuteCount:later.length,
       maximumLaterHigh:highestLater,
       maximumReboundPercent:highestLater===null?null:percentage(bottom,highestLater),
       subsequent1PctReachedAt:earliestThreshold(later,bottom,1),
       subsequent2PctReachedAt:earliestThreshold(later,bottom,2),
       hindsightOnly:true,barHighLowSequenceUnknown:true
     };
   }
 }
 return {
   version:MORNING_MINUTE_SHADOW_VERSION,code,date,
   originalFrozenCohortSize:freeze.codes.length,
   preFreezeHistoricalDate:date<freeze.firstEligibleSignalDate,
   pilotIsFullFrozenUniverse:false,
   pagesProcessed:pages.length,observedRawBars:bars.length,
   firstReceivedAt:firstCapture,lastReceivedAt:lastCapture,
   pageChainComplete:finished,structuralPass:valid,errors:uniqueErrors,
   dailyObservation,
   noTradeMinutesMustNotBeFilled:true,
   asOf905,retrospective,
   providerRightsIndependentlyVerified:false,
   minuteAddonEntitlementVerified:false,
   actual905AvailabilityVerified:false,
   acceptedLiveTradeSignals:0,
   eligibleForNotifications:false,eligibleForProduction:false,
   notes:[
     'Time is the START minute JST, not an instant quote; 09:05 minute is excluded from 09:05 hypothetical information.',
     'Minute bar omissions may represent no trades, not data corruption. A late first trade must not be invented as 09:00.',
     'The one-day minute OHLCV aggregate must be reconciled to a separate unadjusted daily provider record; structural pagination alone is insufficient.',
     'Retrospective morning bottom and rebound look forward in that morning; never use them as a feature available at 09:05.',
     'Only verified responses captured independently at or before the decision time could support a prospective 09:05 claim.',
   ]
 };
}
