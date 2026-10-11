import pool from "./postgres";
import type { EmaCandle } from "./emaCrossoverBacktest.ts";
import { japanDay, planForwardSession, validForwardSession } from "./emaForwardShadowCore.ts";
import type { ForwardTrade } from "./emaForwardShadowCore.ts";

export type ForwardFetch = { code:string; candles:EmaCandle[]; splitEvents:number[] };
export async function getForwardCandles(code:string):Promise<ForwardFetch>{
 if(!/^[0-9]{4}$/.test(code))throw Error("INVALID_STOCK_CODE");
 const url="https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(code+".T")+"?range=2y&interval=1d&events=splits";
 const response=await fetch(url,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error("PRICE_PROVIDER_STATUS_"+response.status);
 const payload=await response.json();
 const result=payload?.chart?.result?.[0];
 const rawTime:unknown[]=result?.timestamp??[];
 const quote=result?.indicators?.quote?.[0];
 if(!quote||!Array.isArray(rawTime)||rawTime.length<110)throw Error("INSUFFICIENT_PRICE_HISTORY");
 const candles:EmaCandle[]=rawTime.flatMap((value,i)=>{
  if([quote.open?.[i],quote.high?.[i],quote.low?.[i],quote.close?.[i]].some(x=>x==null))return [];
  const bar={time:Number(value),open:Number(quote.open[i]),high:Number(quote.high[i]),low:Number(quote.low[i]),close:Number(quote.close[i]),volume:Number(quote.volume?.[i]??0)};
  return Object.values(bar).every(Number.isFinite)?[bar]:[];
 }).sort((a,b)=>a.time-b.time).slice(-520);
 const splitEvents=Object.values(result?.events?.splits??{}).map((x)=>Number((x as {date?:unknown}).date)).filter((t)=>Number.isFinite(t)&&t>0);
 return {code,candles,splitEvents};
}

export async function processForwardStock(code:string,now=new Date(),loader=getForwardCandles){
 const data=await loader(code);
 const last=data.candles.at(-1);
 // Missing daily close, weekends, holidays and pre-close calls NEVER create observations.
 if(!validForwardSession(now,last))return {code,status:"SKIPPED",reason:"NO_FRESH_CLOSED_BAR",actions:0};
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  await client.query("INSERT INTO ema_forward_shadow_state(code) VALUES($1) ON CONFLICT(code) DO NOTHING",[code]);
  const stateRow=await client.query("SELECT last_bar_time,halted FROM ema_forward_shadow_state WHERE code=$1 FOR UPDATE",[code]);
  const state=stateRow.rows[0] as {last_bar_time:string|null;halted:boolean};
  const open=await client.query(
   "SELECT id,code,strategy,status,signal_time,signal_close,entry_time,entry_price,exit_queued_reason,exit_queued_time FROM ema_forward_shadow_trades WHERE code=$1 AND status IN ('PENDING','OPEN') ORDER BY id FOR UPDATE",[code]);
  const plan=planForwardSession({
   code,candles:data.candles,splitEvents:data.splitEvents,lastSeen:state.last_bar_time===null?null:Number(state.last_bar_time),
   halted:state.halted,now,trades:open.rows.map(row=>({
    ...row,id:Number(row.id),signal_time:Number(row.signal_time),signal_close:Number(row.signal_close),
    entry_time:row.entry_time===null?null:Number(row.entry_time),entry_price:row.entry_price===null?null:Number(row.entry_price),
    exit_queued_time:row.exit_queued_time===null?null:Number(row.exit_queued_time),
   })) as ForwardTrade[],
  });
  if(plan.kind==="HALT"){
   await client.query("UPDATE ema_forward_shadow_state SET halted=true,halt_reason=$2,updated_at=NOW() WHERE code=$1",[code,plan.reason]);
   await client.query("UPDATE ema_forward_shadow_trades SET status='HALTED',updated_at=NOW() WHERE code=$1 AND status IN ('PENDING','OPEN')",[code]);
   await client.query("COMMIT");
   return {code,status:"HALTED",reason:plan.reason,actions:0};
  }
  if(plan.kind==="SKIP"){
   await client.query("COMMIT");
   return {code,status:"SKIPPED",reason:plan.reason,actions:0};
  }
  for(const action of plan.actions){
   if(action.kind==="ENTRY"){
    await client.query("UPDATE ema_forward_shadow_trades SET status='OPEN',entry_time=$2,entry_price=$3,updated_at=NOW() WHERE id=$1 AND status='PENDING'",[action.id,action.time,action.price]);
   }else if(action.kind==="QUEUE"){
    await client.query("UPDATE ema_forward_shadow_trades SET exit_queued_reason=$2,exit_queued_time=$3,updated_at=NOW() WHERE id=$1 AND status='OPEN'",[action.id,action.reason,action.time]);
   }else if(action.kind==="CLOSE"){
    await client.query(
     "UPDATE ema_forward_shadow_trades SET status='CLOSED',exit_time=$2,exit_price=$3,exit_reason=$4,gross_pnl_yen=$5,friction_yen=$6,net_pnl_yen=$7,return_percent=$8,updated_at=NOW() WHERE id=$1 AND status='OPEN'",
     [action.id,action.time,action.price,action.reason,action.gross,action.cost,action.net,action.returnPct]);
   }else{
    await client.query(
     "INSERT INTO ema_forward_shadow_trades(code,strategy,signal_time,signal_close,status) VALUES($1,$2,$3,$4,'PENDING') ON CONFLICT ON CONSTRAINT ema_forward_signal_unique DO NOTHING",
     [code,action.strategy,action.signalTime,action.signalClose]);
   }
  }
  await client.query("UPDATE ema_forward_shadow_state SET last_bar_time=$2,updated_at=NOW() WHERE code=$1",[code,plan.lastTime]);
  await client.query("COMMIT");
  return {code,status:"PROCESSED",reason:null,actions:plan.actions.length,date:japanDay(now)};
 }catch(error){
  await client.query("ROLLBACK");
  throw error;
 }finally{client.release();}
}
