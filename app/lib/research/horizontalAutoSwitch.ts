import "server-only";
import pool from "@/app/lib/postgres";

/** Absent, malformed, or OFF means absolutely no automatic market requests. */
export async function getHorizontalAutoEnabled(): Promise<boolean> {
  const r=await pool.query<{enabled:boolean}>(
    "SELECT enabled FROM public.horizontal_retest_auto_control WHERE id=true LIMIT 1"
  );
  return r.rows[0]?.enabled === true;
}
