import { getServerSession } from "next-auth";

import { authOptions } from "@/app/lib/auth";

function configuredAdminEmails() {
  return [process.env.ADMIN_EMAIL, process.env.ADMIN_EMAILS]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  const adminEmails = configuredAdminEmails();
  const isAdmin = Boolean(email && adminEmails.includes(email));

  return { session, email: email ?? null, isAdmin };
}
