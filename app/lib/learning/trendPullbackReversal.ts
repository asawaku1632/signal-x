import pool from "@/app/lib/postgres";

export async function saveTrendPullbackReversalObservations(targetDate:string){
 const result=await pool.query(`
 WITH latest AS(
  SELECT DISTINCT ON(code,trade_date) code,trade_date,rsi_band,macd_key,vwap_key,ema20_key,created_at
  FROM pattern_learning_logs WHERE trade_date=$1::date
  ORDER BY code,trade_date,created_at DESC
 ), current_rows AS(
  SELECT p.*,d.price::numeric current_price,
   (SELECT historical.price FROM (
     SELECT DISTINCT ON (d3.date::date) d3.date::date AS trade_date,d3.price::numeric AS price
     FROM daily_stock_results d3
     WHERE d3.code=p.code AND d3.date::date<p.trade_date AND d3.price>0
       AND d3.created_at <= (p.created_at AT TIME ZONE 'UTC')
     ORDER BY d3.date::date DESC,d3.created_at DESC
   ) historical ORDER BY historical.trade_date DESC OFFSET 2 LIMIT 1) price_3records_ago,
   (SELECT ml.market_pattern FROM market_learning_logs ml
    WHERE ml.trade_date=p.trade_date AND ml.created_at<=p.created_at
    ORDER BY ml.created_at DESC LIMIT 1) market_pattern
  FROM latest p
  JOIN LATERAL (
    SELECT d0.price FROM daily_stock_results d0
    WHERE d0.code=p.code AND d0.date::date=p.trade_date AND d0.price>0
      AND d0.created_at <= (p.created_at AT TIME ZONE 'UTC')
    ORDER BY d0.created_at DESC LIMIT 1
  ) d ON TRUE
 ), upserted AS(
  INSERT INTO trend_pullback_reversal_observations(trade_date,code,rsi_band,macd_key,vwap_key,ema20_key,prior_3record_return,market_pattern,observation_flag,validation_mode,signal_version,updated_at)
  SELECT trade_date,code,rsi_band,macd_key,vwap_key,ema20_key,
   ROUND((100.0*(current_price-price_3records_ago)/NULLIF(price_3records_ago,0))::numeric,4),market_pattern,
   rsi_band='RSI_45_60' AND macd_key='MACD_GC' AND vwap_key='VWAP_BELOW' AND ema20_key='EMA20_ABOVE'
    AND 100.0*(current_price-price_3records_ago)/NULLIF(price_3records_ago,0)<-5,
   'FORWARD','TPR_V1',NOW()
  FROM current_rows
  ON CONFLICT(trade_date,code) DO NOTHING
  RETURNING observation_flag)
 SELECT COUNT(*)::int saved,COUNT(*)FILTER(WHERE observation_flag)::int flagged FROM upserted`,[targetDate]);
 return {tprSaved:Number(result.rows[0]?.saved??0),tprFlagged:Number(result.rows[0]?.flagged??0)};
}

export async function updateTrendPullbackReversalOutcomes(targetDate:string){
 const result=await pool.query(`
 WITH pending AS (
  SELECT h.id,h.code,h.trade_date
  FROM trend_pullback_reversal_observations h
  WHERE h.observation_flag=true AND h.trade_date<$1::date
   AND (h.result_1d IS NULL OR h.result_3d IS NULL OR h.result_5d IS NULL)
 ), prices AS (
  SELECT p.id,base.price AS base_price,future.p1,future.p3,future.p5
  FROM pending p
  LEFT JOIN LATERAL (
   SELECT d.price::numeric AS price
   FROM daily_stock_results d
   WHERE d.code=p.code AND d.date=p.trade_date::text AND d.price>0
   ORDER BY d.created_at DESC LIMIT 1
  ) base ON TRUE
  LEFT JOIN LATERAL (
   SELECT MAX(price) FILTER (WHERE rn=1) AS p1,
          MAX(price) FILTER (WHERE rn=3) AS p3,
          MAX(price) FILTER (WHERE rn=5) AS p5
   FROM (
    SELECT daily_price.price,ROW_NUMBER() OVER (ORDER BY daily_price.trade_date) AS rn
    FROM (
     SELECT DISTINCT ON (d.date) d.date AS trade_date,d.price::numeric AS price
     FROM daily_stock_results d
     WHERE d.code=p.code AND d.date>p.trade_date::text
      AND d.date<=$1::date::text AND d.price>0
     ORDER BY d.date,d.created_at DESC
    ) daily_price
    ORDER BY daily_price.trade_date LIMIT 5
   ) ranked
  ) future ON TRUE
 )
 UPDATE trend_pullback_reversal_observations h SET
  result_1d=COALESCE(h.result_1d,CASE WHEN c.base_price>0 AND c.p1>0 THEN ROUND((100.0*(c.p1-c.base_price)/c.base_price)::numeric,4) END),
  result_3d=COALESCE(h.result_3d,CASE WHEN c.base_price>0 AND c.p3>0 THEN ROUND((100.0*(c.p3-c.base_price)/c.base_price)::numeric,4) END),
  result_5d=COALESCE(h.result_5d,CASE WHEN c.base_price>0 AND c.p5>0 THEN ROUND((100.0*(c.p5-c.base_price)/c.base_price)::numeric,4) END),
  updated_at=NOW()
 FROM prices c WHERE h.id=c.id AND c.base_price>0
  AND (c.p1 IS NOT NULL OR c.p3 IS NOT NULL OR c.p5 IS NOT NULL)
 RETURNING h.id`,[targetDate]);
 return {tprOutcomesUpdated:result.rowCount??0};
}
