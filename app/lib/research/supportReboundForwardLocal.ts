import type { ReboundCandle } from "../supportReboundResearch.ts";
import { scoreHintAtClose, REBOUND_SCORE_VERSION } from "./supportReboundRiskScore.ts";
import type { RiskBand } from "./supportReboundRiskScore.ts";

/**
 * Local, owner-opt-in, forward audit PREPARATION.
 * Starts at the latest completed bar with no historical backfill.
 * Scores freeze when a new, latest-bar hint appears; revisit + reload
 * later to evaluate. No unattended polling, server storage or cron.
 */
export const REBOUND_LOCAL_FORWARD_VERSION="REBOUND_FORWARD_LOCAL_V1";
export const REBOUND_LOCAL_STORAGE_KEY="signalx_rebound_forward_local_v1";
export type ForwardStatus="PENDING"|"OPEN"|"CLOSED"|"REVIEW";
export type FrozenReboundHint={
  code:string;signalTime:number;signalClose:number;
  scoreVersion:string;score:number|null;band:RiskBand|null;
  status:ForwardStatus;entryTime:number|null;entryPrice:number|null;
  exitTime:number|null;exitPrice:number|null;returnPercent:number|null;
  reason:string|null;
};
export type ForwardLocalStore={
  version:string;enabled:boolean;
  baselineByCode:Record<string,number>;
  signals:FrozenReboundHint[];
};
export type ForwardInput={code:string;candles:ReboundCandle[];splitEvents?:number[]};
const round=(n:number)=>Number(n.toFixed(2));
const validCode=(code:string)=>/^[0-9]{4}$/.test(code);
const validBar=(bar:ReboundCandle)=>Number.isFinite(bar.time)&&[bar.open,bar.high,bar.low,bar.close].every(v=>Number.isFinite(v)&&v>0)&&
  bar.low<=Math.min(bar.open,bar.close)&&bar.high>=Math.max(bar.open,bar.close);
