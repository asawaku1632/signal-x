import { randomUUID } from "node:crypto";
import pool from "@/app/lib/postgres";

export type DisplaySnapshot<T> = {
  key: string;
  payload: T;
  itemCount: number;
  updatedAt: string;
};

export type DisplaySnapshotSlice<T> = DisplaySnapshot<T> & {
  payloadStockCount: number;
};

const memorySnapshots = new Map<string, DisplaySnapshot<unknown>>();
const memoryRefreshes = new Map<string, Promise<unknown>>();

function isMissingTable(error: unknown) {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "42P01",
  );
}

export async function getDisplaySnapshot<T>(key: string) {
  try {
    const { rows } = await pool.query(
      `SELECT snapshot_key, payload, item_count, updated_at
       FROM display_snapshots
       WHERE snapshot_key = $1`,
      [key],
    );
    const row = rows[0];
    if (!row) return (memorySnapshots.get(key) as DisplaySnapshot<T> | undefined) ?? null;
    return {
      key: row.snapshot_key,
      payload: row.payload as T,
      itemCount: Number(row.item_count ?? 0),
      updatedAt: new Date(row.updated_at).toISOString(),
    } satisfies DisplaySnapshot<T>;
  } catch (error) {
    if (!isMissingTable(error)) console.warn("display snapshot read fallback:", error);
    return (memorySnapshots.get(key) as DisplaySnapshot<T> | undefined) ?? null;
  }
}

export async function getDisplaySnapshotStockSlice<T>(key: string, stockLimit: number) {
  const safeLimit = Number.isFinite(stockLimit)
    ? Math.max(0, Math.floor(stockLimit))
    : 0;
  try {
    const { rows } = await pool.query(
      `SELECT snapshot_key,
              CASE
                WHEN jsonb_typeof(payload->'stocks') = 'array' THEN
                  jsonb_set(
                    payload,
                    '{stocks}',
                    COALESCE(
                      (
                        SELECT jsonb_agg(stock.value ORDER BY stock.ordinality)
                        FROM jsonb_array_elements(payload->'stocks')
                          WITH ORDINALITY AS stock(value, ordinality)
                        WHERE stock.ordinality <= $2
                      ),
                      '[]'::jsonb
                    )
                  )
                ELSE payload
              END AS payload,
              item_count,
              updated_at,
              CASE
                WHEN jsonb_typeof(payload->'stocks') = 'array'
                  THEN jsonb_array_length(payload->'stocks')
                ELSE 0
              END AS payload_stock_count
       FROM display_snapshots
       WHERE snapshot_key = $1`,
      [key, safeLimit],
    );
    const row = rows[0];
    if (!row) {
      const memory = memorySnapshots.get(key) as DisplaySnapshot<T> | undefined;
      if (!memory) return null;
      const payload = memory.payload as T & { stocks?: unknown[] };
      return {
        ...memory,
        payload: ({
          ...(payload as object),
          stocks: Array.isArray(payload?.stocks) ? payload.stocks.slice(0, safeLimit) : payload?.stocks,
        } as T),
        payloadStockCount: Array.isArray(payload?.stocks) ? payload.stocks.length : 0,
      } satisfies DisplaySnapshotSlice<T>;
    }
    return {
      key: row.snapshot_key,
      payload: row.payload as T,
      itemCount: Number(row.item_count ?? 0),
      updatedAt: new Date(row.updated_at).toISOString(),
      payloadStockCount: Number(row.payload_stock_count ?? 0),
    } satisfies DisplaySnapshotSlice<T>;
  } catch (error) {
    if (!isMissingTable(error)) console.warn("display snapshot slice read fallback:", error);
    const fallback = await getDisplaySnapshot<T>(key);
    if (!fallback) return null;
    const payload = fallback.payload as T & { stocks?: unknown[] };
    return {
      ...fallback,
      payload: ({
        ...(payload as object),
        stocks: Array.isArray(payload?.stocks) ? payload.stocks.slice(0, safeLimit) : payload?.stocks,
      } as T),
      payloadStockCount: Array.isArray(payload?.stocks) ? payload.stocks.length : 0,
    } satisfies DisplaySnapshotSlice<T>;
  }
}

