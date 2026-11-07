import {NextResponse} from "next/server";
import pool from "@/app/lib/postgres";
import {requireCronAuth} from "@/app/lib/cronAuth";
import {isLearningOwnerEmail} from "@/app/lib/learningOwner";
import {getTseCashSessionStatus,isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {pushWebToUser} from "@/app/lib/push/userPush";
import {evaluateUptrend} from "@/app/lib/uptrendObservation.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(request:Request) {
  const unauthorized=requireCronAuth(request);
  if(unauthorized)return unauthorized;
  const now=new Date();
  const session=getTseCashSessionStatus(now);
  if(!session.open)return NextResponse.json({success:true,skipped:session.reason});
  const owner=(process.env.SIGNALX_LEARNING_OWNER_EMAIL||process.env.ADMIN_EMAIL||"").trim().toLowerCase();
  if(!isLearningOwnerEmail(owner))return NextResponse.json({success:false,error:"OWNER_UNAVAILABLE"},{status:503});
  const priorDates:string[]=[];
  for(let offset=1;offset<=14&&priorDates.length<2;offset++){
    const date=new Date(Date.parse(session.date+"T00:00:00Z")-offset*86400000).toISOString().slice(0,10);
    if(isTseTradingDate(date))priorDates.push(date);
  }
  if(priorDates.length!==2)return NextResponse.json({success:false,error:"CALENDAR_UNAVAILABLE"},{status:503});
  await pool.query(`
    WITH signals AS (
      SELECT code,trade_date signal_date,'ローソク足の上昇形' reason
      FROM public.pattern_forward_observations
      WHERE direction='BUY' AND trade_date=ANY($2::date[])
        AND created_at < (($3::date)::timestamp AT TIME ZONE 'Asia/Tokyo')
      UNION ALL
      SELECT code,signal_date,'BB上側トレンド' FROM public.bb_signal_events
      WHERE upper_regime='UPPER_TREND' AND signal_date=ANY($2::date[])
        AND created_at < (($3::date)::timestamp AT TIME ZONE 'Asia/Tokyo')
    ), candidates AS (
      SELECT s.code,max(s.signal_date) signal_date,max(d.name) name,
        jsonb_agg(DISTINCT s.reason) reasons,max(d.score) score
      FROM signals s JOIN public.daily_stock_results d
        ON d.code=s.code AND d.date=s.signal_date::text
      WHERE s.code ~ '^[0-9][0-9A-Z][0-9][0-9A-Z]$'
      GROUP BY s.code ORDER BY max(d.score) DESC,s.code LIMIT 20
    )
    INSERT INTO public.owner_uptrend_watch(owner_email,code,signal_date,name,reasons)
    SELECT $1,code,signal_date,name,reasons FROM candidates
    ON CONFLICT(owner_email,code,signal_date) DO NOTHING
  `,[owner,priorDates,session.date]);
  const {rows}=await pool.query<{code:string;name:string;signal_date:string}>(`
    SELECT DISTINCT ON (w.code) w.code,w.name,w.signal_date::text FROM public.owner_uptrend_watch w
    WHERE owner_email=$1 AND signal_date=ANY($2::date[]) AND state='WAITING'
      AND NOT EXISTS(SELECT 1 FROM public.owner_uptrend_watch sent
        WHERE sent.owner_email=w.owner_email AND sent.code=w.code AND sent.state IN ('SENT','CLAIMED')
          AND sent.signal_date>= $3::date)
    ORDER BY w.code,w.signal_date DESC LIMIT 20
  `,[owner,priorDates,priorDates[1]]);
  const outcomes:Record<string,unknown>[]=[];
  for(let start=0;start<rows.length;start+=4){
    await Promise.all(rows.slice(start,start+4).map(async stock=>{
      try {
        const response=await fetch("https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(stock.code+".T")+"?range=5d&interval=5m",
          {cache:"no-store",signal:AbortSignal.timeout(7000),headers:{"User-Agent":"Mozilla/5.0"}});
        if(!response.ok)throw Error("QUOTE_HTTP_"+response.status);
        const payload=await response.json();
        const result=payload?.chart?.result?.[0];
        if(!Array.isArray(result?.timestamp))throw Error("MISSING_TIMESTAMPS");
        const quotes=result?.indicators?.quote?.[0];
        if(!quotes)throw Error("MISSING_QUOTES");
        const bars=result.timestamp.map((time:number,index:number)=>({time,
          open:quotes.open?.[index],high:quotes.high?.[index],low:quotes.low?.[index],
          close:quotes.close?.[index],volume:quotes.volume?.[index]}));
        const observation=evaluateUptrend(bars,Date.now(),session.date);
        await pool.query(`UPDATE public.owner_uptrend_watch SET observation=$4::jsonb
          WHERE owner_email=$1 AND code=$2 AND signal_date=$3::date AND state='WAITING'`,
          [owner,stock.code,stock.signal_date,JSON.stringify(observation)]);
        if(!observation.matched){outcomes.push({code:stock.code,state:observation.reason});return;}
        // Claim before delivery. An ambiguous delivery stays claimed for manual audit.
        const claim=await pool.query(`UPDATE public.owner_uptrend_watch w
          SET state='CLAIMED',claimed_at=now(),observation=$4::jsonb
          WHERE owner_email=$1 AND code=$2 AND signal_date=$3::date AND state='WAITING'
          AND NOT EXISTS(SELECT 1 FROM public.owner_uptrend_watch s WHERE s.owner_email=w.owner_email
            AND s.code=w.code AND s.state IN ('SENT','CLAIMED') AND s.signal_date>=$5::date)
          RETURNING code`,[owner,stock.code,stock.signal_date,JSON.stringify(observation),priorDates[1]]);
        if(!claim.rowCount)return;
        const time=new Date(observation.barTime*1000).toLocaleTimeString("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit"});
        const delivery=await pushWebToUser(owner,{
          title:"📈 "+stock.name+"が上昇傾向に入りました",
          body:stock.code+"｜"+time+"開始の確定5分足で終値・安値切り上がり、BB中心線上向き、出来高"+observation.volumeRatio.toFixed(2)+"倍を確認。参考 "+observation.price.toLocaleString("ja-JP")+"円",
          url:"/analysis/"+stock.code,tag:"signalx-uptrend-"+stock.code+"-"+stock.signal_date,
        });
        await pool.query(`UPDATE public.owner_uptrend_watch
          SET state=$4,notified_at=CASE WHEN $4='SENT' THEN now() ELSE NULL END
          WHERE owner_email=$1 AND code=$2 AND signal_date=$3::date AND state='CLAIMED'`,
          [owner,stock.code,stock.signal_date,delivery.ok?"SENT":"WAITING"]);
        outcomes.push({code:stock.code,state:delivery.ok?"SENT":delivery.reason||"DELIVERY_FAILED"});
      }catch(error){
        outcomes.push({code:stock.code,state:error instanceof Error?error.message:"CAPTURE_FAILED"});
      }
    }));
  }
  return NextResponse.json({success:true,date:session.date,checked:rows.length,outcomes},
    {headers:{"Cache-Control":"private, no-store"}});
}
