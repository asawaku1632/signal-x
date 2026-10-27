import pool from "@/app/lib/postgres";
import { validateMarketIndexSnapshot, type MarketIndexKey } from "./marketIndexShadowContract";

/** Owner/research server-side helper only. Never called by trading or notification paths. */
export async function saveMarketIndexShadow(input: {
  index: MarketIndexKey;
  value: unknown;
  observedAt: unknown;
  source: unknown;
  capturedAt: string;
}) {
  const checked = validateMarketIndexSnapshot(input);
  if (checked.status !== "observed") return { saved: false as const, ...checked };
  const result = await pool.query(
    `INSERT INTO public.market_index_shadow_observations
      (session_date_jst, index_key, observed_at, captured_at, index_value, source_name)
     VALUES ($1::date,$2,$3::timestamptz,$4::timestamptz,$5,$6)
     ON CONFLICT (session_date_jst,index_key,observed_at,policy_version) DO NOTHING`,
    [checked.sessionDateJst, checked.index, checked.observedAt,
      checked.capturedAt, checked.value, checked.source]
  );
  return { saved: (result.rowCount ?? 0) === 1, observation: checked };
}

/** A paired index comparison is only valid for matching session/time windows. */
export async function loadMarketIndexShadow(date: string, index: MarketIndexKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  const result = await pool.query(
    `SELECT session_date_jst::text, index_key, observed_at, captured_at,
            index_value, source_name
       FROM public.market_index_shadow_observations
      WHERE session_date_jst=$1::date AND index_key=$2
      ORDER BY observed_at ASC`,
    [date, index]
  );
  return result.rows;
}
