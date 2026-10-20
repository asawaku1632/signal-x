import "server-only";
import pool from "@/app/lib/postgres";
import {evaluateResearchAllStars} from "./researchAllStars.mjs";

/** Observational source adapters only. Never query win/lose training labels,
 * live scan "today" predictions or historical pattern replays to award stars.
 * DB result is grouped by a frozen signal date and verified fifth reference
 * day. Day's whole-universe reference needs >=800 symbols and >=80% outcomes.
 */
export async function readResearchAllStars(){
  const {rows}=await pool.query(`
    WITH source AS (
      SELECT 'MM_V1'::text study_key,trade_date,code,result_5d::numeric outcome,
        created_at saved_at
      FROM public.momentum_memory_observations
      WHERE validation_mode='FORWARD' AND signal_version='MM_V1'
        AND observation_flag=true AND trade_date>='2026-10-01'
      UNION ALL
      SELECT 'HAP_V1',trade_date,code,result_5d,created_at
      FROM public.high_ai_pullback_observations
      WHERE validation_mode='FORWARD' AND signal_version='HAP_V1'
        AND observation_flag=true AND trade_date>='2026-10-01'
      UNION ALL
      SELECT 'AIR_V1',trade_date,code,result_5d,created_at
      FROM public.ai_reversal_observations
      WHERE validation_mode='FORWARD' AND signal_version='AIR_V1'
        AND observation_flag=true AND trade_date>='2026-10-01'
      UNION ALL
      SELECT 'TPR_V1',trade_date,code,result_5d,created_at
      FROM public.trend_pullback_reversal_observations
      WHERE validation_mode='FORWARD' AND signal_version='TPR_V1'
        AND observation_flag=true AND trade_date>='2026-10-01'
      UNION ALL
      SELECT CASE WHEN ai_power<20 THEN 'AVOID_0_19'
                  WHEN ai_power<40 THEN 'AVOID_20_39'
                  WHEN ai_power<55 THEN 'AVOID_40_54'
                  ELSE 'AVOID_55_64' END,
        trade_date,code,return_5d,captured_at
      FROM public.swing_universe_observations
      WHERE rule_version='ai_power_only_v1' AND decision_status='AVOID'
        AND trade_date>='2026-10-01'
    ), unique_signals AS (
      SELECT DISTINCT ON (study_key,trade_date,code)
        study_key,trade_date,code,outcome
      FROM source ORDER BY study_key,trade_date,code,saved_at ASC
    ), benchmark AS (
      SELECT trade_date,COUNT(*) total,COUNT(return_5d) completed,
        AVG(return_5d) average
      FROM public.swing_universe_observations
      WHERE rule_version='ai_power_only_v1' AND trade_date>='2026-10-01'
      GROUP BY trade_date
    )
    SELECT u.study_key,u.trade_date::text,
      COUNT(*)::int total, COUNT(u.outcome)::int completed,
      COUNT(*) FILTER(WHERE u.outcome>0)::int up_count,
      COUNT(*) FILTER(WHERE u.outcome<=-5)::int deep_loss_count,
      ROUND(AVG(u.outcome),6)::text avg_return,
      ROUND(MIN(u.outcome),6)::text worst_return,
      COALESCE(ARRAY_AGG(DISTINCT u.code) FILTER(WHERE u.outcome IS NOT NULL),
        ARRAY[]::text[]) codes,
      COALESCE(MAX(b.total),0)::int benchmark_total,
      COALESCE(MAX(b.completed),0)::int benchmark_completed,
      ROUND(MAX(b.average),6)::text benchmark_average
    FROM unique_signals u LEFT JOIN benchmark b USING(trade_date)
    GROUP BY u.study_key,u.trade_date ORDER BY u.study_key,u.trade_date
  `);
  return evaluateResearchAllStars(rows);
}
