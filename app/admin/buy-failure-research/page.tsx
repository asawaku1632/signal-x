import { getAdminSession } from "@/app/lib/admin";
import ResearchClient from "./ResearchClient";

export const dynamic = "force-dynamic";

export default async function BuyFailureResearchPage() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return <main className="mx-auto max-w-2xl px-4 py-12 text-sm" role="alert">
      この研究ページは管理者のみ閲覧できます。
    </main>;
  }
  return <ResearchClient />;
}
