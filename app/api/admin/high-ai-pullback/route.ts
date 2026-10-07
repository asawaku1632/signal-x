import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import pool from "@/app/lib/postgres";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(){
 if(!(await getAdminSession()).isAdmin) return NextResponse.json({success:false,error:"Administrator access required"},{status:403});
 try{
  const [summary,candidates]=await Promise.all([
   pool.query(`SELECT COUNT(*)::int sample_count,COUNT(result_5d)::int completed_5d_count,
    ROUND(AVG(result_1d),4) avg_return_1d,ROUND(AVG(result_3d),4) avg_return_3d,
    ROUND(AVG(result_5d),4) avg_return_5d,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY result_5d)::numeric,4) median_return_5d,
    ROUND(100.0*COUNT(*) FILTER(WHERE result_5d>0)/NULLIF(COUNT(result_5d),0),2) positive_rate_5d,
    COUNT(DISTINCT code) FILTER(WHERE result_5d IS NOT NULL)::int distinct_codes,
    COUNT(DISTINCT trade_date) FILTER(WHERE result_5d IS NOT NULL)::int distinct_dates
    FROM high_ai_pullback_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='HAP_V1'`),
   pool.query(`SELECT h.trade_date,h.code,COALESCE(d.name,h.code) name,h.current_ai_power,h.previous_ai_power,
    h.current_macd_key,h.previous_macd_key,h.prior_3record_return,h.market_pattern,
    h.result_1d,h.result_3d,h.result_5d,h.signal_version
    FROM high_ai_pullback_observations h
    LEFT JOIN LATERAL(SELECT name FROM daily_stock_results d WHERE d.code=h.code AND d.date::date=h.trade_date ORDER BY d.created_at DESC LIMIT 1)d ON true
    WHERE h.validation_mode='FORWARD' AND h.observation_flag=true
    ORDER BY h.trade_date DESC,h.code LIMIT 100`)
  ]);
  return NextResponse.json({success:true,summary:summary.rows[0],candidates:candidates.rows},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("High AI Pullback admin API error:",error);return NextResponse.json({success:false,error:"High AI Pullback data is unavailable"},{status:500});}
}
