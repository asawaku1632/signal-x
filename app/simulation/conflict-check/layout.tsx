import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OwnerConflictLayout({ children }: { children: ReactNode }) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();
  return children;
}
