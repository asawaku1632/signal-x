import "server-only";
import {randomUUID} from "node:crypto";
import pool from "@/app/lib/postgres";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {detectChartPatterns,type PatternCandle} from "@/app/lib/chartPatternEngine";
import {evaluateDailyBollingerSignal} from "@/app/lib/bollingerBands";
import {pushWebToUser} from "@/app/lib/push/userPush";
import {jquantsCode,jquantsDailyCandle} from "@/app/lib/jquantsNightData.mjs";

import {evaluateNightMa75} from "@/app/lib/nightMa75.mjs";
type Ma75={status:string;value?:number;previous?:number;rising?:boolean;above?:boolean;breakout?:boolean;distancePercent?:number};
type Candidate={code:string;name:string;price:number;reasons:string[];bbTrend:boolean;volumeRatio:number;ma75:Ma75};
type NightRun={state:string;candidates:Candidate[];universe_count:number;evaluated_count:number;excluded_count:number;note:string|null};

export async function fetchDay(date:string,key:string,deadline:number) {
  const rows:Record<string,unknown>[]=[];
  let cursor:string|undefined;
  const seen=new Set<string>();
  for(let page=0;page<10;page++){
    if(Date.now()>deadline)throw Error("JQUANTS_CAPTURE_TIMEOUT");
    const params=new URLSearchParams({date});
    if(cursor)params.set("pagination_key",cursor);
    const response=await fetch("https://api.jquants.com/v2/equities/bars/daily?"+params,
      {cache:"no-store",headers:{"x-api-key":key},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error("JQUANTS_HTTP_"+response.status);
    const json=await response.json();
    if(!Array.isArray(json.data))throw Error("JQUANTS_INVALID_RESPONSE");
    rows.push(...json.data);
    cursor=json.pagination_key;
    if(!cursor)return rows;
    if(typeof cursor!=="string"||seen.has(cursor))throw Error("JQUANTS_PAGINATION_INVALID");
    seen.add(cursor);
    await new Promise(resolve=>setTimeout(resolve,1100));
  }
  throw Error("JQUANTS_PAGE_LIMIT");
}

export async function captureJquantsNight(owner:string,date:string) {
  const key=process.env.JQUANTS_API_KEY;
  if(!key)throw Error("JQUANTS_KEY_UNAVAILABLE");
  const runId=randomUUID();
  await pool.query(`INSERT INTO public.owner_night_jquants(owner_email,trade_date)
    VALUES($1,$2::date) ON CONFLICT DO NOTHING`,[owner,date]);
  const claim=await pool.query(`UPDATE public.owner_night_jquants SET state='FETCHING',run_id=$3::uuid,
    updated_at=now(),note=NULL WHERE owner_email=$1 AND trade_date=$2::date
    AND (state='PENDING' OR (state='FETCHING' AND updated_at<now()-interval '10 minutes'))
    RETURNING trade_date`,[owner,date,runId]);
  if(!claim.rowCount)return;
  try{
    const {rows:universe}=await pool.query<{code:string;name:string}>(`
      SELECT DISTINCT ON(code) code,name FROM public.daily_stock_results
      WHERE date=$1 ORDER BY code,created_at DESC,id DESC
    `,[date]);
    if(universe.length!==953||universe.some(row=>jquantsCode(row.code)!==row.code))
      throw Error("UNIVERSE_953_NOT_READY");
    const names=new Map(universe.map(row=>[row.code,row.name]));
    const dates:string[]=[];
    for(let offset=0;offset<190&&dates.length<85;offset++){
      const day=new Date(Date.parse(date+"T00:00:00Z")-offset*86400000).toISOString().slice(0,10);
      if(isTseTradingDate(day))dates.push(day);
    }
    if(dates.length!==85)throw Error("JQUANTS_HISTORY_CALENDAR_UNAVAILABLE");
    const candles=new Map<string,PatternCandle[]>(universe.map(row=>[row.code,[]]));
    const latestSeen=new Set<string>();
    const deadline=Date.now()+210000;
    const chronologicalDates=[...dates].reverse();
    const expectedTimes=chronologicalDates.map(day=>Date.parse(day+"T15:30:00+09:00")/1000);
    const requiredDates=[...dates.slice(0,40)].reverse();
    // Capture the original 40-session analysis first; extra MA75 history is optional.
    for(const day of [...requiredDates,...dates.slice(40)]){
      let rows:Record<string,unknown>[];
      try { rows=await fetchDay(day,key,deadline); }
      catch(error){ if(requiredDates.includes(day))throw error; break; }
      const dayCodes=new Set<string>();
      for(const row of rows){
        const code=jquantsCode(row.Code);
        if(!code||!names.has(code))continue;
        if(row.Date!==day||dayCodes.has(code))throw Error("JQUANTS_DATE_OR_DUPLICATE_ERROR");
        dayCodes.add(code);
        if(day===date)latestSeen.add(code);
        const candle=jquantsDailyCandle(row,day);
        if(candle)candles.get(code)!.push(candle);
      }
      await new Promise(resolve=>setTimeout(resolve,1100));
    }
    if(latestSeen.size!==953)throw Error("JQUANTS_TODAY_INCOMPLETE");
    let evaluated=0;
    const candidates:Candidate[]=[];
    for(const [code,history] of candles){
      history.sort((a,b)=>a.time-b.time);
      const bars=history.filter(bar=>bar.time>=expectedTimes[45]);
      if(bars.length<25||bars.at(-1)?.time!==Date.parse(date+"T15:30:00+09:00")/1000)continue;
      evaluated++;
      const patterns=detectChartPatterns(bars);
      const bullish=patterns.filter(pattern=>pattern.direction==="BUY");
      const bb=evaluateDailyBollingerSignal(bars,{patterns});
      const bbTrend=bb?.upperRegime==="UPPER_TREND";
      if(!bbTrend&&!bullish.length)continue;
      // Retain the actual shape names and warnings rather than assigning a win probability.
      const reasons=bullish.map(pattern=>pattern.name);
      if(bbTrend)reasons.push("BB上側トレンド");
      if(bb?.upperRegime==="UPPER_REVERSAL")reasons.push("BB失速警戒もあり");
      const last=bars.at(-1)!;
      const previous=bars.slice(-21,-1);
      const averageVolume=previous.reduce((sum,bar)=>sum+(bar.volume??0),0)/previous.length;
      candidates.push({code,name:names.get(code)!,price:last.close,reasons,bbTrend,
        volumeRatio:averageVolume>0?(last.volume??0)/averageVolume:0,
        ma75:evaluateNightMa75(history,expectedTimes)});
    }
    candidates.sort((a,b)=>
      Number(b.bbTrend&&b.reasons.length>1)-Number(a.bbTrend&&a.reasons.length>1)||
      b.volumeRatio-a.volumeRatio||a.code.localeCompare(b.code));
    await pool.query(`UPDATE public.owner_night_jquants SET state='READY',updated_at=now(),
      analyzed_at=now(),universe_count=953,evaluated_count=$4,excluded_count=$5,
      candidates=$6::jsonb,note='JQUANTS_DAILY_40_SESSIONS_MA75_CONTEXT_V2'
      WHERE owner_email=$1 AND trade_date=$2::date AND run_id=$3::uuid AND state='FETCHING'`,
      [owner,date,runId,evaluated,953-evaluated,JSON.stringify(candidates)]);
  }catch(error){
    const reason=error instanceof Error?error.message:"JQUANTS_CAPTURE_FAILED";
    await pool.query(`UPDATE public.owner_night_jquants SET state='PENDING',updated_at=now(),note=$4
      WHERE owner_email=$1 AND trade_date=$2::date AND run_id=$3::uuid AND state='FETCHING'`,
      [owner,date,runId,reason]);
    throw error;
  }
}

export async function notifyJquantsNight(owner:string,date:string) {
  const claimed=await pool.query<NightRun>(`UPDATE public.owner_night_jquants SET state='CLAIMED',updated_at=now()
    WHERE owner_email=$1 AND trade_date=$2::date AND state='READY'
    RETURNING state,candidates,universe_count,evaluated_count,excluded_count,note`,[owner,date]);
  const run=claimed.rows[0];
  if(!run)return {state:"NOT_READY_OR_ALREADY_NOTIFIED"};
  if(!run.candidates.length){
    await pool.query(`UPDATE public.owner_night_jquants SET state='NOTIFIED',updated_at=now(),note='NO_CANDIDATES'
      WHERE owner_email=$1 AND trade_date=$2::date AND state='CLAIMED'`,[owner,date]);
    return {state:"NO_CANDIDATES"};
  }
  const shortlist=run.candidates.slice(0,5);
  const delivery=await pushWebToUser(owner,{
    title:"🌙 J-Quants日足で翌営業日の監視候補を更新しました",
    body:date+"｜"+run.evaluated_count+"/953銘柄を分析。候補"+run.candidates.length+"銘柄。"+
      shortlist.map(row=>row.code+" "+row.name).join("、"),
    url:"/admin/night-jquants",tag:"signalx-night-jquants-"+date,
  });
  const state=delivery.ok?"NOTIFIED":delivery.reason==="NO_SUBSCRIPTION"?"READY":"CLAIMED";
  await pool.query(`UPDATE public.owner_night_jquants SET state=$3,updated_at=now(),
    notified_at=CASE WHEN $3='NOTIFIED' THEN now() ELSE NULL END
    WHERE owner_email=$1 AND trade_date=$2::date AND state='CLAIMED'`,[owner,date,state]);
  return {state,sent:delivery.sent};
}
