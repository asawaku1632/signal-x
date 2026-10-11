import { getAdminSession } from "@/app/lib/admin";
import MorningGapResearchClient from "./MorningGapResearchClient";

export const dynamic = "force-dynamic";

export default async function MorningGapResearchPage() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12">
        <h1 className="text-2xl font-black">管理者専用の研究ページ</h1>
        <p className="mt-4">このページはSIGNALXの管理者のみ利用できます。</p>
      </main>
    );
  }
  return <MorningGapResearchClient />;
}