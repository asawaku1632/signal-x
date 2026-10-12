"use server";
import { notFound,redirect } from "next/navigation";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import pool from "@/app/lib/postgres";

/** Independent MSB-only kill switch. Always owner-gated and fail closed. */
export async function setMsbAutoEnabled(form:FormData):Promise<void>{
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  const value=form.get("enabled");
  if(value!=="on"&&value!=="off")redirect("/admin/shadow-msb-ob-swing/archive?auto=invalid");
  try{
    const r=await pool.query(
      "UPDATE public.msb_volume_auto_control SET enabled=$1,updated_at=now() "+
      "WHERE id=true RETURNING enabled",[value==="on"]
    );
    if(!r.rows.length)throw new Error("MSB_SWITCH_MISSING");
  }catch(error){
    console.error("owner MSB automatic-research switch failed",error);
    redirect("/admin/shadow-msb-ob-swing/archive?auto=error");
  }
  redirect("/admin/shadow-msb-ob-swing/archive?auto="+(value==="on"?"on":"off"));
}
