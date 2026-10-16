/**
 * Separate daily-100 claim gate. No invocation is made unless the owner opt-in
 * is active AND this partition has atomically acquired its unique DB claim.
 * Injected dependencies allow offline tests with zero vendor/database calls.
 */
import { buildDaily100Partitions, daily100ClaimKey } from "./bollingerDaily100Plan";

export type Daily100ClaimResult =
  | { state: "DISABLED" | "NOT_ACTIVATED" | "ALREADY_CLAIMED"; key?: string }
  | { state: "CLAIMED"; key: string; codes: string[] };

export async function claimDaily100Partition(args: {
  tradeDate: string;
  partitionId: number;
  policyVersion: string;
  universe: readonly string[];
  enabled: boolean;
  activationDate: string | null;
  tryInsertClaim: (claim: {
    tradeDate: string;
    partitionId: number;
    policyVersion: string;
    codes: string[];
  }) => Promise<boolean>;
}): Promise<Daily100ClaimResult> {
  if (!args.enabled) return { state: "DISABLED" };
  if (!args.activationDate || args.tradeDate < args.activationDate) {
    return { state: "NOT_ACTIVATED" };
  }
  const key = daily100ClaimKey(args.tradeDate, args.partitionId, args.policyVersion);
  const partition = buildDaily100Partitions(args.universe)[args.partitionId];
  // tryInsertClaim MUST use INSERT ... ON CONFLICT DO NOTHING RETURNING ...
  // on the unique (trade_date, partition_id, policy_version) key.
  // Never use SELECT-then-INSERT: it is race-prone.
  const acquired = await args.tryInsertClaim({
    tradeDate: args.tradeDate,
    partitionId: args.partitionId,
    policyVersion: args.policyVersion,
    codes: partition.codes,
  });
  if (!acquired) return { state: "ALREADY_CLAIMED", key };
  return { state: "CLAIMED", key, codes: partition.codes };
}
