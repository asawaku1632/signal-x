import Link from "next/link";
import { getAdminSession } from "@/app/lib/admin";
import EmaSignalWorkbench from "./EmaSignalWorkbench";

export const dynamic = "force-dynamic";

export default async function EmaSignalsPage() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-black">EMA売買サイン研究</h1>
        <p className="mt-4">管理者としてログインしてください。</p>
        <Link href="/login" className="mt-4 inline-block text-blue-600">ログイン画面へ</Link>
      </main>
    );
  }
  return <EmaSignalWorkbench />;
}
