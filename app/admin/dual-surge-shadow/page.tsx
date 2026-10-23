import {notFound} from "next/navigation";
import Link from "next/link";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import DualSurgeClient from "./DualSurgeClient";
export const dynamic="force-dynamic";
export default async function DualSurgePage(){
 const {isOwner}=await getLearningOwnerSession();
 if(!isOwner)notFound();
 return <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
  <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-600">← 学習管理室へ</Link>
  <h1 className="mt-4 text-2xl font-black text-slate-900">🚀 急騰前兆・急騰開始の独立研究</h1>
  <p className="mt-2 text-sm text-slate-600">管理者専用・事前固定のシャドー研究。実際の売買判断、通知、ランキングとは接続していません。未取得・未検証を成功として扱いません。</p>
  <DualSurgeClient/>
 </main>;
}
