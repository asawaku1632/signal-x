import pool from "@/app/lib/postgres";

export async function cancelPaperTrade(userEmail: string, id: number) {
  const result = await pool.query(
    `DELETE FROM public.paper_trades WHERE id=$1 AND user_email=$2 AND status='OPEN'`,
    [id, userEmail.trim().toLowerCase()]
  );
  return (result.rowCount ?? 0) > 0;
}
