import { notFound } from "next/navigation";
import { getAdminSession } from "@/app/lib/admin";
import AdminWinRateRankingClient from "./AdminWinRateRankingClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminWinRateRankingPage() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) notFound();

  return <AdminWinRateRankingClient />;
}
