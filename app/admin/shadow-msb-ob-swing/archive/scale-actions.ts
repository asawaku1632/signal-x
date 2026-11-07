"use server";
import {notFound,redirect} from "next/navigation";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";

/** Independent owner-only 5 -> up-to-50 shadow-research switch. */
export async function setMsbScaleEnabled(form:FormData):Promise<void>{
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  const choice=form.get("enabled");
  if(choice!=="on"&&choice!=="off")redirect("/admin/shadow-msb-ob-swing/archive?scale=invalid");
  try{
    const enabled=choice==="on";
    const q=await pool.query(
      "UPDATE public.msb_volume_scale_control SET enabled=$1,extra_batches=$2,updated_at=now() "+
      "WHERE id=true RETURNING enabled",[enabled,enabled?9:0]
    );
    if(!q.rowCount)throw new Error("MSB_SCALE_CONTROL_MISSING");
  }catch(err){
    console.error("owner MSB scale switch unavailable",err);
    redirect("/admin/shadow-msb-ob-swing/archive?scale=error");
  }
  redirect("/admin/shadow-msb-ob-swing/archive?scale="+choice);
}
