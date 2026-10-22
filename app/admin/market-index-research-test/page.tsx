import { getAdminSession } from "@/app/lib/admin";
import ResearchConnectionTest from "./ResearchConnectionTest";

export const dynamic = "force-dynamic";

export default async function ResearchConnectionTestPage() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin || process.env.VERCEL_ENV !== "preview") {
    return <main style={{ padding: 24 }}>研究用Previewの管理者専用ページです。</main>;
  }
  return <ResearchConnectionTest />;
}
