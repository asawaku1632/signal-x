import { createHmac } from "node:crypto";

import pool from "@/app/lib/postgres";

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;
const BLOCK_MINUTES = 15;

type HeaderValue = string | string[] | undefined;

function getPostgresErrorCode(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[0-9A-Z]{5}$/.test(error.code)
    ? error.code
    : "unavailable";
}

export async function logReviewDatabaseAccessDiagnostics(): Promise<void> {
  try {
    const result = await pool.query<{
      rls_enabled: boolean;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT
        c.relrowsecurity AS rls_enabled,
        has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
        has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
        has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
        has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'play_review_login_attempts'
      LIMIT 1
    `);
    const access = result.rows[0];

    console.info("[play-review-diagnostic] database access", {
      metadataQuery: "success",
      tableFound: Boolean(access),
      rlsEnabled: access?.rls_enabled ?? false,
      selectAllowed: access?.can_select ?? false,
      insertAllowed: access?.can_insert ?? false,
      updateAllowed: access?.can_update ?? false,
      deleteAllowed: access?.can_delete ?? false,
      postgresCode: "none",
    });
  } catch (error) {
    console.error("[play-review-diagnostic] database access", {
      metadataQuery: "failed",
      postgresCode: getPostgresErrorCode(error),
    });
    throw error;
  }
}

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
  try {
    const result = await pool.query<{ blocked_until: Date | string | null }>(
      `
        SELECT blocked_until
        FROM public.play_review_login_attempts
        WHERE identifier_hash = $1
        LIMIT 1
      `,
      [identifierHash]
    );
    console.info("[play-review-diagnostic] database SELECT", {
      outcome: "success",
      postgresCode: "none",
    });

    const blockedUntil = result.rows[0]?.blocked_until;
    return !blockedUntil || new Date(blockedUntil).getTime() <= Date.now();
  } catch (error) {
    console.error("[play-review-diagnostic] database SELECT", {
      outcome: "failed",
      postgresCode: getPostgresErrorCode(error),
    });
    throw error;
  }
}

export async function recordReviewLoginFailure(
  identifierHash: string
): Promise<void> {
  try {
    const result = await pool.query<{ inserted: boolean }>(
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
        RETURNING (xmax = 0) AS inserted
      `,
      [identifierHash, WINDOW_MINUTES, MAX_FAILURES, BLOCK_MINUTES]
    );
    console.info("[play-review-diagnostic] database INSERT/UPDATE", {
      outcome: result.rows[0]?.inserted ? "insert_success" : "update_success",
      postgresCode: "none",
    });
  } catch (error) {
    console.error("[play-review-diagnostic] database INSERT/UPDATE", {
      outcome: "failed",
      postgresCode: getPostgresErrorCode(error),
    });
    throw error;
  }
}

export async function clearReviewLoginFailures(
  identifierHash: string
): Promise<void> {
  try {
    await pool.query(
      `DELETE FROM public.play_review_login_attempts WHERE identifier_hash = $1`,
      [identifierHash]
    );
    console.info("[play-review-diagnostic] database DELETE", {
      outcome: "success",
      postgresCode: "none",
    });
  } catch (error) {
    console.error("[play-review-diagnostic] database DELETE", {
      outcome: "failed",
      postgresCode: getPostgresErrorCode(error),
    });
    throw error;
  }
}
