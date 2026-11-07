import {NextResponse} from "next/server";
import pool from "@/app/lib/postgres";
import {requireCronAuth} from "@/app/lib/cronAuth";
import {isLearningOwnerEmail} from "@/app/lib/learningOwner";
import {getTseCashSessionStatus} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {pushWebToUser} from "@/app/lib/push/userPush";
import {evaluateDowntrend} from "@/app/lib/uptrendObservation.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=180;

export async function GET(request:Request) {
  const unauthorized=requireCronAuth(request);
  if(unauthorized)return unauthorized;
  const session=getTseCashSessionStatus(new Date());
  if(!session.open)return NextResponse.json({success:true,skipped:session.reason});
  const owner=(process.env.SIGNALX_LEARNING_OWNER_EMAIL||process.env.ADMIN_EMAIL||"").trim().toLowerCase();
  if(!isLearningOwnerEmail(owner))return NextResponse.json({success:false,error:"OWNER_UNAVAILABLE"},{status:503});
  await pool.query(`
    INSERT INTO public.owner_downtrend_watch(owner_email,code,name)
    SELECT user_email,code,name FROM public.user_favorites
    WHERE user_email=$1 AND code ~ '^[0-9][0-9A-Z][0-9][0-9A-Z]$'
    ON CONFLICT(owner_email,code) DO UPDATE SET name=EXCLUDED.name
  `,[owner]);
  const {rows}=await pool.query<{code:string;name:string}>(`
    SELECT w.code,w.name FROM public.owner_downtrend_watch w
    WHERE w.owner_email=$1 AND EXISTS(SELECT 1 FROM public.user_favorites f
      WHERE f.user_email=w.owner_email AND f.code=w.code)
    ORDER BY checked_at NULLS FIRST,code LIMIT 160
  `,[owner]);
  const outcomes:Record<string,unknown>[]=[];
  for(let start=0;start<rows.length;start+=20) {
    await Promise.all(rows.slice(start,start+20).map(async stock=>{
      try {
        const response=await fetch("https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(stock.code+".T")+"?range=5d&interval=5m",
          {cache:"no-store",signal:AbortSignal.timeout(5000),headers:{"User-Agent":"Mozilla/5.0"}});
        if(!response.ok)throw Error("QUOTE_HTTP_"+response.status);
        const payload=await response.json();
        const result=payload?.chart?.result?.[0];
        const quotes=result?.indicators?.quote?.[0];
        if(!Array.isArray(result?.timestamp)||!quotes)throw Error("MISSING_BARS");
        const bars=result.timestamp.map((time:number,index:number)=>({time,
          open:quotes.open?.[index],high:quotes.high?.[index],low:quotes.low?.[index],
          close:quotes.close?.[index],volume:quotes.volume?.[index]}));
        const observation=evaluateDowntrend(bars,Date.now(),session.date);
        const observedBar=typeof observation.barTime==="number"?observation.barTime:null;
        // Rearm only after two distinct completed bars with valid non-matching observations.
        // Missing or stale prices cannot clear a previously notified episode.
        await pool.query(`
          UPDATE public.owner_downtrend_watch w SET
            checked_at=now(),observation=$3::jsonb,
            last_bar=CASE WHEN $4::bigint IS NOT NULL THEN greatest(COALESCE(last_bar,0),$4) ELSE last_bar END,
            clear_count=CASE
              WHEN $5::boolean THEN 0
              WHEN $6::boolean AND (last_bar IS NULL OR last_bar<$4) THEN clear_count+1
              ELSE clear_count END,
            state=CASE WHEN state='NOTIFIED' AND $6::boolean
              AND (last_bar IS NULL OR last_bar<$4) AND clear_count>=1 THEN 'ARMED' ELSE state END
          WHERE owner_email=$1 AND code=$2
        `,[owner,stock.code,JSON.stringify(observation),observedBar,
          observation.matched,observation.reason==="CONDITIONS_NOT_MET"]);
        if(!observation.matched||typeof observation.price!=="number"||
          typeof observation.barTime!=="number"||typeof observation.volumeRatio!=="number"){
          outcomes.push({code:stock.code,state:observation.reason});return;
        }
        const claim=await pool.query(`
          UPDATE public.owner_downtrend_watch w SET state='CLAIMED'
          WHERE owner_email=$1 AND code=$2 AND state='ARMED'
            AND EXISTS(SELECT 1 FROM public.user_favorites f WHERE f.user_email=w.owner_email AND f.code=w.code)
          RETURNING code
        `,[owner,stock.code]);
        if(!claim.rowCount){outcomes.push({code:stock.code,state:"ALREADY_NOTIFIED_OR_CLAIMED"});return;}
        const time=new Date(observation.barTime*1000).toLocaleTimeString("ja-JP",
          {timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit"});
        const delivery=await pushWebToUser(owner,{
          title:"📉 "+stock.name+"が下落傾向に入りました",
          body:stock.code+"｜"+time+"開始の確定5分足で終値・高値切り下がり、BB中心線下向き、出来高"+
            observation.volumeRatio.toFixed(2)+"倍を確認。参考 "+observation.price.toLocaleString("ja-JP")+"円",
          url:"/analysis/"+stock.code,tag:"signalx-downtrend-"+stock.code,
        });
        const nextState=delivery.ok?"NOTIFIED":
          delivery.reason==="NO_SUBSCRIPTION"||delivery.reason==="PREFERENCE_DISABLED"?"ARMED":"CLAIMED";
        await pool.query(`UPDATE public.owner_downtrend_watch SET state=$3,
          notified_at=CASE WHEN $3='NOTIFIED' THEN now() ELSE notified_at END
          WHERE owner_email=$1 AND code=$2 AND state='CLAIMED'`,[owner,stock.code,nextState]);
        outcomes.push({code:stock.code,state:nextState});
      } catch(error) {
        const reason=error instanceof Error?error.message:"CAPTURE_FAILED";
        await pool.query(`UPDATE public.owner_downtrend_watch SET checked_at=now(),observation=$3::jsonb
          WHERE owner_email=$1 AND code=$2`,[owner,stock.code,JSON.stringify({matched:false,reason})]);
        outcomes.push({code:stock.code,state:reason});
      }
    }));
  }
  return NextResponse.json({success:true,date:session.date,checked:rows.length,outcomes},
    {headers:{"Cache-Control":"private, no-store"}});
}
