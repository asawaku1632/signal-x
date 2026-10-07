import pool from "@/app/lib/postgres";

export async function saveAiReversalObservations(targetDate:string){
 const result=await pool.query(`
 WITH latest AS(
  SELECT DISTINCT ON(code,trade_date) code,trade_date,ai_power,macd_key
  FROM pattern_learning_logs WHERE trade_date<=$1::date
  ORDER BY code,trade_date,created_at DESC
 ), ranked AS(
  SELECT *,LAG(ai_power) OVER(PARTITION BY code ORDER BY trade_date) previous_ai_power FROM latest
 ), current_rows AS(
  SELECT r.*,d.price::numeric current_price,
   (SELECT d3.price::numeric FROM daily_stock_results d3 WHERE d3.code=r.code AND d3.date::date<r.trade_date AND d3.price>0 ORDER BY d3.date::date DESC OFFSET 2 LIMIT 1) price_3records_ago,
   (SELECT ml.market_pattern FROM market_learning_logs ml WHERE ml.trade_date=r.trade_date ORDER BY ml.created_at DESC LIMIT 1) market_pattern
  FROM ranked r JOIN daily_stock_results d ON d.code=r.code AND d.date::date=r.trade_date
  WHERE r.trade_date=$1::date AND d.price>0
 ), upserted AS(
  INSERT INTO ai_reversal_observations(trade_date,code,current_ai_power,previous_ai_power,ai_power_change,current_macd_key,prior_3record_return,market_pattern,observation_flag,validation_mode,signal_version,updated_at)
  SELECT trade_date,code,ai_power,previous_ai_power,ai_power-previous_ai_power,macd_key,
   ROUND((100.0*(current_price-price_3records_ago)/NULLIF(price_3records_ago,0))::numeric,4),market_pattern,
   (ai_power-previous_ai_power)>=15 AND (ai_power-previous_ai_power)<50 AND macd_key='MACD_GC'
    AND 100.0*(current_price-price_3records_ago)/NULLIF(price_3records_ago,0)<-5,
   'FORWARD','AIR_V1',NOW()
  FROM current_rows
  ON CONFLICT(trade_date,code) DO UPDATE SET current_ai_power=EXCLUDED.current_ai_power,previous_ai_power=EXCLUDED.previous_ai_power,
   ai_power_change=EXCLUDED.ai_power_change,current_macd_key=EXCLUDED.current_macd_key,prior_3record_return=EXCLUDED.prior_3record_return,
   market_pattern=EXCLUDED.market_pattern,observation_flag=EXCLUDED.observation_flag,updated_at=NOW()
  RETURNING observation_flag)
 SELECT COUNT(*)::int saved,COUNT(*) FILTER(WHERE observation_flag)::int flagged FROM upserted`,[targetDate]);
 return {aiReversalSaved:Number(result.rows[0]?.saved??0),aiReversalFlagged:Number(result.rows[0]?.flagged??0)};
}

export async function updateAiReversalOutcomes(targetDate:string){
 const result=await pool.query(`
 WITH c AS(
  SELECT h.id,b.price::numeric base_price,
   (SELECT d.price::numeric FROM daily_stock_results d WHERE d.code=h.code AND d.date::date>h.trade_date AND d.date::date<=$1::date ORDER BY d.date::date OFFSET 0 LIMIT 1)p1,
   (SELECT d.price::numeric FROM daily_stock_results d WHERE d.code=h.code AND d.date::date>h.trade_date AND d.date::date<=$1::date ORDER BY d.date::date OFFSET 2 LIMIT 1)p3,
   (SELECT d.price::numeric FROM daily_stock_results d WHERE d.code=h.code AND d.date::date>h.trade_date AND d.date::date<=$1::date ORDER BY d.date::date OFFSET 4 LIMIT 1)p5
  FROM ai_reversal_observations h JOIN daily_stock_results b ON b.code=h.code AND b.date::date=h.trade_date
  WHERE h.observation_flag=true AND h.trade_date<$1::date AND(h.result_1d IS NULL OR h.result_3d IS NULL OR h.result_5d IS NULL))
 UPDATE ai_reversal_observations h SET
  result_1d=COALESCE(h.result_1d,CASE WHEN c.p1 IS NOT NULL THEN ROUND((100.0*(c.p1-c.base_price)/NULLIF(c.base_price,0))::numeric,4)END),
  result_3d=COALESCE(h.result_3d,CASE WHEN c.p3 IS NOT NULL THEN ROUND((100.0*(c.p3-c.base_price)/NULLIF(c.base_price,0))::numeric,4)END),
  result_5d=COALESCE(h.result_5d,CASE WHEN c.p5 IS NOT NULL THEN ROUND((100.0*(c.p5-c.base_price)/NULLIF(c.base_price,0))::numeric,4)END),updated_at=NOW()
 FROM c WHERE h.id=c.id RETURNING h.id`,[targetDate]);
 return {aiReversalOutcomesUpdated:result.rowCount??0};
}
