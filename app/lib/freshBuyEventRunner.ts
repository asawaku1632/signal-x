import "server-only";
import pool from "@/app/lib/postgres";
import {pushWebToUser} from "@/app/lib/push/userPush";
import {evaluateFreshBuy} from "@/app/lib/freshBuyEvent.mjs";
type Bar={time:number;open:number;high:number;low:number;close:number;volume:number};
type Signal={kind:string;label:string;level:number;volumeRatio:number};
type Event={bar_time:string;reference_price:string;signals:Signal[]};
export async function captureAndNotifyFreshBuy(owner:string,stock:{code:string;name:string},bars:Bar[],tradeDate:string){
 const observation=evaluateFreshBuy(bars,Date.now(),tradeDate);
 if(observation.matched)await pool.query(`INSERT INTO public.owner_new_buy_events
  (owner_email,code,trade_date,name,bar_time,reference_price,signals,evidence)
  VALUES($1,$2,$3::date,$4,$5,$6,$7::jsonb,$8::jsonb) ON CONFLICT(owner_email,code,trade_date) DO NOTHING`,
  [owner,stock.code,tradeDate,stock.name,observation.barTime,observation.price,JSON.stringify(observation.signals),JSON.stringify({...observation,provider:"YAHOO_CHART_5M",mode:"OWNER_TRIAL"})]);
 await pool.query(`UPDATE public.owner_new_buy_events SET state='EXPIRED'
  WHERE owner_email=$1 AND code=$2 AND trade_date=$3::date AND state='PENDING'
  AND to_timestamp(bar_time+300)<now()-interval '20 minutes'`,[owner,stock.code,tradeDate]);
 const claimed=await pool.query<Event>(`UPDATE public.owner_new_buy_events SET state='CLAIMED'
  WHERE owner_email=$1 AND code=$2 AND trade_date=$3::date AND state='PENDING'
  AND to_timestamp(bar_time+300)>=now()-interval '20 minutes' RETURNING bar_time,reference_price,signals`,[owner,stock.code,tradeDate]);
 const event=claimed.rows[0];
 if(event){
  const time=new Date((Number(event.bar_time)+300)*1000).toLocaleTimeString("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit"});
  // Claim before delivery; ambiguous delivery remains claimed, preventing duplicate sends.
  const delivery=await pushWebToUser(owner,{title:"🟢 "+stock.name+" 新規の買い条件が成立",
   body:stock.code+"｜"+time+"確定の5分足。"+event.signals.map(s=>s.label).join("・")+"。参考 "+Number(event.reference_price).toLocaleString("ja-JP")+"円（本人用・試験運用）",
   url:"/admin/new-buy-events?code="+encodeURIComponent(stock.code)+"&date="+tradeDate,tag:"signalx-new-buy-"+stock.code+"-"+tradeDate});
  const state=delivery.ok?"SENT":delivery.reason==="NO_SUBSCRIPTION"||delivery.reason==="PREFERENCE_DISABLED"?"PENDING":"CLAIMED";
  await pool.query(`UPDATE public.owner_new_buy_events SET state=$4,notified_at=CASE WHEN $4='SENT' THEN now() ELSE NULL END
   WHERE owner_email=$1 AND code=$2 AND trade_date=$3::date AND state='CLAIMED'`,[owner,stock.code,tradeDate,state]);
  return {hasEvent:true,state};
 }
 const existing=await pool.query<{state:string}>(`SELECT state FROM public.owner_new_buy_events WHERE owner_email=$1 AND code=$2 AND trade_date=$3::date`,[owner,stock.code,tradeDate]);
 return {hasEvent:Boolean(existing.rowCount),state:existing.rows[0]?.state??observation.reason};
}
