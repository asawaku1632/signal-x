import { createHmac } from "node:crypto";

import pool from "@/app/lib/postgres";

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;
const BLOCK_MINUTES = 15;

type HeaderValue = string | string[] | undefined;

function getHeader(
  headers: Record<string, HeaderValue>,
  name: string
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function createReviewLoginIdentifier(
  headers: Record<string, HeaderValue>,
  secret: string
): string {
  const forwardedFor = getHeader(headers, "x-forwarded-for");
  const clientIp =
    forwardedFor?.split(",")[0]?.trim() ||
    getHeader(headers, "x-real-ip")?.trim() ||
    "unknown";

  return createHmac("sha256", secret)
    .update(`play-review:${clientIp}`)
    .digest("hex");
}

export async function isReviewLoginAllowed(
  identifierHash: string
): Promise<boolean> {
  const result = await pool.query<{ blocked_until: Date | string | null }>(
    `
      SELECT blocked_until
      FROM public.play_review_login_attempts
      WHERE identifier_hash = $1
      LIMIT 1
    `,
    [identifierHash]
  );

  const blockedUntil = result.rows[0]?.blocked_until;
  return !blockedUntil || new Date(blockedUntil).getTime() <= Date.now();
}

export async function recordReviewLoginFailure(
  identifierHash: string
): Promise<void> {
  await pool.query(
    `
      INSERT INTO public.play_review_login_attempts AS attempts (
        identifier_hash,
        failure_count,
        window_started_at,
        blocked_until,
        updated_at
      )
      VALUES ($1, 1, NOW(), NULL, NOW())
      ON CONFLICT (identifier_hash)
      DO UPDATE SET
        failure_count = CASE
          WHEN attempts.window_started_at <= NOW() - ($2::int * INTERVAL '1 minute')
            THEN 1
          ELSE attempts.failure_count + 1
        END,
        window_started_at = CASE
          WHEN attempts.window_started_at <= NOW() - ($2::int * INTERVAL '1 minute')
            THEN NOW()
          ELSE attempts.window_started_at
        END,
        blocked_until = CASE
          WHEN attempts.window_started_at <= NOW() - ($2::int * INTERVAL '1 minute')
            THEN NULL
          WHEN attempts.failure_count + 1 >= $3::int
            THEN NOW() + ($4::int * INTERVAL '1 minute')
          ELSE attempts.blocked_until
        END,
        updated_at = NOW()
    `,
    [identifierHash, WINDOW_MINUTES, MAX_FAILURES, BLOCK_MINUTES]
  );
}

export async function clearReviewLoginFailures(
  identifierHash: string
): Promise<void> {
  await pool.query(
    `DELETE FROM public.play_review_login_attempts WHERE identifier_hash = $1`,
    [identifierHash]
  );
}