export async function getDisplaySnapshotStock<T>(key: string, code: string) {
  try {
    const { rows } = await pool.query(
      `SELECT snapshot_key,
              stock.value AS payload,
              item_count,
              updated_at
       FROM display_snapshots
       CROSS JOIN LATERAL jsonb_array_elements(
         CASE
           WHEN jsonb_typeof(payload->'stocks') = 'array' THEN payload->'stocks'
           ELSE '[]'::jsonb
         END
       )
         WITH ORDINALITY AS stock(value, ordinality)
       WHERE snapshot_key = $1
         AND stock.value->>'code' = $2
       ORDER BY stock.ordinality
       LIMIT 1`,
      [key, code],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      key: `scan:stock:${code}`,
      payload: row.payload as T,
      itemCount: 1,
      updatedAt: new Date(row.updated_at).toISOString(),
    } satisfies DisplaySnapshot<T>;
  } catch (error) {
    if (!isMissingTable(error)) console.warn("display snapshot stock read fallback:", error);
    const fallback = await getDisplaySnapshot<{ stocks?: T[] }>(key);
    const fallbackStocks = fallback?.payload?.stocks;
    const stock = Array.isArray(fallbackStocks) ? fallbackStocks.find(
      (item) => String((item as { code?: unknown })?.code) === code,
    ) : undefined;
    if (!fallback || !stock) return null;
    return {
      key: `scan:stock:${code}`,
      payload: stock,
      itemCount: 1,
      updatedAt: fallback.updatedAt,
    } satisfies DisplaySnapshot<T>;
  }
}

export async function saveDisplaySnapshot<T>(
  key: string,
  payload: T,
  itemCount: number,
) {
  const snapshot: DisplaySnapshot<T> = {
    key,
    payload,
    itemCount,
    updatedAt: new Date().toISOString(),
  };
  memorySnapshots.set(key, snapshot as DisplaySnapshot<unknown>);
  try {
    const { rows } = await pool.query(
      `INSERT INTO display_snapshots (snapshot_key, payload, item_count, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (snapshot_key) DO UPDATE SET
         payload = EXCLUDED.payload,
         item_count = EXCLUDED.item_count,
         updated_at = EXCLUDED.updated_at
       RETURNING updated_at`,
      [key, JSON.stringify(payload), itemCount],
    );
    snapshot.updatedAt = new Date(rows[0].updated_at).toISOString();
  } catch (error) {
    if (!isMissingTable(error)) console.warn("display snapshot write fallback:", error);
  }
  return snapshot;
}

export async function runSnapshotRefresh<T>(
  key: string,
  refresh: () => Promise<T>,
  leaseSeconds = 120,
): Promise<T | null> {
  const local = memoryRefreshes.get(key);
  if (local) return null;

  const ownerId = randomUUID();
  let databaseLock = false;
  try {
    try {
      const { rows } = await pool.query(
        `INSERT INTO cron_execution_locks (lock_key, owner_id, acquired_at, expires_at)
         VALUES ($1, $2, NOW(), NOW() + ($3 * INTERVAL '1 second'))
         ON CONFLICT (lock_key) DO UPDATE SET
           owner_id = EXCLUDED.owner_id,
           acquired_at = EXCLUDED.acquired_at,
           expires_at = EXCLUDED.expires_at
         WHERE cron_execution_locks.expires_at <= NOW()
         RETURNING lock_key`,
        [`signalx-display-refresh:${key}`, ownerId, leaseSeconds],
      );
      databaseLock = rows.length > 0;
      if (!databaseLock) return null;
    } catch (error) {
      if (!isMissingTable(error)) console.warn("display refresh lock fallback:", error);
    }

    const promise = refresh();
    memoryRefreshes.set(key, promise);
    return await promise;
  } finally {
    memoryRefreshes.delete(key);
    if (databaseLock) {
      await pool.query(
        "DELETE FROM cron_execution_locks WHERE lock_key = $1 AND owner_id = $2",
        [`signalx-display-refresh:${key}`, ownerId],
      ).catch(() => undefined);
    }
  }
}
