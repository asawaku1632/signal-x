import { createHmac } from "node:crypto";
/**
 * Fingerprint only: not authentication, not a purchase validation.
 * Use a dedicated high-entropy secret from a trusted server environment.
 * Secret rotation requires a versioned migration strategy before production.
 */
export function fingerprintPlayPurchaseToken(rawToken: string, secret: string): string {
  if (typeof rawToken !== "string" || !rawToken.trim() || rawToken.length > 4096 ||
      typeof secret !== "string" || secret.length < 32) {
    throw new Error("Invalid fingerprint input");
  }
  return createHmac("sha256", secret).update("signalx:google_play:token:v1\0").update(rawToken).digest("hex");
}
