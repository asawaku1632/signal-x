import { analyzeEmaCrossovers } from "./emaCrossoverBacktest.ts";
import type { EmaCandle } from "./emaCrossoverBacktest.ts";
import { bollingerEntryAllowed } from "./emaSignalComparison.ts";
import { regimeAtBuySignal, studyEmaStock } from "./emaRegimeResearch.ts";

export const FORWARD_STRATEGIES = ["TAKE","TIME"] as const;
export type ForwardStrategy = typeof FORWARD_STRATEGIES[number];
export type ForwardTrade = {
 id:number;code:string;strategy:ForwardStrategy;status:"PENDING"|"OPEN"|"CLOSED"|"HALTED";
 signal_time:number;signal_close:number;entry_time:number|null;entry_price:number|null;
 exit_queued_reason:"EMA"|"TIME"|null;exit_queued_time:number|null;
};
export type ForwardAction =
 | {kind:"ENTRY";id:number;time:number;price:number}
 | {kind:"CLOSE";id:number;time:number;price:number;reason:"EMA"|"TAKE"|"TIME";gross:number;cost:number;net:number;returnPct:number}
 | {kind:"QUEUE";id:number;reason:"EMA"|"TIME";time:number}
 | {kind:"NEW";strategy:ForwardStrategy;signalTime:number;signalClose:number};
export type ForwardPlan={kind:"SKIP"|"PROCESS"|"HALT";reason:string|null;lastTime:number|null;actions:ForwardAction[]};
export const FORWARD_COST_PER_SIDE=0.0015;
export const FORWARD_MAX_HOLD_BARS=20;
const round=(n:number)=>Number(n.toFixed(2));
const jstDay=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"});
const jstClock=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",hour12:false});
export const japanDay=(d:Date)=>jstDay.format(d);
export function validForwardSession(now:Date,last:EmaCandle|undefined){
 return !!last && jstClock.format(now)>="16:15" && japanDay(now)===japanDay(new Date(last.time*1000));
}
function goodBar(c:EmaCandle){return Number.isFinite(c.time)&&Number.isFinite(c.open)&&Number.isFinite(c.close)&&Number.isFinite(c.high)&&Number.isFinite(c.low)&&c.low>0&&c.low<=Math.min(c.open,c.close)&&c.high>=Math.max(c.open,c.close)&&c.high>=c.low;}
export function planForwardSession(input:{
 code:string;candles:EmaCandle[];splitEvents:number[];lastSeen:number|null;halted:boolean;trades:ForwardTrade[];now:Date;
}):ForwardPlan{
 const {code,candles,splitEvents,lastSeen,halted,trades,now}=input;
 const latest=candles.at(-1);
 if(halted)return {kind:"SKIP",reason:"PREVIOUSLY_HALTED",lastTime:lastSeen,actions:[]};
 if(!validForwardSession(now,latest))return {kind:"SKIP",reason:"NO_FRESH_CONFIRMED_DAILY_BAR",lastTime:lastSeen,actions:[]};
 if(!latest||(lastSeen!==null&&latest.time<=lastSeen))return {kind:"SKIP",reason:"ALREADY_PROCESSED",lastTime:lastSeen,actions:[]};
 const idx=candles.length-1;
 const prev=lastSeen===null?-1:candles.findIndex(c=>c.time===lastSeen);
 if(lastSeen!==null&&prev!==idx-1)return {kind:"HALT",reason:"MISSED_TRADING_SESSION",lastTime:lastSeen,actions:[]};
 if(candles.some((c,i)=>!goodBar(c)||(i>0&&c.time<=candles[i-1].time)))return {kind:"HALT",reason:"INVALID_OHLC",lastTime:lastSeen,actions:[]};
 const quality=studyEmaStock({code,candles,splitEvents});
 if(quality.reason)return {kind:"HALT",reason:quality.reason,lastTime:lastSeen,actions:[]};

 const signals=analyzeEmaCrossovers(candles).signals;
 const today=signals.find(s=>s.index===idx);
 const actions:ForwardAction[]=[];
 const occupied=new Set<ForwardStrategy>();
 const close=(id:number,entry:number,price:number,reason:"EMA"|"TAKE"|"TIME")=>{
  const gross=round((price-entry)*100);
  const cost=round((entry+price)*100*FORWARD_COST_PER_SIDE);
  actions.push({kind:"CLOSE",id,time:latest.time,price,reason,gross,cost,net:round(gross-cost),returnPct:round(100*(gross-cost)/(entry*100))});
 };
 for(const row of trades){
  if(row.status!=="OPEN"&&row.status!=="PENDING")continue;
  occupied.add(row.strategy);
  if(row.status==="PENDING"){
   if(prev<0||row.signal_time!==candles[prev].time)return {kind:"HALT",reason:"STALE_PENDING_ENTRY",lastTime:lastSeen,actions:[]};
   actions.push({kind:"ENTRY",id:row.id,time:latest.time,price:latest.open});
   const target=latest.open*1.15;
   if(row.strategy==="TAKE"&&latest.high>=target){
    close(row.id,latest.open,Math.max(latest.open,target),"TAKE");occupied.delete(row.strategy);
   }else if(today?.kind==="SELL")actions.push({kind:"QUEUE",id:row.id,reason:"EMA",time:latest.time});
   continue;
  }
  if(row.entry_time===null||row.entry_price===null||row.entry_price<=0)return {kind:"HALT",reason:"INVALID_POSITION",lastTime:lastSeen,actions:[]};
  const entryIndex=candles.findIndex(x=>x.time===row.entry_time);
  if(entryIndex<0)return {kind:"HALT",reason:"ENTRY_OUT_OF_RANGE",lastTime:lastSeen,actions:[]};
  let price:number|null=null,reason:"EMA"|"TAKE"|"TIME"|null=null;
  if(row.exit_queued_reason){price=latest.open;reason=row.exit_queued_reason;}
  else if(row.strategy==="TIME"&&idx-entryIndex>=FORWARD_MAX_HOLD_BARS){price=latest.open;reason="TIME";}
  else if(row.strategy==="TAKE"&&latest.high>=row.entry_price*1.15){price=Math.max(latest.open,row.entry_price*1.15);reason="TAKE";}
  if(price!==null&&reason){close(row.id,row.entry_price,price,reason);occupied.delete(row.strategy);}
  else if(today?.kind==="SELL")actions.push({kind:"QUEUE",id:row.id,reason:"EMA",time:latest.time});
  else if(row.strategy==="TIME"&&idx-entryIndex===FORWARD_MAX_HOLD_BARS-1)actions.push({kind:"QUEUE",id:row.id,reason:"TIME",time:latest.time});
 }
 if(today?.kind==="BUY"&&bollingerEntryAllowed(candles,idx)&&regimeAtBuySignal(candles,idx).trend==="UP"){
  for(const strategy of FORWARD_STRATEGIES)if(!occupied.has(strategy))actions.push({kind:"NEW",strategy,signalTime:latest.time,signalClose:latest.close});
 }
 return {kind:"PROCESS",reason:null,lastTime:latest.time,actions};
}
