import pool from "@/app/lib/postgres";

/** Save an immutable, date-matched research reference price. Never use a later quote. */
export async function saveExplosiveCandidateDiscoveryPrices(targetDate: string) {
 const result=await pool.query(`
 INSERT INTO explosive_candidate_price_snapshots(trade_date,code,reference_price)
 WITH candidates AS (
 SELECT trade_date,code FROM momentum_memory_observations WHERE trade_date=$1::date AND validation_mode='FORWARD' AND observation_flag=true
 UNION SELECT trade_date,code FROM high_ai_pullback_observations WHERE trade_date=$1::date AND validation_mode='FORWARD' AND observation_flag=true AND signal_version='HAP_V1'
 UNION SELECT trade_date,code FROM ai_reversal_observations WHERE trade_date=$1::date AND validation_mode='FORWARD' AND observation_flag=true AND signal_version='AIR_V1'
 UNION SELECT trade_date,code FROM trend_pullback_reversal_observations WHERE trade_date=$1::date AND validation_mode='FORWARD' AND observation_flag=true AND signal_version='TPR_V1'
 )
 SELECT c.trade_date,c.code,d.price FROM candidates c
 JOIN LATERAL (
 SELECT d.price FROM daily_stock_results d WHERE d.code=c.code AND d.date::date=c.trade_date AND d.price>0
 ORDER BY d.created_at DESC LIMIT 1
 ) d ON true
 ON CONFLICT(trade_date,code) DO NOTHING
 RETURNING code`,[targetDate]);
 return {discoveryPricesSaved:result.rowCount??0};
}
