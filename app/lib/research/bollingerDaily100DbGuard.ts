/** Fail-closed gate for the isolated daily-100 ledger.
 * This gate must run before ANY read/write through the shared Postgres pool.
 * An explicit dev project ref must be present in the DATABASE_URL username or hostname.
 */
export const DAILY100_DEV_PROJECT_REF = "jdtqwryiyxeuoraecorw";
export function assertDaily100DevDatabase(env: {
  VERCEL_ENV?: string;
  BB_DAILY100_DB_WRITE_ENABLED?: string;
  DATABASE_URL?: string;
}): void {
  if (env.VERCEL_ENV === "production" ||
      env.BB_DAILY100_DB_WRITE_ENABLED !== "true" ||
      !env.DATABASE_URL) {
    throw Error("DAILY100_DEV_DB_WRITE_BLOCKED");
  }
  let url: URL;
  try { url = new URL(env.DATABASE_URL); }
  catch { throw Error("DAILY100_DEV_DB_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw Error("DAILY100_DEV_DB_URL_INVALID");
  }
  const identity = [url.hostname, decodeURIComponent(url.username)].join(":");
  if (!identity.includes(DAILY100_DEV_PROJECT_REF)) {
    throw Error("DAILY100_DEV_DB_PROJECT_MISMATCH");
  }
}
