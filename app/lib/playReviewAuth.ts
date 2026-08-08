import "server-only";

import bcrypt from "bcryptjs";

export const PLAY_REVIEW_PROVIDER_ID = "play-review";

type PlayReviewConfig = {
  email: string;
  passwordHash: string;
  accountId: string;
  credentialVersion: string;
};

type HeaderValue = string | string[] | undefined;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getPlayReviewConfig(): PlayReviewConfig | null {
  if (
    process.env.VERCEL_ENV !== "production" ||
    process.env.PLAY_REVIEW_AUTH_ENABLED !== "true"
  ) {
    return null;
  }

  const email = normalizeEmail(process.env.PLAY_REVIEW_EMAIL ?? "");
  const passwordHash = process.env.PLAY_REVIEW_PASSWORD_HASH ?? "";
  const accountId = process.env.PLAY_REVIEW_ACCOUNT_ID?.trim() ?? "";
  const credentialVersion =
    process.env.PLAY_REVIEW_CREDENTIAL_VERSION?.trim() ?? "";

  if (!email || !passwordHash || !accountId || !credentialVersion) {
    return null;
  }

  return { email, passwordHash, accountId, credentialVersion };
}

export function isPlayReviewAuthEnabled(): boolean {
  return getPlayReviewConfig() !== null;
}

export async function authorizePlayReview(
  credentials: Record<string, unknown> | undefined,
  headers: Record<string, HeaderValue>
) {
  const config = getPlayReviewConfig();
  if (!config) return null;

  try {
    const {
      clearReviewLoginFailures,
      createReviewLoginIdentifier,
      isReviewLoginAllowed,
      recordReviewLoginFailure,
    } = await import("@/app/lib/playReviewRateLimit");
    const identifierHash = createReviewLoginIdentifier(
      headers,
      config.credentialVersion
    );

    if (!(await isReviewLoginAllowed(identifierHash))) {
      return null;
    }

    const submittedEmail =
      typeof credentials?.email === "string"
        ? normalizeEmail(credentials.email)
        : "";
    const submittedPassword =
      typeof credentials?.password === "string" &&
      credentials.password.length <= 1024
        ? credentials.password
        : "";

    const [emailMatches, passwordMatches] = await Promise.all([
      Promise.resolve(submittedEmail === config.email),
      bcrypt.compare(submittedPassword, config.passwordHash),
    ]);

    if (!emailMatches || !passwordMatches) {
      await recordReviewLoginFailure(identifierHash);
      return null;
    }

    await clearReviewLoginFailures(identifierHash);

    return {
      id: config.accountId,
      email: config.email,
      name: "Google Play Reviewer",
      image: null,
    };
  } catch (error) {
    // Rate-limit storage or password verification failures must fail closed.
    console.error(
      "Play review authentication failed safely:",
      error instanceof Error ? error.message : "unknown internal error"
    );
    return null;
  }
}
