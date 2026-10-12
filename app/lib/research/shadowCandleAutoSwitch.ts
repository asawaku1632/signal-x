import "server-only";
import pool from "@/app/lib/postgres";

/** Fail closed if the owner switch is unavailable or explicitly disabled. */
export async function getShadowAutoSwitch(): Promise<boolean> {
  const result = await pool.query<{ enabled: boolean }>(
    "SELECT enabled FROM public.shadow_candle_auto_control WHERE id=true LIMIT 1",
  );
  return result.rows[0]?.enabled === true;
}
