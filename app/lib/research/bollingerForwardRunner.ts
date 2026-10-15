import "server-only";
import pool from "@/app/lib/postgres";
import {getForwardCandles} from "@/app/lib/emaForwardShadowStore";
import {getTseCashSessionStatus,isTseTradingDate,TSE_MARKET_CALENDAR_COVERAGE,TSE_MARKET_CALENDAR_VERSION} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {BB_FORWARD_FROZEN_CODES} from "./bollingerForwardUniverse";
import {FORWARD_VERSION,FORWARD_START,MAX_PENDING_CODES,MAX_VENDOR_REQUESTS,batchForMarketOrdinal,identifyTodayProspectiveSignal,gradeFrozenProspectiveSignal} from "./bollingerForwardCore.mjs";

const CODES=[...BB_FORWARD_FROZEN_CODES];
type Frozen={version:string;code:string;signal_time:string;signal_date:string;group_key:string;source_hash:string;calendar_version:string};
type Control={enabled:boolean;activation_date:string|null};
const dateJst=(s:number)=>new Date(s*1000).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});
const reason=(e:unknown)=>e instanceof Error?e.message.slice(0,100):"UNKNOWN";

function tradingDates(from:string,to:string):string[]{
 if(from<TSE_MARKET_CALENDAR_COVERAGE.startDate||to>TSE_MARKET_CALENDAR_COVERAGE.endDate||from>to)
  throw Error("CALENDAR_OUT_OF_SCOPE");
 const dates:string[]=[];
 let d=Date.parse(from+"T00:00:00Z"),end=Date.parse(to+"T00:00:00Z");
 for(let i=0;d<=end&&i<500;i++,d+=86400000){
  const day=new Date(d).toISOString().slice(0,10);
  if(isTseTradingDate(day))dates.push(day);
 }
 if(d<=end)throw Error("CALENDAR_LIMIT");
 return dates;
}
function nextTradeDate(now:Date){
 const s=getTseCashSessionStatus(now),base=Date.parse(s.date+"T00:00:00Z");
 for(let i=1;i<15;i++){
  const day=new Date(base+i*86400000).toISOString().slice(0,10);
  if(day>TSE_MARKET_CALENDAR_COVERAGE.endDate)break;
  if(day>=FORWARD_START&&isTseTradingDate(day))return day;
 }
 throw Error("NEXT_TRADING_DAY_UNAVAILABLE");
}
function safeTarget(now:Date){
 const s=getTseCashSessionStatus(now);
 return s.date>=FORWARD_START&&isTseTradingDate(s.date)&&
  (s.hour>16||(s.hour===16&&s.minute>=15))&&s.hour<22?s.date:null;
}
function archiveInput(source:Awaited<ReturnType<typeof getForwardCandles>>,day:string){
 const candles=source.candles.filter(x=>{
  const date=dateJst(x.time);return date>="2026-01-01"&&date<=day;
 });
 if(candles.length<81||dateJst(candles.at(-1)!.time)!==day)
  throw Error("COMPLETED_DAILY_BAR_UNAVAILABLE");
 return {code:source.code,provider:"YAHOO_CHART",timeframe:"1D",
  candles,splitEvents:[...source.splitEvents].sort((a,b)=>a-b),
  expectedTradingDates:tradingDates(dateJst(candles[0].time),day),
  asOfCompletedJstDate:day};
}
export async function prospectiveProgress(){
 const [control,counts,runs,results,ruleRows]=await Promise.all([
  pool.query<Control>("SELECT enabled,activation_date::text FROM public.bb_forward_study_control WHERE singleton=true"),
  pool.query<{signals:number;completed:number;halts:number;failed:number}>(`SELECT
   (SELECT COUNT(*)::int FROM public.bb_forward_signals) signals,
   (SELECT COUNT(*)::int FROM public.bb_forward_outcomes WHERE status='COMPLETE') completed,
   (SELECT COUNT(*)::int FROM public.bb_forward_signal_halts) halts,
   (SELECT COUNT(*)::int FROM public.bb_forward_stock_checks WHERE check_state<>'OK') failed`),
  pool.query(`SELECT trade_date::text,batch_id,status,observed_count,failed_count,new_signals,outcome_rows
   FROM public.bb_forward_study_runs ORDER BY trade_date DESC LIMIT 12`),
  pool.query<{group_key:string;horizon:number;n:number;wins:number;mean_return:number|null;mean_adverse:number|null}>(`
   SELECT s.group_key,o.horizon,COUNT(*)::int n,
    COUNT(*) FILTER(WHERE o.return_percent>0)::int wins,
    AVG(o.return_percent)::float mean_return,AVG(o.max_adverse_percent)::float mean_adverse
   FROM public.bb_forward_signals s JOIN public.bb_forward_outcomes o
    ON o.version=s.version AND o.code=s.code AND o.signal_time=s.signal_time
   WHERE o.status='COMPLETE'
   GROUP BY s.group_key,o.horizon ORDER BY s.group_key,o.horizon`),
  pool.query<{group_key:string;horizon:number;rule:string;n:number;wins:number;mean_return:number|null}>(`
   SELECT s.group_key,o.horizon,rule.id AS rule,COUNT(*)::int n,
    COUNT(*) FILTER(WHERE o.return_percent>0)::int wins,
    AVG(o.return_percent)::float mean_return
   FROM public.bb_forward_signals s JOIN public.bb_forward_outcomes o
     ON o.version=s.version AND o.code=s.code AND o.signal_time=s.signal_time
   CROSS JOIN LATERAL (VALUES
     ('BASELINE'::text,true),
     ('RSI70_VOLUME_HIGH',s.rsi_group='RSI_70_PLUS' AND s.volume_bucket='HIGH_1_3X'),
     ('RSI50_70_VOLUME_HIGH',s.rsi_group='RSI_50_TO_70' AND s.volume_bucket='HIGH_1_3X'),
     ('TREND0_5_VOLUME_LOW',s.trend_group='TREND_FLAT_TO_5' AND s.volume_bucket='BELOW_1_3X'),
     ('TREND5_VOLUME_HIGH',s.trend_group='TREND_UP_5_PLUS' AND s.volume_bucket='HIGH_1_3X'),
     ('BREAKOUT2_VOLUME_HIGH',s.breakout_group='BREAKOUT_2_PLUS' AND s.volume_bucket='HIGH_1_3X'),
     ('RSI70_TREND0_5',s.rsi_group='RSI_70_PLUS' AND s.trend_group='TREND_FLAT_TO_5')
   ) AS rule(id,eligible)
   WHERE o.status='COMPLETE' AND rule.eligible
   GROUP BY s.group_key,o.horizon,rule.id ORDER BY s.group_key,o.horizon,rule.id`)
 ]);
 return {version:FORWARD_VERSION,enabled:control.rows[0]?.enabled===true,
  activationDate:control.rows[0]?.activation_date??null,
  coverage:{...counts.rows[0],sampledStocksPerTradingDay:20,fixedUniverse:100},
  runs:runs.rows,
  ruleScores:ruleRows.rows.map(r=>{
   const n=Number(r.n);return {group:r.group_key,horizon:Number(r.horizon),rule:r.rule,n,
    winRate:n>=30?Number(r.wins)/n:null,meanReturn:n>=30?Number(r.mean_return):null};
  }),
  results:results.rows.map(r=>{
   const n=Number(r.n);return {group:r.group_key,horizon:Number(r.horizon),n,
    winRate:n>=30?Number(r.wins)/n:null,
    meanReturn:n>=30?Number(r.mean_return):null,
    meanAdverse:n>=30?Number(r.mean_adverse):null};
  })};
}
export async function setProspectiveEnabled(enabled:boolean,now=new Date()){
 if(typeof enabled!=="boolean")throw Error("INVALID_SWITCH");
 // Opt-in never backfills an earlier day; earliest start is NEXT official trading date.
 const start=enabled?nextTradeDate(now):null;
 const r=await pool.query(`UPDATE public.bb_forward_study_control
   SET enabled=$1,activation_date=CASE WHEN $1 THEN $2::date ELSE activation_date END,
       updated_at=now()
   WHERE singleton=true RETURNING enabled`,[enabled,start]);
 if(r.rowCount!==1)throw Error("CONTROL_UNAVAILABLE");
 return prospectiveProgress();
}
async function pendingCandidates(day:string):Promise<string[]>{
 const r=await pool.query<{code:string}>(`SELECT code FROM (
    SELECT s.code,MIN(s.signal_date) earliest
    FROM public.bb_forward_signals s WHERE s.signal_date<$1::date
     AND NOT EXISTS (SELECT 1 FROM public.bb_forward_signal_halts h
       WHERE h.version=s.version AND h.code=s.code AND h.signal_time=s.signal_time)
     AND EXISTS(SELECT 1 FROM unnest(ARRAY[1,3,5]::smallint[]) need(horizon)
      WHERE NOT EXISTS (SELECT 1 FROM public.bb_forward_outcomes o
       WHERE o.version=s.version AND o.code=s.code
        AND o.signal_time=s.signal_time AND o.horizon=need.horizon))
    GROUP BY s.code
   ) x ORDER BY earliest,code LIMIT $2`,[day,MAX_PENDING_CODES]);
 return r.rows.map(x=>x.code);
}
async function processOne(code:string,day:string,batch:number,sampled:boolean){
 try{
  const source=await getForwardCandles(code);
  if(source.code!==code)throw Error("SOURCE_CODE_MISMATCH");
  const input=archiveInput(source,day);
  const fresh=sampled?identifyTodayProspectiveSignal(input,day,TSE_MARKET_CALENDAR_VERSION):null;
  const past=await pool.query<Frozen>(`SELECT version,code,signal_time::text,signal_date::text,
     group_key,source_hash,calendar_version FROM public.bb_forward_signals s
    WHERE code=$1 AND signal_date<$2::date
     AND NOT EXISTS(SELECT 1 FROM public.bb_forward_signal_halts h
       WHERE h.version=s.version AND h.code=s.code AND h.signal_time=s.signal_time)
     AND EXISTS(SELECT 1 FROM unnest(ARRAY[1,3,5]::smallint[]) need(horizon)
      WHERE NOT EXISTS(SELECT 1 FROM public.bb_forward_outcomes o
       WHERE o.version=s.version AND o.code=s.code AND o.signal_time=s.signal_time
        AND o.horizon=need.horizon))
    ORDER BY signal_date LIMIT 20`,[code,day]);
  const mature:Record<string,number|string|null>[]=[],halts:{signal_time:number;why:string}[]=[];
  for(const old of past.rows){
   try{mature.push(...gradeFrozenProspectiveSignal(old,input,day));}
   catch(e){
    const msg=reason(e);
    const reasons:Record<string,string>={
     FROZEN_SOURCE_REVISED:"SOURCE_REVISED",
     FROZEN_SIGNAL_OUTSIDE_SOURCE:"HISTORY_EXPIRED",
     FROZEN_DETECTOR_CHANGED:"DETECTOR_CHANGED"};
    if(reasons[msg])halts.push({signal_time:Number(old.signal_time),why:reasons[msg]});
    else throw e;
   }
  }
  const tx=await pool.connect();
  let signals=0,outcomes=0;
  try{
   await tx.query("BEGIN");
   if(fresh){
    const r=await tx.query(`INSERT INTO public.bb_forward_signals
      (version,code,signal_time,signal_date,group_key,signal_close,source_hash,
       calendar_version,rsi_group,trend_group,breakout_group,volume_bucket,
       rsi14,trend10_percent,breakout_strength_percent,volume_ratio)
      VALUES($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT(version,code,signal_time) DO NOTHING`,
      [fresh.version,fresh.code,fresh.signal_time,fresh.signal_date,fresh.group_key,
       fresh.signal_close,fresh.source_hash,fresh.calendar_version,fresh.rsi_group,
       fresh.trend_group,fresh.breakout_group,fresh.volume_bucket,fresh.rsi14,
       fresh.trend10_percent,fresh.breakout_strength_percent,fresh.volume_ratio]);
    signals=r.rowCount??0;
   }
   for(const o of mature){
    const r=await tx.query(`INSERT INTO public.bb_forward_outcomes
      (version,code,signal_time,horizon,status,entry_time,exit_time,
       entry_price,exit_price,return_percent,max_adverse_percent)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(version,code,signal_time,horizon) DO NOTHING`,
      [o.version,o.code,o.signal_time,o.horizon,o.status,o.entry_time,o.exit_time,
       o.entry_price,o.exit_price,o.return_percent,o.max_adverse_percent]);
    outcomes+=r.rowCount??0;
   }
   for(const h of halts){
    await tx.query(`INSERT INTO public.bb_forward_signal_halts
      (version,code,signal_time,reason) VALUES($1,$2,$3,$4)
      ON CONFLICT(version,code,signal_time) DO NOTHING`,
      [FORWARD_VERSION,code,h.signal_time,h.why]);
   }
   if(sampled){
    await tx.query(`INSERT INTO public.bb_forward_stock_checks
     (trade_date,batch_id,code,check_state) VALUES($1::date,$2,$3,'OK')
     ON CONFLICT(trade_date,code) DO NOTHING`,[day,batch,code]);
   }
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  return {code,ok:true,signals,outcomes,note:null};
 }catch(e){
  const why=reason(e);
  if(sampled){
   await pool.query(`INSERT INTO public.bb_forward_stock_checks
    (trade_date,batch_id,code,check_state,note)
    VALUES($1::date,$2,$3,'QUALITY_FAILED',$4)
    ON CONFLICT(trade_date,code) DO NOTHING`,[day,batch,code,why]).catch(()=>undefined);
  }
  return {code,ok:false,signals:0,outcomes:0,note:why};
 }
}
/** No backfill of skipped observation days; 20 frozen universe stocks rotated
 * by JPX trading date. Up to ten separate unresolved signal stocks per day.
 * One permanent claim before <=30 vendor calls, concurrency<=3, no retries.
 */
export async function runForwardProspectiveDay(now=new Date()){
 const day=safeTarget(now);
 if(!day)return {success:true,skipped:true,reason:"NOT_SAFE_SAME_DAY_AFTER_CLOSE"};
 const c=await pool.query<Control>("SELECT enabled,activation_date::text FROM public.bb_forward_study_control WHERE singleton=true");
 if(c.rows[0]?.enabled!==true||!c.rows[0].activation_date||c.rows[0].activation_date>day)
  return {success:true,skipped:true,reason:"OWNER_OPT_IN_DISABLED",date:day};
 const ordinal=tradingDates(FORWARD_START,day).length-1;
 const {batchId,codes}=batchForMarketOrdinal(ordinal,CODES);
 const claim=await pool.query(`INSERT INTO public.bb_forward_study_runs
   (trade_date,batch_id,policy_version,codes)
   VALUES($1::date,$2,$3,$4::text[])
   ON CONFLICT(trade_date,batch_id) DO NOTHING RETURNING trade_date`,
   [day,batchId,FORWARD_VERSION,codes]);
 if(!claim.rowCount)return {success:true,skipped:true,reason:"ALREADY_CLAIMED",date:day};
 const pending=await pendingCandidates(day);
 const selected=new Set(codes);
 const all=[...codes,...pending.filter(code=>!selected.has(code))];
 if(all.length>MAX_VENDOR_REQUESTS)throw Error("PROVIDER_REQUEST_LIMIT");
 const outcomes:Awaited<ReturnType<typeof processOne>>[]=[];
 for(let i=0;i<all.length;i+=3){
  const results=await Promise.all(all.slice(i,i+3).map(code=>
   processOne(code,day,batchId,selected.has(code))));
  outcomes.push(...results);
 }
 const sampled=outcomes.filter(x=>selected.has(x.code));
 const complete=sampled.filter(x=>x.ok).length;
 const failed=sampled.length-complete;
 const signals=outcomes.reduce((n,x)=>n+x.signals,0);
 const graded=outcomes.reduce((n,x)=>n+x.outcomes,0);
 const status=failed?(complete?"PARTIAL":"FAILED"):"COMPLETE";
 await pool.query(`UPDATE public.bb_forward_study_runs
   SET status=$3,observed_count=$4,failed_count=$5,
    new_signals=$6,outcome_rows=$7,note=$8,finished_at=now()
   WHERE trade_date=$1::date AND batch_id=$2 AND status='CLAIMED'`,
   [day,batchId,status,complete,failed,signals,graded,
    failed?"STOCK_FAILURES_AUDITED":"RESEARCH_ONLY_COMPLETED"]);
 return {success:failed===0,skipped:false,date:day,batchId,observed:complete,
  failed,newSignals:signals,newOutcomeRows:graded,
  pendingCodesChecked:all.length-codes.length,
  failures:outcomes.filter(x=>!x.ok).map(x=>({code:x.code,note:x.note}))};
}
