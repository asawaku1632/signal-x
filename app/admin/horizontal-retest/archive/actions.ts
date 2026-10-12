"use server";
import { notFound, redirect } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";

/** Owner-only kill switch. No effect on production AI/LINE. */
export async function setHorizontalAutoEnabled(form:FormData) {
  const {isOwner}=await getLearningOwnerSession();
  if (!isOwner) notFound();
  const choice=form.get("enabled");
  if (choice!=="on" && choice!=="off") redirect("/admin/horizontal-retest/archive?auto=invalid");
  try {
    const r=await pool.query(
      "UPDATE public.horizontal_retest_auto_control SET enabled=$1,updated_at=now() " +
      "WHERE id=true RETURNING enabled", [choice==="on"]
    );
    if(!r.rows.length) throw new Error("AUTO_SWITCH_MISSING");
  } catch(e) {
    console.error("owner horizontal research switch failed",e);
    redirect("/admin/horizontal-retest/archive?auto=error");
  }
  redirect("/admin/horizontal-retest/archive");
}
