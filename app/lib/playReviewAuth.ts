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

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;

function isValidBcryptHash(value: string): boolean {
  return BCRYPT_HASH_PATTERN.test(value);
}

function logReviewConfigDiagnostics(): void {
  const email = process.env.PLAY_REVIEW_EMAIL ?? "";
  const passwordHash = process.env.PLAY_REVIEW_PASSWORD_HASH ?? "";

  console.info("[play-review-diagnostic] configuration", {
    emailConfigured: email.trim().length > 0,
    passwordHashConfigured: passwordHash.length > 0,
    passwordHashFormatValid: isValidBcryptHash(passwordHash),
  });
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getPlayReviewConfig(): PlayReviewConfig | null {
  logReviewConfigDiagnostics();

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
      logReviewDatabaseAccessDiagnostics,
      recordReviewLoginFailure,
    } = await import("@/app/lib/playReviewRateLimit");
    const identifierHash = createReviewLoginIdentifier(
      headers,
      config.credentialVersion
    );

    await logReviewDatabaseAccessDiagnostics();

    const rateLimitAllowed = await isReviewLoginAllowed(identifierHash);
    console.info("[play-review-diagnostic] rate limit", {
      decision: rateLimitAllowed ? "allowed" : "blocked",
    });
    if (!rateLimitAllowed) {
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

    const emailMatches = submittedEmail === config.email;
    const passwordMatches =
      isValidBcryptHash(config.passwordHash) &&
      (await bcrypt.compare(submittedPassword, config.passwordHash));

    console.info("[play-review-diagnostic] credential checks", {
      emailMatches,
      bcryptCompareResult: passwordMatches,
    });

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
    const postgresCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      /^[0-9A-Z]{5}$/.test(error.code)
        ? error.code
        : "unavailable";
    console.error("[play-review-diagnostic] authentication", {
      outcome: "failed_safely",
      postgresCode,
    });
    return null;
  }
}
