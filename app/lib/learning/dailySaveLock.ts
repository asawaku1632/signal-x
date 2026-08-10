import pool from "@/app/lib/postgres";

const LOCK_LEASE_SECONDS = 4 * 60;

function isMissingLockTable(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "42P01",
  );
}

export async function tryAcquireDailySaveLock(targetDate: string, ownerId: string) {
  const lockKey = `signalx-save-daily:${targetDate}`;
  try {
    const { rows } = await pool.query(
      `INSERT INTO cron_execution_locks (lock_key, owner_id, acquired_at, expires_at)
       VALUES ($1, $2, NOW(), NOW() + ($3 * INTERVAL '1 second'))
       ON CONFLICT (lock_key) DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         acquired_at = EXCLUDED.acquired_at,
         expires_at = EXCLUDED.expires_at
       WHERE cron_execution_locks.expires_at <= NOW()
       RETURNING lock_key, owner_id, acquired_at, expires_at`,
      [lockKey, ownerId, LOCK_LEASE_SECONDS],
    );
    return rows[0] ?? null;
  } catch (error) {
    if (isMissingLockTable(error)) {
      throw new Error(
        "cron_execution_locks table is missing; apply scripts/migrations/20260810_create_cron_execution_locks.sql before deployment",
        { cause: error },
      );
    }
    throw error;
  }
}

export async function releaseDailySaveLock(targetDate: string, ownerId: string) {
  const lockKey = `signalx-save-daily:${targetDate}`;
  await pool.query(
    "DELETE FROM cron_execution_locks WHERE lock_key = $1 AND owner_id = $2",
    [lockKey, ownerId],
  );
}
