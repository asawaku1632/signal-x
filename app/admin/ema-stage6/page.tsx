import Link from "next/link";
import {getAdminSession} from "@/app/lib/admin";
import EmaExitClient from "./EmaExitClient";
export const dynamic="force-dynamic";
export default async function EmaStage6Page(){
  const {isAdmin}=await getAdminSession();
  if(!isAdmin)return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-black">EMA出口戦略研究</h1><p className="mt-3">管理者としてログインしてください。</p><Link href="/login" className="text-blue-600">ログイン画面へ</Link></main>;
  return <EmaExitClient/>;
}
