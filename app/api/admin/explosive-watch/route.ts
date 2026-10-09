import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import pool from "@/app/lib/postgres";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
 const admin = await getAdminSession();
 if (!admin.isAdmin) return NextResponse.json({error:"Forbidden"},{status:403});
 try {
 const result=await pool.query(`
 WITH signals AS (
 SELECT trade_date,code,'MM_V1' AS research,result_1d,result_3d,result_5d FROM momentum_memory_observations WHERE validation_mode='FORWARD' AND observation_flag=true
 UNION ALL SELECT trade_date,code,'HAP_V1',result_1d,result_3d,result_5d FROM high_ai_pullback_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='HAP_V1'
 UNION ALL SELECT trade_date,code,'AIR_V1',result_1d,result_3d,result_5d FROM ai_reversal_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='AIR_V1'
 UNION ALL SELECT trade_date,code,'TPR_V1',result_1d,result_3d,result_5d FROM trend_pullback_reversal_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='TPR_V1'
 ), grouped AS (
 SELECT trade_date,code,ARRAY_AGG(DISTINCT research ORDER BY research) AS researches,
 COUNT(DISTINCT research)::int AS overlap_count,
 MAX(result_1d) AS result_1d,MAX(result_3d) AS result_3d,MAX(result_5d) AS result_5d
 FROM signals GROUP BY trade_date,code
 )
 SELECT g.*,COALESCE(d.name,g.code) AS name,
 (SELECT row_to_json(mm) FROM (SELECT current_ai_power,prev3_avg_ai_power,prev3_max_ai_power,prev3_high_count,ai_power_drop_from_peak,confirmation_key FROM momentum_memory_observations WHERE code=g.code AND trade_date=g.trade_date AND validation_mode='FORWARD' AND observation_flag=true LIMIT 1) mm) AS mm_details,
 (SELECT row_to_json(h) FROM (SELECT current_ai_power,previous_ai_power,current_macd_key,previous_macd_key,prior_3record_return FROM high_ai_pullback_observations WHERE code=g.code AND trade_date=g.trade_date AND validation_mode='FORWARD' AND observation_flag=true LIMIT 1) h) AS hap_details,
 (SELECT row_to_json(a) FROM (SELECT current_ai_power,previous_ai_power,ai_power_change,current_macd_key,prior_3record_return FROM ai_reversal_observations WHERE code=g.code AND trade_date=g.trade_date AND validation_mode='FORWARD' AND observation_flag=true LIMIT 1) a) AS air_details,
 (SELECT row_to_json(t) FROM (SELECT rsi_band,macd_key,vwap_key,ema20_key,prior_3record_return FROM trend_pullback_reversal_observations WHERE code=g.code AND trade_date=g.trade_date AND validation_mode='FORWARD' AND observation_flag=true LIMIT 1) t) AS tpr_details,
 (SELECT p.ai_power FROM pattern_learning_logs p WHERE p.code=g.code AND p.trade_date=g.trade_date ORDER BY p.created_at DESC LIMIT 1) AS ai_power,
 (SELECT m.market_pattern FROM market_learning_logs m WHERE m.trade_date=g.trade_date ORDER BY m.created_at DESC LIMIT 1) AS market_pattern
 FROM grouped g LEFT JOIN LATERAL(
 SELECT name FROM daily_stock_results d WHERE d.code=g.code AND d.date::date=g.trade_date ORDER BY d.created_at DESC LIMIT 1
 )d ON true ORDER BY g.trade_date DESC,g.overlap_count DESC,g.code LIMIT 200`);
 return NextResponse.json({success:true,items:result.rows},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){console.error("explosive watch error",error);return NextResponse.json({error:"Data unavailable"},{status:500});}
}