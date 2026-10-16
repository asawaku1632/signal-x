import "server-only";
import pool from "@/app/lib/postgres";
import { assertDaily100DevDatabase, DAILY100_DEV_PROJECT_REF } from "./bollingerDaily100DbGuard";
import { claimDaily100Partition, type Daily100ClaimResult } from "./bollingerDaily100Claim";
import { BB_FORWARD_FROZEN_CODES } from "./bollingerForwardUniverse";

/** Verify database-held marker, not merely connection URL. Fail closed. */
async function verifyDaily100DatabaseIdentity(): Promise<void> {
  assertDaily100DevDatabase(process.env);
  const identity = await pool.query<{ database_project_ref: string | null }>(
    "SELECT database_project_ref FROM public.bb_daily100_control WHERE singleton=true",
  );
  if (identity.rows.length !== 1 || identity.rows[0].database_project_ref !== DAILY100_DEV_PROJECT_REF) {
    throw Error("DAILY100_DATABASE_IDENTITY_MISMATCH");
  }
}

/**
 * Storage-only adapter: never fetches prices or starts a study.
 * Only call from a separately authorized dev-only route after validating
 * the JPX trading date and owner identity. No cron is registered here.
 */
export async function tryInsertDaily100Claim(args: {
  tradeDate: string;
  partitionId: number;
  policyVersion: string;
  codes: string[];
}): Promise<boolean> {
  await verifyDaily100DatabaseIdentity();
  const result = await pool.query<{ partition_id: number }>(
    `INSERT INTO public.bb_daily100_runs
      (trade_date,partition_id,policy_version,codes)
     VALUES ($1::date,$2,$3,$4::text[])
     ON CONFLICT (trade_date,partition_id,policy_version) DO NOTHING
     RETURNING partition_id`,
    [args.tradeDate, args.partitionId, args.policyVersion, args.codes],
  );
  return result.rowCount === 1;
}

export async function claimDaily100FromDatabase(args: {
  tradeDate: string;
  partitionId: number;
}): Promise<Daily100ClaimResult> {
  await verifyDaily100DatabaseIdentity();
  const control = await pool.query<{
    enabled: boolean;
    activation_date: string | null;
    policy_version: string;
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
    tryInsertClaim: tryInsertDaily100Claim,
  });
}
