import { getAdminSession } from "@/app/lib/admin";
import ResearchClient from "./research-client";

export const dynamic = "force-dynamic";

export default async function MarketIndexResearchPage() {
  const { session, isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-bold">管理者専用ページ</h1>
        <p className="mt-3">この研究画面は管理者本人のみ閲覧できます。</p>
        {session ? (
          <p className="mt-3">現在のアカウントには管理者権限がありません。</p>
        ) : (
          <a href="/login" className="mt-4 inline-block underline">ログインする</a>
        )}
      </main>
    );
  }
  return <ResearchClient />;
}
