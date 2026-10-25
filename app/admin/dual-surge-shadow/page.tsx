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
  <p className="mt-4 rounded-lg border p-3 text-sm text-slate-700">J-Quantsの研究利用許可は現在確認中です。管理者限定でも許可が自動的に成立するわけではありません。許可確認まで生データの自動取得は行いません。</p>
  <DualSurgeClient/>
 </main>;
}
