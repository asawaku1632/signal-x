/** Offline BB_CANDLE_V1 replay of existing privately captured J-Quants records.
 * No network, secrets, writes, orders, notifications or licensed data in output.
 * J-Quants stored minute Time is interpreted as minute START; signal bar closes
 * at the bucket end. This is NOT proof prices were accessible in real time.
 */
import { reconcileCapturedTradeDay } from "./fourPatternJQuantsBridge.mjs";
import { detectBbCandleV1 } from "./bbCandleV1.mjs";
import { assertContinuousTseSessions } from "./fourPatternTradingDayForward.mjs";

export const BB_CANDLE_REPLAY_VERSION="BB_CANDLE_REPLAY_V1";
export const ENTRY_SLOTS=Object.freeze(["09:20","11:20","14:15"]);
const hhmm=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const utc=(date,m)=>Date.parse(date+"T"+hhmm(m)+":00+09:00")/1000;
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function bucket(minute){
  if(minute===690) return 685; // 11:30 closing auction
  if(minute===930) return 925; // 15:30 closing auction
  if(minute>=540&&minute<690)return 540+5*Math.floor((minute-540)/5);
  if(minute>=750&&minute<930)return 750+5*Math.floor((minute-750)/5);
  throw Error("INVALID_SESSION_MINUTE");
}
export function fiveMinuteFromReconciled(days){
  const bars=[];
  for(const day of days){
    if(!day.dailyMatched||!Array.isArray(day.minutes))throw Error("UNRECONCILED");
    const grouped=new Map();
    for(const x of day.minutes){
      const slot=bucket(x.minute);
      let b=grouped.get(slot);
      if(!b){
        b={time:utc(day.date,slot+5),date:day.date,slot:hhmm(slot),
          open:x.open,high:x.high,low:x.low,close:x.close,volume:x.volume};
        grouped.set(slot,b);
      }else{
        b.high=Math.max(b.high,x.high);
        b.low=Math.min(b.low,x.low);
        b.close=x.close;
        b.volume+=x.volume;
      }
    }
    bars.push(...grouped.values());
  }
  return bars;
}
const isCompleteDay=bars=>{
  // A missing no-trade minute is acceptable INSIDE a 5m bucket, but a missing
  // 5m bucket prevents a trustworthy timed risk comparison.
  const slots=new Set(bars.map(x=>x.slot));
  for(const [start,end] of [[540,685],[750,925]]){
    for(let m=start;m<=end;m+=5)if(!slots.has(hhmm(m)))return false;
  }
  return true;
};
const pct=(sell,buy)=>100*(sell/buy-1);
const summary=rows=>{
  if(rows.length<30)return {n:rows.length,meanNetPct:null,winRatePct:null,avgPnlYen100:null,avgAdversePct:null,
    evidence:"INSUFFICIENT_UNIQUE_EVENTS"};
  return {n:rows.length,meanNetPct:mean(rows.map(x=>x.netPct)),winRatePct:100*rows.filter(x=>x.pnl100>0).length/rows.length,
    avgPnlYen100:mean(rows.map(x=>x.pnl100)),avgAdversePct:mean(rows.filter(x=>x.adversePct!==null).map(x=>x.adversePct)),
    evidence:"RETROSPECTIVE_ONLY"};
};
export function replayBbCandleArchives(archives){
  if(!Array.isArray(archives)||archives.length===0||archives.length>30)throw Error("INVALID_ARCHIVE_COUNT");
  const items=[];
  const seenCodes=new Set();
  for(const archive of archives){
    const code=archive?.code;
    if(!/^[0-9]{3}[0-9A-Z]$/.test(code)||seenCodes.has(code))throw Error("INVALID_DUPLICATE_CODE");
    seenCodes.add(code);
    if(!Array.isArray(archive.minuteDays)||!Array.isArray(archive.dailyDays)||
       archive.minuteDays.length!==archive.dailyDays.length||archive.minuteDays.length<2)
      throw Error("INCOMPLETE_ARCHIVE_DAYS");
    const days=archive.minuteDays.map((m,i)=>{
      const d=archive.dailyDays[i];
      if(!m||!d||m.date!==d.date||(i&&m.date<=archive.minuteDays[i-1].date))
        throw Error("INVALID_DATE_COHORT");
      return reconcileCapturedTradeDay({code,date:m.date,minutePages:m.pages,dailyPages:d.pages});
    });
    assertContinuousTseSessions(days);
    const signature=days.map(d=>d.date).join(",");
    if(items.length && signature!==items[0].signature)throw Error("MISMATCHED_COHORT_DATES");
    const bars=fiveMinuteFromReconciled(days);
    const perDay=new Map(days.map(day=>[day.date,bars.filter(x=>x.date===day.date)]));
    const hits=detectBbCandleV1(bars);
    items.push({code,signature,bars,days,perDay,hits});
  }
  const rows=[];
  for(const item of items){
    const byDate=new Map(item.days.map((d,i)=>[d.date,i]));
    const seen=new Set();
    for(const h of item.hits){
      const b=item.bars[h.index], intermediate=item.bars[h.index+1], next=item.bars[h.index+2];
      const closeSlot=hhmm(Number(b.slot.slice(0,2))*60+Number(b.slot.slice(3))+10);
      if(!ENTRY_SLOTS.includes(closeSlot))continue;
      const dayBars=item.perDay.get(b.date);
      if(!isCompleteDay(dayBars))continue;
      // 5-minute buffer: signal is frozen at 09:15 before the 09:20 entry OPEN.
      // The intermediate bar may not influence selection; both bars must exist.
      if(!intermediate||!next||next.date!==b.date||
         intermediate.date!==b.date||intermediate.time!==b.time+300||
         next.time!==b.time+600)continue;
      // One event per code/date/slot; multiple pattern labels remain attached.
      const key=b.date+"|"+closeSlot;
      if(seen.has(key))continue;
      seen.add(key);
      const related=[...new Set(item.hits.filter(x=>x.index===h.index).map(x=>x.type))];
      const buy=next.open*1.001;
      const close=dayBars.at(-1).close*.999;
      const riskBars=dayBars.filter(x=>x.time>=next.time);
      const worstLow=Math.min(...riskBars.map(x=>x.low));
      const sessionIndex=byDate.get(b.date);
      const dayReturns={};
      for(const horizon of [1,3,5]){
        const exitDay=item.days[sessionIndex+horizon];
        dayReturns[horizon]=exitDay ? pct(exitDay.minutes.at(-1).close*.999,buy) : null;
      }
      rows.push({code:item.code,date:b.date,slot:closeSlot,patterns:related,
        direction:h.direction,netPct:h.direction==="BUY"?pct(close,buy):pct(buy,close),
        pnl100:h.direction==="BUY"?(close-buy)*100:(buy-close)*100,
        adversePct:h.direction==="BUY"?pct(worstLow,buy):null,
        return1dPct:dayReturns[1],return3dPct:dayReturns[3],return5dPct:dayReturns[5]});
    }
  }
  const groups=Object.fromEntries(ENTRY_SLOTS.map(slot=>[slot,summary(rows.filter(r=>r.slot===slot&&r.direction==="BUY"))]));
  const dayHorizonSummaries=Object.fromEntries(ENTRY_SLOTS.map(slot=>[slot,Object.fromEntries([1,3,5].map(h=>{
    const subset=rows.filter(r=>r.slot===slot&&r.direction==="BUY"&&r["return"+h+"dPct"]!==null);
    const values=subset.map(r=>r["return"+h+"dPct"]);
    return [h,{n:values.length,meanNetPct:values.length>=30?mean(values):null,
      winRatePct:values.length>=30?100*values.filter(v=>v>0).length/values.length:null}];
  }))]));
  const byPattern=Object.fromEntries(["MARUBOZU","PIN_BAR","ENGULFING","DOJI_BREAK"].map(type=>[type,summary(rows.filter(r=>r.direction==="BUY"&&r.patterns.includes(type)))]));
  return {version:BB_CANDLE_REPLAY_VERSION,status:"HISTORICAL_LOCAL_SHADOW_ONLY",stockCount:items.length,
    tradingDates:items[0].days.length,uniqueEvents:rows.length,groups,byPattern,dayHorizonSummaries,
    measuredDayHorizonCounts:Object.fromEntries([1,3,5].map(h=>[h,rows.filter(x=>x["return"+h+"dPct"]!==null).length])),
    historicalDataNotLive:true,eligibleForProduction:false,eligibleForNotifications:false,
    note:"Day-horizon prices are retrospective scenario references, not real-time trade outcomes; no rates published without 30 independent mature events."};
}
