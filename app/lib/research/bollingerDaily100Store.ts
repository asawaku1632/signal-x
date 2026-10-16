import "server-only";
import pool from "@/app/lib/postgres";
import { assertDaily100DevDatabase, DAILY100_DEV_PROJECT_REF } from "./bollingerDaily100DbGuard";
import { claimDaily100Partition, type Daily100ClaimResult } from "./bollingerDaily100Claim";
import { BB_FORWARD_FROZEN_CODES } from "./bollingerForwardUniverse";

/** All identity reads and ledger writes share ONE checked Postgres client. */
async function withVerifiedDaily100Client<T>(action: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  assertDaily100DevDatabase({
    VERCEL_ENV: process.env.VERCEL_ENV,
    BB_DAILY100_DB_WRITE_ENABLED: process.env.BB_DAILY100_DB_WRITE_ENABLED,
    DATABASE_URL: process.env.DATABASE_URL,
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const identity = await client.query<{ database_project_ref: string | null }>(
      "SELECT database_project_ref FROM public.bb_daily100_control WHERE singleton=true FOR SHARE",
    );
    if (identity.rows.length !== 1 || identity.rows[0].database_project_ref !== DAILY100_DEV_PROJECT_REF) {
      throw Error("DAILY100_DATABASE_IDENTITY_MISMATCH");
    }
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* original error is authoritative */ }
    throw error;
  } finally {
    client.release();
  }
}

/** Storage-only adapter. Never fetches prices, triggers Cron or calls vendor APIs. */
export async function tryInsertDaily100Claim(args: {
  tradeDate: string; partitionId: number; policyVersion: string; codes: string[];
}): Promise<boolean> {
  return withVerifiedDaily100Client(async client => {
    const result = await client.query<{ partition_id: number }>(
      `INSERT INTO public.bb_daily100_runs
        (trade_date,partition_id,policy_version,codes)
       VALUES ($1::date,$2,$3,$4::text[])
       ON CONFLICT (trade_date,partition_id,policy_version) DO NOTHING
       RETURNING partition_id`,
      [args.tradeDate, args.partitionId, args.policyVersion, args.codes],
    );
    return result.rowCount === 1;
  });
}

export async function claimDaily100FromDatabase(args: {
  tradeDate: string; partitionId: number;
}): Promise<Daily100ClaimResult> {
  return withVerifiedDaily100Client(async client => {
    const control = await client.query<{
      enabled: boolean; activation_date: string | null; policy_version: string;
    }>(`SELECT enabled,activation_date::text,policy_version
       FROM public.bb_daily100_control WHERE singleton=true`);
    const row = control.rows[0];
    if (!row) throw Error("DAILY_100_CONTROL_MISSING");
    return claimDaily100Partition({
      ...args,
      policyVersion: row.policy_version,
      universe: BB_FORWARD_FROZEN_CODES,
      enabled: row.enabled,
      activationDate: row.activation_date,
      tryInsertClaim: async claim => {
        const result = await client.query<{ partition_id: number }>(
          `INSERT INTO public.bb_daily100_runs
            (trade_date,partition_id,policy_version,codes)
           VALUES ($1::date,$2,$3,$4::text[])
           ON CONFLICT (trade_date,partition_id,policy_version) DO NOTHING
           RETURNING partition_id`,
          [claim.tradeDate, claim.partitionId, claim.policyVersion, claim.codes],
        );
        return result.rowCount === 1;
      },
    });
  });
}
