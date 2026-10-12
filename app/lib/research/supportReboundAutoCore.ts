import type { ReboundCandle } from "../supportReboundResearch.ts";
import { isTseTradingDate } from "../technicalObservation/tseMarketCalendar.ts";
import { scoreHintAtClose, REBOUND_SCORE_VERSION } from "./supportReboundRiskScore.ts";
import { supportHintAtClose } from "./supportReboundForwardLocal.ts";

export const REBOUND_AUTO_VERSION="REBOUND_FORWARD_AUTO_V1";
export const REBOUND_AUTO_STOCKS_PER_BATCH=50;
export const REBOUND_AUTO_REQUEST_LIMIT_PER_DAY=100;
export const REBOUND_AUTO_SCHEDULES=["45 7 * * 1-5","5 8 * * 1-5"] as const; // UTC -> JST 16:45,17:05
const tokyoParts=(now:Date)=>{
  const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const get=(name:string)=>p.find(x=>x.type===name)?.value??"";
  return {date:get("year")+"-"+get("month")+"-"+get("day"),minutes:Number(get("hour"))*60+Number(get("minute"))};
};
export function japanDate(time:number){
  if(!Number.isFinite(time)||time<=0)return "INVALID";
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(time*1000));
  const get=(name:string)=>p.find(x=>x.type===name)?.value??"";
  return get("year")+"-"+get("month")+"-"+get("day");
}
export function reboundAutoPreflight(now:Date){
  if(!Number.isFinite(now.getTime()))return {ok:false as const,reason:"INVALID_TIME",date:"INVALID"};
  const {date,minutes}=tokyoParts(now);
  try {
    if(!isTseTradingDate(date))return {ok:false as const,reason:"MARKET_CLOSED",date};
  }catch {return {ok:false as const,reason:"CALENDAR_UNAVAILABLE",date};}
  if(minutes<16*60+40||minutes>=21*60)return {ok:false as const,reason:"OUTSIDE_CLOSED_MARKET_WINDOW",date};
  return {ok:true as const,date};
}
export function shouldRunReboundOnHost(host:string,environment:string|undefined){
  return environment==="production"&&host.toLowerCase()==="signal-x-ppjg.vercel.app";
}
function validBar(c:ReboundCandle){
  return Number.isFinite(c.time)&&c.time>0&&
    [c.open,c.high,c.low,c.close,c.volume].every(x=>Number.isFinite(x))&&
    Math.min(c.open,c.high,c.low,c.close)>0&&c.volume>=0&&
    c.low<=Math.min(c.open,c.close)&&c.high>=Math.max(c.open,c.close);
}
export function validReboundDailyInput(candles:ReboundCandle[]){
  return candles.length>=70&&candles.every((c,i)=>validBar(c)&&(i===0||c.time>candles[i-1].time));
}
export type StoredForwardSignal={
  id:number;signalTime:number;signalClose:number;scoreVersion:string;
  state:"PENDING"|"OPEN"|"REVIEW"|"CLOSED";entryTime:number|null;entryPrice:number|null;
};
export type ForwardProgress={
  id:number;state:"PENDING"|"OPEN"|"CLOSED"|"REVIEW";reason:string|null;
  entryTime:number|null;entryPrice:number|null;exitTime:number|null;exitPrice:number|null;
  returnPercent:number|null;worstIntratradePercent:number|null;
};
const round=(n:number)=>Number(n.toFixed(4));
const nearlyEqual=(a:number,b:number)=>Math.abs(a-b)<=Math.max(0.01,Math.abs(b)*0.000001);
export function progressFrozenRebound(signal:StoredForwardSignal,candles:ReboundCandle[],splits:number[]):ForwardProgress{
  const output:ForwardProgress={id:signal.id,state:signal.state==="OPEN"?"OPEN":"PENDING",
    reason:null,entryTime:signal.entryTime,entryPrice:signal.entryPrice,
    exitTime:null,exitPrice:null,returnPercent:null,worstIntratradePercent:null};
  const fail=(reason:string):ForwardProgress=>({...output,state:"REVIEW",reason});
  if(signal.scoreVersion!==REBOUND_SCORE_VERSION)return fail("SCORE_VERSION_CHANGED");
  if(!validReboundDailyInput(candles))return fail("BAD_CANDLE_DATA");
  const index=candles.findIndex(c=>c.time===signal.signalTime);
  if(index<0)return fail("SIGNAL_BAR_MISSING");
  if(!nearlyEqual(candles[index].close,signal.signalClose))return fail("SIGNAL_CLOSE_REVISED");
  const exitIndex=index+6; // next open entry + 5 trading sessions later exit, same as historical study
  const lookEnd=Math.min(exitIndex,candles.length-1);
  if(splits.some(t=>t>signal.signalTime&&t<=candles[lookEnd].time))return fail("FORWARD_SPLIT");
  if(index+1>=candles.length)return output;
  const entry=candles[index+1];
  if(signal.entryPrice!==null&&!nearlyEqual(entry.open,signal.entryPrice))return fail("ENTRY_OPEN_REVISED");
  output.state="OPEN";output.entryPrice=signal.entryPrice??entry.open;output.entryTime=signal.entryTime??entry.time;
  if(output.entryTime!==entry.time)return fail("ENTRY_TIME_REVISED");
  if(exitIndex>=candles.length)return output;
  const exit=candles[exitIndex];
  if(!(exit.open>0))return fail("EXIT_OPEN_INVALID");
  const worst=Math.min(...candles.slice(index+1,exitIndex).map(c=>c.low));
  return {...output,state:"CLOSED",exitTime:exit.time,exitPrice:exit.open,
    returnPercent:round(100*(exit.open/output.entryPrice-1)),
    worstIntratradePercent:round(100*(worst/output.entryPrice-1))};
}
export function todayReboundCandidate(candles:ReboundCandle[],splits:number[],expectedDate:string){
  if(!validReboundDailyInput(candles))return null;
  const i=candles.length-1,last=candles[i];
  if(japanDate(last.time)!==expectedDate)return null;
  // Same 5-session cluster de-duplication as historical detector.
  if(!supportHintAtClose(candles,i)||[1,2,3,4].some(offset=>supportHintAtClose(candles,i-offset)))return null;
  if(splits.some(t=>t>=candles[i-59].time&&t<=last.time))return null;
  const score=scoreHintAtClose(candles,i,splits);
  return {signalTime:last.time,signalClose:last.close,
    scoreVersion:REBOUND_SCORE_VERSION,score:score.score,band:score.band,features:score.features};
}
