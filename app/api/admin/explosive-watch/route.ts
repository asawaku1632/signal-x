import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import pool from "@/app/lib/postgres";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
 const admin = await getAdminSession();
 if (!admin.isAdmin) return NextResponse.json({error:"Forbidden"},{status:403});
 try {
 await pool.query(`INSERT INTO explosive_candidate_price_snapshots(trade_date,code,reference_price)
 WITH candidates AS (
 SELECT trade_date,code FROM momentum_memory_observations WHERE validation_mode='FORWARD' AND observation_flag=true
 UNION SELECT trade_date,code FROM high_ai_pullback_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='HAP_V1'
 UNION SELECT trade_date,code FROM ai_reversal_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='AIR_V1'
 UNION SELECT trade_date,code FROM trend_pullback_reversal_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='TPR_V1'
 ) SELECT c.trade_date,c.code,d.price FROM candidates c
 JOIN LATERAL (SELECT price FROM daily_stock_results d WHERE d.code=c.code AND d.date::date=c.trade_date AND d.price>0 ORDER BY d.created_at DESC LIMIT 1) d ON true
 ON CONFLICT(trade_date,code) DO NOTHING`);
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
 SELECT g.*,COALESCE(d.name,g.code) AS name,\n (SELECT s.reference_price FROM explosive_candidate_price_snapshots s WHERE s.code=g.code AND s.trade_date=g.trade_date) AS discovery_price,\n (SELECT p.price FROM daily_stock_results p WHERE p.code=g.code AND p.price>0 ORDER BY p.date::date DESC,p.created_at DESC LIMIT 1) AS reference_price,
 (SELECT row_to_json(mm) FROM (SELECT current_ai_power,prev3_avg_ai_power,prev3_max_ai_power,prev3_high_count,ai_power_drop_from_peak,confirmation_key FROM momentum_memory_observations WHERE code=g.code AND trade_date=g.trade_date AND validation_mode='FORWARD' AND observation_flag=true LIMIT 1) mm) AS mm_details,
 (SELECT row_to_json(h) FROM (SELECT current_ai_power,previous_ai_power,current_macd_key,previous_macd_key,prior_3record_return FROM high_ai_pullback_observations WHERE code=g.code AND trade_date=g.trade_date AND validation_mode='FORWARD' AND observation_flag=true LIMIT 1) h) AS hap_details,
 (SELECT row_to_json(a) FROM (SELECT current_ai_power,previous_ai_power,ai_power_change,current_macd_key,prior_3record_return FROM ai_reversal_observations WHERE code=g.code AND trade_date=g.trade_date AND validation_mode='FORWARD' AND observation_flag=true LIMIT 1) a) AS air_details,
 (SELECT row_to_json(t) FROM (SELECT rsi_band,macd_key,vwap_key,ema20_key,prior_3record_return FROM trend_pullback_reversal_observations WHERE code=g.code AND trade_date=g.trade_date AND validation_mode='FORWARD' AND observation_flag=true LIMIT 1) t) AS tpr_details,
 (SELECT p.ai_power FROM pattern_learning_logs p WHERE p.code=g.code AND p.trade_date=g.trade_date ORDER BY p.created_at DESC LIMIT 1) AS ai_power,
 (SELECT m.market_pattern FROM market_learning_logs m WHERE m.trade_date=g.trade_date ORDER BY m.created_at DESC LIMIT 1) AS market_pattern
 FROM grouped g LEFT JOIN LATERAL(
 SELECT name FROM daily_stock_results d WHERE d.code=g.code AND d.date::date=g.trade_date ORDER BY d.created_at DESC LIMIT 1
 )d ON true ORDER BY g.trade_date DESC,g.overlap_count DESC,g.code LIMIT 200`);
 const stats=await pool.query(`WITH observations AS (
 SELECT 'MM_V1' research,result_5d FROM momentum_memory_observations WHERE validation_mode='FORWARD' AND observation_flag=true
 UNION ALL SELECT 'HAP_V1',result_5d FROM high_ai_pullback_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='HAP_V1'
 UNION ALL SELECT 'AIR_V1',result_5d FROM ai_reversal_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='AIR_V1'
 UNION ALL SELECT 'TPR_V1',result_5d FROM trend_pullback_reversal_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='TPR_V1'
 ) SELECT research,COUNT(result_5d)::int completed,ROUND(AVG(result_5d),4) avg5 FROM observations GROUP BY research`);
 const comparisonResult=await pool.query(`WITH signals AS (
 SELECT trade_date,code,'MM_V1' src,result_1d,result_3d,result_5d FROM momentum_memory_observations WHERE validation_mode='FORWARD' AND observation_flag=true
 UNION ALL SELECT trade_date,code,'HAP_V1',result_1d,result_3d,result_5d FROM high_ai_pullback_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='HAP_V1'
 UNION ALL SELECT trade_date,code,'AIR_V1',result_1d,result_3d,result_5d FROM ai_reversal_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='AIR_V1'
 UNION ALL SELECT trade_date,code,'TPR_V1',result_1d,result_3d,result_5d FROM trend_pullback_reversal_observations WHERE validation_mode='FORWARD' AND observation_flag=true AND signal_version='TPR_V1'
 ), grouped AS (
 SELECT trade_date,code,COUNT(DISTINCT src) AS n,MAX(result_1d) r1,MAX(result_3d) r3,MAX(result_5d) r5 FROM signals GROUP BY trade_date,code
 ) SELECT CASE WHEN n>=2 THEN 'multi' ELSE 'single' END AS group_key,
 COUNT(*)::int AS events,COUNT(r1)::int AS completed1,ROUND(AVG(r1)::numeric,3) AS avg1,
 ROUND((100.0*COUNT(*) FILTER(WHERE r1>0)/NULLIF(COUNT(r1),0))::numeric,1) AS positive1,
 COUNT(r3)::int AS completed3,ROUND(AVG(r3)::numeric,3) AS avg3,
 COUNT(r5)::int AS completed5,ROUND(AVG(r5)::numeric,3) AS avg5
 FROM grouped GROUP BY 1`);
 const comparison=Object.fromEntries(comparisonResult.rows.map(r=>[r.group_key,r]));
 const performance=Object.fromEntries(stats.rows.map(r=>[r.research,{completed:r.completed,avg5:r.avg5}]));
 return NextResponse.json({success:true,performance,items:result.rows},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){console.error("explosive watch error",error);return NextResponse.json({error:"Data unavailable"},{status:500});}
}