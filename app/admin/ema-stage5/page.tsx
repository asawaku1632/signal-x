import Link from "next/link";
import { getAdminSession } from "@/app/lib/admin";
import EmaStage5Client from "./EmaStage5Client";

export const dynamic = "force-dynamic";

export default async function EmaStage5Page() {
  const {isAdmin} = await getAdminSession();
  if (!isAdmin) return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-black">EMA＋BB複合条件検証</h1>
      <p className="mt-4">管理者としてログインしてください。</p>
      <Link href="/login" className="text-blue-600">ログイン画面へ</Link>
    </main>
  );
  return <EmaStage5Client />;
}
