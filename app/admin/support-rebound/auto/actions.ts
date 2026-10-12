"use server";
import pool from "@/app/lib/postgres";
import { getAdminSession } from "@/app/lib/admin";
import { revalidatePath } from "next/cache";

/** Owner-only emergency stop/control. The database migration defaults OFF. */
export async function setReboundForwardAuto(formData:FormData) {
  const {isAdmin}=await getAdminSession();
  if(!isAdmin)throw new Error("ADMIN_REQUIRED");
  const enabled=formData.get("enabled")==="on";
  const result=await pool.query(
    "UPDATE public.rebound_forward_control SET enabled=$1,updated_at=now() "+
    "WHERE singleton=1 RETURNING enabled",[enabled]);
  if(result.rowCount!==1)throw new Error("RESEARCH_CONTROL_NOT_INSTALLED");
  revalidatePath("/admin/support-rebound/auto");
}
