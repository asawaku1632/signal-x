import pool from "@/app/lib/postgres";

export async function saveTrendPullbackReversalObservations(targetDate:string){
 const result=await pool.query(`
 WITH latest AS(
  SELECT DISTINCT ON(code,trade_date) code,trade_date,rsi_band,macd_key,vwap_key,ema20_key
  FROM pattern_learning_logs WHERE trade_date=$1::date
  ORDER BY code,trade_date,created_at DESC
 ), current_rows AS(
  SELECT p.*,d.price::numeric current_price,
   (SELECT d3.price::numeric FROM daily_stock_results d3 WHERE d3.code=p.code AND d3.date::date<p.trade_date AND d3.price>0 ORDER BY d3.date::date DESC OFFSET 2 LIMIT 1) price_3records_ago,
   (SELECT ml.market_pattern FROM market_learning_logs ml WHERE ml.trade_date=p.trade_date ORDER BY ml.created_at DESC LIMIT 1) market_pattern
  FROM latest p JOIN daily_stock_results d ON d.code=p.code AND d.date::date=p.trade_date WHERE d.price>0
 ), upserted AS(
  INSERT INTO trend_pullback_reversal_observations(trade_date,code,rsi_band,macd_key,vwap_key,ema20_key,prior_3record_return,market_pattern,observation_flag,validation_mode,signal_version,updated_at)
  SELECT trade_date,code,rsi_band,macd_key,vwap_key,ema20_key,
   ROUND((100.0*(current_price-price_3records_ago)/NULLIF(price_3records_ago,0))::numeric,4),market_pattern,
   rsi_band='RSI_45_60' AND macd_key='MACD_GC' AND vwap_key='VWAP_BELOW' AND ema20_key='EMA20_ABOVE'
    AND 100.0*(current_price-price_3records_ago)/NULLIF(price_3records_ago,0)<-5,
   'FORWARD','TPR_V1',NOW()
  FROM current_rows
  ON CONFLICT(trade_date,code) DO UPDATE SET rsi_band=EXCLUDED.rsi_band,macd_key=EXCLUDED.macd_key,vwap_key=EXCLUDED.vwap_key,
   ema20_key=EXCLUDED.ema20_key,prior_3record_return=EXCLUDED.prior_3record_return,market_pattern=EXCLUDED.market_pattern,
   observation_flag=EXCLUDED.observation_flag,updated_at=NOW()
  RETURNING observation_flag)
 SELECT COUNT(*)::int saved,COUNT(*)FILTER(WHERE observation_flag)::int flagged FROM upserted`,[targetDate]);
 return {tprSaved:Number(result.rows[0]?.saved??0),tprFlagged:Number(result.rows[0]?.flagged??0)};
}

export async function updateTrendPullbackReversalOutcomes(targetDate:string){
 const result=await pool.query(`
 WITH c AS(
  SELECT h.id,b.price::numeric base_price,
   (SELECT d.price::numeric FROM daily_stock_results d WHERE d.code=h.code AND d.date::date>h.trade_date AND d.date::date<=$1::date ORDER BY d.date::date OFFSET 0 LIMIT 1)p1,
   (SELECT d.price::numeric FROM daily_stock_results d WHERE d.code=h.code AND d.date::date>h.trade_date AND d.date::date<=$1::date ORDER BY d.date::date OFFSET 2 LIMIT 1)p3,
   (SELECT d.price::numeric FROM daily_stock_results d WHERE d.code=h.code AND d.date::date>h.trade_date AND d.date::date<=$1::date ORDER BY d.date::date OFFSET 4 LIMIT 1)p5
  FROM trend_pullback_reversal_observations h JOIN daily_stock_results b ON b.code=h.code AND b.date::date=h.trade_date
  WHERE h.observation_flag=true AND h.trade_date<$1::date AND(h.result_1d IS NULL OR h.result_3d IS NULL OR h.result_5d IS NULL))
 UPDATE trend_pullback_reversal_observations h SET
  result_1d=COALESCE(h.result_1d,CASE WHEN c.p1 IS NOT NULL THEN ROUND((100.0*(c.p1-c.base_price)/NULLIF(c.base_price,0))::numeric,4)END),
  result_3d=COALESCE(h.result_3d,CASE WHEN c.p3 IS NOT NULL THEN ROUND((100.0*(c.p3-c.base_price)/NULLIF(c.base_price,0))::numeric,4)END),
  result_5d=COALESCE(h.result_5d,CASE WHEN c.p5 IS NOT NULL THEN ROUND((100.0*(c.p5-c.base_price)/NULLIF(c.base_price,0))::numeric,4)END),updated_at=NOW()
 FROM c WHERE h.id=c.id RETURNING h.id`,[targetDate]);
 return {tprOutcomesUpdated:result.rowCount??0};
}
