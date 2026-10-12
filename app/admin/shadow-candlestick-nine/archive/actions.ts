"use server";

import { notFound, redirect } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";

/** Research-only kill switch; never updates AI, LINE, scans, learning, portfolio. */
export async function setShadowAutoEnabled(form: FormData) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();
  const choice = form.get("enabled");
  if (choice !== "on" && choice !== "off") {
    redirect("/admin/shadow-candlestick-nine/archive?auto=invalid");
  }
  try {
    const result = await pool.query(`
      UPDATE public.shadow_candle_auto_control
      SET enabled=$1, updated_at=now() WHERE id=true
      RETURNING enabled
    `, [choice === "on"]);
    if (!result.rows[0]) throw new Error("SWITCH_NOT_INITIALIZED");
  } catch (error) {
    console.error("owner auto research switch failed", error);
    redirect("/admin/shadow-candlestick-nine/archive?auto=error");
  }
  redirect("/admin/shadow-candlestick-nine/archive");
}
