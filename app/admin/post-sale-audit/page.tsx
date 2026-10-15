import { notFound } from "next/navigation";
import Link from "next/link";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import PostSaleClient from "./PostSaleClient";
export const dynamic = "force-dynamic";
export default async function OwnerPostSalePage() {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();
  return <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
    <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-600">← 学習管理室へ</Link>
    <h1 className="mt-4 text-2xl font-black text-slate-900">📊 売却後の答え合わせ</h1>
    <p className="mt-2 text-sm leading-6 text-slate-600">楽天証券などで実際に売却した取引を記録し、その後の1・3・5営業日を自動追跡する本人専用の研究です。</p>
    <PostSaleClient />
  </main>;
}
