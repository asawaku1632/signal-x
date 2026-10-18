/**
 * Isolated Google Play Integrity REST decoder.
 *
 * OAuth access tokens MUST be obtained server-side from a Google service
 * account with scope https://www.googleapis.com/auth/playintegrity.
 * This is NOT an API route, an OAuth credential loader, or live wiring.
 *
 * Only Google's successful decodeIntegrityToken response is accepted.
 * Never trust client-provided decoded JSON or log integrity token/bearer.
 * A decoded verdict by itself NEVER grants premium or authenticates a user;
 * playCheckoutTicketResearch additionally checks requestHash, package,
 * timestamp, Play-recognized app and signing certificate before one-use claim.
 */
export type GoogleDecodedPlayIntegrity = {
  requestDetails: {
    requestPackageName: string;
    requestHash: string;
    timestampMillis: string;
  };
  appIntegrity: {
    appRecognitionVerdict: string;
    packageName: string;
    certificateSha256Digest: string[];
  };
};

type HttpResponse = { ok: boolean; status: number; json(): Promise<unknown> };
export type IntegrityHttpPost = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<HttpResponse>;

const EXPECTED_PACKAGE_NAME = "com.signalx.app";
const API_URL =
  "https://playintegrity.googleapis.com/v1/com.signalx.app:decodeIntegrityToken";

function plainRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseGoogleVerdict(raw: unknown): GoogleDecodedPlayIntegrity | null {
  if (!plainRecord(raw) || !plainRecord(raw.tokenPayloadExternal)) return null;
  const payload = raw.tokenPayloadExternal;
  if (!plainRecord(payload.requestDetails) || !plainRecord(payload.appIntegrity)) return null;
  const d = payload.requestDetails;
  const a = payload.appIntegrity;
  // Google sends timestampMillis as a decimal string. Reject ambiguous/coerced types.
  if (
    typeof d.requestPackageName !== "string" ||
    typeof d.requestHash !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(d.requestHash) ||
    typeof d.timestampMillis !== "string" ||
    !/^[1-9][0-9]{0,15}$/.test(d.timestampMillis) ||
    typeof a.appRecognitionVerdict !== "string" ||
    typeof a.packageName !== "string" ||
    !Array.isArray(a.certificateSha256Digest) ||
    a.certificateSha256Digest.length === 0 ||
    a.certificateSha256Digest.length > 8 ||
    !a.certificateSha256Digest.every(
      (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 128,
    )
  ) return null;
  return {
    requestDetails: {
      requestPackageName: d.requestPackageName,
      requestHash: d.requestHash,
      timestampMillis: d.timestampMillis,
    },
    appIntegrity: {
      appRecognitionVerdict: a.appRecognitionVerdict,
      packageName: a.packageName,
      certificateSha256Digest: a.certificateSha256Digest as string[],
    },
  };
}

/**
 * The provided HTTP client must be trusted server-side transport. A 200
 * response means Google has decoded the integrity token, NOT that the
 * contained verdict is acceptable. That decision stays with the caller.
 */
export async function decodeGooglePlayIntegrityToken(
  opaqueIntegrityToken: string,
  oauthAccessToken: string,
  httpPost: IntegrityHttpPost,
  packageName = EXPECTED_PACKAGE_NAME,
): Promise<GoogleDecodedPlayIntegrity | null> {
  if (
    packageName !== EXPECTED_PACKAGE_NAME ||
    typeof opaqueIntegrityToken !== "string" ||
    opaqueIntegrityToken.length < 1 ||
    opaqueIntegrityToken.length > 8192 ||
    /\s/.test(opaqueIntegrityToken) ||
    typeof oauthAccessToken !== "string" ||
    !oauthAccessToken.trim() ||
    /[\r\n]/.test(oauthAccessToken) ||
    typeof httpPost !== "function"
  ) return null;
  try {
    const response = await httpPost(API_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + oauthAccessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ integrityToken: opaqueIntegrityToken }),
    });
    if (!response.ok || response.status !== 200) return null;
    return parseGoogleVerdict(await response.json());
  } catch {
    // Fail closed without revealing credential, token, or provider response.
    return null;
  }
}

/** Bind trusted server credentials/HTTP before passing to checkout redemption. */
export function createGooglePlayIntegrityDecoder(
  oauthAccessToken: string,
  httpPost: IntegrityHttpPost,
): (opaqueIntegrityToken: string) => Promise<GoogleDecodedPlayIntegrity | null> {
  return (opaqueIntegrityToken: string) =>
    decodeGooglePlayIntegrityToken(opaqueIntegrityToken, oauthAccessToken, httpPost);
}
