import "server-only";
import pool from "@/app/lib/postgres";

/** OFF or missing row -> no MSB automatic research. */
export async function getMsbAutoEnabled(): Promise<boolean> {
  const result=await pool.query<{enabled:boolean}>(
    "SELECT enabled FROM public.msb_volume_auto_control WHERE id=true LIMIT 1"
  );
  return result.rows[0]?.enabled===true;
}
