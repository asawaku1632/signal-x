import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { isSingleAccountLearningOwner } from "@/app/lib/learningOwnerAccess";

/**
 * The private research hub is restricted to ONE configured account.
 * ADMIN_EMAILS may contain other administrators, so never use that list here.
 * An optional explicit single-owner email takes precedence over ADMIN_EMAIL.
 * Invalid/missing/multiple owner addresses fail closed.
 */
export function isLearningOwnerEmail(
  email: string | null | undefined,
  configuredOwner = process.env.SIGNALX_LEARNING_OWNER_EMAIL || process.env.ADMIN_EMAIL,
): boolean {
  return isSingleAccountLearningOwner(email, configuredOwner);
}

export async function getLearningOwnerSession() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase() ?? null;
  return { email, isOwner: isLearningOwnerEmail(email) };
}
