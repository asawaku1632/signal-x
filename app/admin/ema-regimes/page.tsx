import Link from "next/link";
import { getAdminSession } from "@/app/lib/admin";
import EmaRegimeClient from "./EmaRegimeClient";

export const dynamic = "force-dynamic";

export default async function EmaRegimePage() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-black">EMA相場環境研究</h1><p className="mt-4">管理者としてログインしてください。</p><Link href="/login" className="mt-3 inline-block text-blue-600">ログイン画面へ</Link></main>;
  }
  return <EmaRegimeClient />;
}
