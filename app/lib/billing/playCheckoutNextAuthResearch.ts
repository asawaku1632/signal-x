import "server-only";

/**
 * RESEARCH ONLY. DO NOT IMPORT INTO A PUBLIC ROUTE OR USER-VISIBLE PAGE.
 *
 * This is the real NextAuth integration seam for the pure, tested request
 * guard. It creates NO HTTP endpoint and uses NO live Google Play API.
 * Disabled unless a dedicated explicit opt-in environment variable is set.
 * Never expose the server secrets below to NEXT_PUBLIC_* settings.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import pool from "@/app/lib/postgres";
import { issueAuthenticatedPlayCheckoutResearch } from "./playCheckoutSessionGate.ts";

const ORIGIN = "https://signal-x-ppjg.vercel.app";

export async function issueFromNextAuthPlayCheckoutResearch(request: Request) {
  const enabled =
    process.env.SIGNALX_RESEARCH_PLAY_CHECKOUT_ISSUE_ENABLED === "true" &&
    process.env.NEXTAUTH_URL === ORIGIN;

  return issueAuthenticatedPlayCheckoutResearch(
    request,
    {
      enabled,
      expectedOrigin: ORIGIN,
      ticket: {
        packageName: "com.signalx.app",
        allowedProductId: process.env.SIGNALX_RESEARCH_PLAY_PRODUCT_ID ?? "",
        ticketDigestKey: process.env.SIGNALX_RESEARCH_PLAY_TICKET_HMAC_KEY ?? "",
        accountBindingKey: process.env.SIGNALX_RESEARCH_PLAY_ACCOUNT_HMAC_KEY ?? "",
      },
    },
    pool,
    // Must be resolved on the server from the signed NextAuth cookie/JWT.
    () => getServerSession(authOptions),
  );
}
