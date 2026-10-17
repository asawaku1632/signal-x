/**
 * Verification boundary only. NOT a live webhook endpoint or payment integration.
 * The trusted server caller must provide an actual provider verification adapter.
 * Never use browser/client input as a verification result.
 */
import { validateVerifiedBillingNotice, type VerifiedBillingNotice } from "./billingIngestionContract";
export type UntrustedBillingNotification = {
  provider: "stripe" | "google_play";
  rawBody: string;
  signatureOrToken: string;
};
export type ProviderVerifier = (rawBody: string, signatureOrToken: string) => Promise<VerifiedBillingNotice | null>;
export type ProviderVerifiers = {
  stripe: ProviderVerifier;
  google_play: ProviderVerifier;
};
export type VerificationResult =
  | { ok: true; notice: VerifiedBillingNotice; dedupeKey: string }
  | { ok: false; reason: "invalid_request" | "unverified" | "invalid_verified_notice" };
export async function verifyBillingNotification(
  input: UntrustedBillingNotification,
  verifiers: ProviderVerifiers,
): Promise<VerificationResult> {
  if (!input || (input.provider !== "stripe" && input.provider !== "google_play") ||
      typeof input.rawBody !== "string" || !input.rawBody ||
      typeof input.signatureOrToken !== "string" || !input.signatureOrToken.trim()) {
    return { ok: false, reason: "invalid_request" };
  }
  // Reject on verifier errors. A callback result is not intrinsically proof:
  // production adapters MUST validate Stripe signatures or Play purchase tokens.
  let notice: VerifiedBillingNotice | null;
  try {
    notice = await verifiers[input.provider](input.rawBody, input.signatureOrToken);
  } catch {
    return { ok: false, reason: "unverified" };
  }
  if (!notice || notice.provider !== input.provider) return { ok: false, reason: "unverified" };
  const validated = validateVerifiedBillingNotice(notice);
  if (!validated.accepted) return { ok: false, reason: "invalid_verified_notice" };
  return { ok: true, notice, dedupeKey: validated.dedupeKey };
}