export function supportHintAtClose(bars:ReboundCandle[],i:number):boolean {
  if(i<20||i>=bars.length||!bars.slice(i-20,i+1).every(validBar))return false;
  if(!(bars[i-3].close>bars[i-2].close&&bars[i-2].close>bars[i-1].close))return false;
  const support=Math.min(...bars.slice(i-20,i).map(x=>x.low));
  const range=bars[i].high-bars[i].low;
  return range>0&&bars[i].close>bars[i].open&&(bars[i].close-bars[i].open)/range<=0.5&&
    bars[i].low>=support*0.98&&bars[i].low<=support*1.02&&bars[i].close>=support*0.99;
}
export function beginReboundForward(inputs:ForwardInput[]):ForwardLocalStore{
  const baselineByCode:Record<string,number>={};
  for(const item of inputs){
    if(!validCode(item.code))continue;
    const last=item.candles.at(-1);
    if(last&&validBar(last))baselineByCode[item.code]=last.time;
  }
  return {version:REBOUND_LOCAL_FORWARD_VERSION,enabled:true,baselineByCode,signals:[]};
}
export function reconcileReboundForward(store:ForwardLocalStore,inputs:ForwardInput[]):ForwardLocalStore{
  if(store.version!==REBOUND_LOCAL_FORWARD_VERSION||!store.enabled)return store;
  const snapshots=store.signals.map(x=>({...x}));
  const seen=new Set(snapshots.map(x=>x.code+":"+x.signalTime));
  const baseline={...store.baselineByCode};
  for(const {code,candles,splitEvents=[]} of inputs){
    if(!validCode(code)||candles.length<60)continue;
    const last=candles.at(-1);
    if(!last||!validBar(last)||candles.some((bar,i)=>i>0&&bar.time<=candles[i-1].time))continue;
    for(const frozen of snapshots.filter(x=>x.code===code&&x.status!=="CLOSED"&&x.status!=="REVIEW")){
      const idx=candles.findIndex(c=>c.time===frozen.signalTime);
      if(idx<0){frozen.status="REVIEW";frozen.reason="SIGNAL_HISTORY_MISSING";continue;}
      if(!validBar(candles[idx])||Math.abs(candles[idx].close-frozen.signalClose)>Math.max(0.01,frozen.signalClose*0.000001)){
        frozen.status="REVIEW";frozen.reason="SOURCE_PRICE_REVISED";continue;
      }
      const finish=idx+6;
      const relevantEnd=Math.min(finish,candles.length-1);
      if(splitEvents.some(t=>t>frozen.signalTime&&t<=candles[relevantEnd].time)){
        frozen.status="REVIEW";frozen.reason="SPLIT_DURING_FORWARD";continue;
      }
      if(idx+1>=candles.length)continue;
      const entry=candles[idx+1];
      if(!validBar(entry)){frozen.status="REVIEW";frozen.reason="ENTRY_PRICE_INVALID";continue;}
      if(frozen.entryPrice!==null&&
        Math.abs(frozen.entryPrice-entry.open)>Math.max(0.01,frozen.entryPrice*0.000001)){
        frozen.status="REVIEW";frozen.reason="ENTRY_PRICE_REVISED";continue;
      }
      frozen.entryTime=entry.time;frozen.entryPrice=entry.open;frozen.status="OPEN";
      if(finish>=candles.length)continue;
      const exit=candles[finish];
      if(!validBar(exit)){frozen.status="REVIEW";frozen.reason="EXIT_PRICE_INVALID";continue;}
      frozen.exitTime=exit.time;frozen.exitPrice=exit.open;
      frozen.returnPercent=round(100*(exit.open/entry.open-1));
      frozen.status="CLOSED";
    }
    const previous=baseline[code];
    if(previous===undefined){baseline[code]=last.time;continue;}
    // Only latest newly-seen closed bar is eligible. Do not backfill already observed outcomes.
    if(last.time>previous){
      const i=candles.length-1;
      if(supportHintAtClose(candles,i) &&
        !splitEvents.some(t=>t>=candles[i-59].time&&t<=last.time)){
        const key=code+":"+last.time;
        if(!seen.has(key)){
          const signal=scoreHintAtClose(candles,i,splitEvents);
          snapshots.push({
            code,signalTime:last.time,signalClose:last.close,
            scoreVersion:REBOUND_SCORE_VERSION,score:signal.score,band:signal.band,
            status:"PENDING",entryTime:null,entryPrice:null,exitTime:null,exitPrice:null,
            returnPercent:null,reason:null,
          });
          seen.add(key);
        }
      }
      baseline[code]=last.time;
    }
  }
  return {version:store.version,enabled:true,baselineByCode:baseline,signals:snapshots.slice(-1000)};
}
export function readForwardLocal(raw:string|null):ForwardLocalStore|null{
  if(!raw||raw.length>400000)return null;
  try{
    const parsed:unknown=JSON.parse(raw);
    if(!parsed||typeof parsed!=="object")return null;
    const x=parsed as ForwardLocalStore;
    if(x.version!==REBOUND_LOCAL_FORWARD_VERSION||x.enabled!==true||!x.baselineByCode||
      typeof x.baselineByCode!=="object"||!Array.isArray(x.signals)||x.signals.length>1000)return null;
    if(Object.entries(x.baselineByCode).some(([code,t])=>!validCode(code)||!Number.isFinite(t)))return null;
    if(x.signals.some(s=>!s||!validCode(s.code)||!Number.isFinite(s.signalTime)||
      !Number.isFinite(s.signalClose)||s.signalClose<=0||
      s.scoreVersion!==REBOUND_SCORE_VERSION||
      (s.score!==null&&(!Number.isFinite(s.score)||s.score<0||s.score>100))||
      !["PENDING","OPEN","CLOSED","REVIEW"].includes(s.status)))return null;
    return x;
  }catch{return null;}
}
