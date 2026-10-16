import "server-only";
import pool from "@/app/lib/postgres";
import { assertDaily100DevDatabase } from "./bollingerDaily100DbGuard";
import { claimDaily100Partition, type Daily100ClaimResult } from "./bollingerDaily100Claim";
import { BB_FORWARD_FROZEN_CODES } from "./bollingerForwardUniverse";

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
  assertDaily100DevDatabase(process.env);
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
  assertDaily100DevDatabase(process.env);
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
