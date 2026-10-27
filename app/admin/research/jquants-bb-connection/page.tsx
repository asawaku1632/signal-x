import { redirect } from "next/navigation";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import JquantsBbConnectionButton from "./JquantsBbConnectionButton";

export const dynamic = "force-dynamic";

export default async function JquantsBbConnectionPage() {
  if (!(await getLearningOwnerSession()).isOwner) redirect("/login");
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "research/morning-quote-metadata-diagnostics-20261026") {
    return <main style={{ padding: 24 }}><h1>研究専用</h1><p>この画面は指定研究ブランチのPreviewでのみ利用できます。</p></main>;
  }
  return <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
    <h1>J-Quants接続確認（研究専用）</h1>
    <JquantsBbConnectionButton />
  </main>;
}
