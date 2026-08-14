import pool from "@/app/lib/postgres";

export const BB_OBSERVATION_LOCK_LEASE_SECONDS = 3 * 60;

function lockKey(targetDate: string) {
  return `signalx-bb-observation:${targetDate}`;
}

const EVALUATION_LOCK_KEY = "signalx-bb-evaluation";

async function tryAcquireLock(key: string, ownerId: string) {
  const { rows } = await pool.query(
    `INSERT INTO cron_execution_locks (lock_key, owner_id, acquired_at, expires_at)
     VALUES ($1, $2, NOW(), NOW() + ($3 * INTERVAL '1 second'))
     ON CONFLICT (lock_key) DO UPDATE SET
       owner_id = EXCLUDED.owner_id,
       acquired_at = EXCLUDED.acquired_at,
       expires_at = EXCLUDED.expires_at
     WHERE cron_execution_locks.expires_at <= NOW()
     RETURNING lock_key, owner_id, acquired_at, expires_at`,
    [key, ownerId, BB_OBSERVATION_LOCK_LEASE_SECONDS],
  );
  return rows[0] ?? null;
}

async function releaseLock(key: string, ownerId: string) {
  await pool.query(
    "DELETE FROM cron_execution_locks WHERE lock_key = $1 AND owner_id = $2",
    [key, ownerId],
  );
}

export async function tryAcquireBbObservationLock(targetDate: string, ownerId: string) {
  return tryAcquireLock(lockKey(targetDate), ownerId);
}

export async function releaseBbObservationLock(targetDate: string, ownerId: string) {
  await releaseLock(lockKey(targetDate), ownerId);
}

export function tryAcquireBbEvaluationLock(ownerId: string) {
  return tryAcquireLock(EVALUATION_LOCK_KEY, ownerId);
}

export function releaseBbEvaluationLock(ownerId: string) {
  return releaseLock(EVALUATION_LOCK_KEY, ownerId);
}
