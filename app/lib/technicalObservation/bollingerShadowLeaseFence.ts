import { PHASE7_FENCE_LOCK_SQL, PHASE7_CAP_FENCE_SQL, PHASE7_CAP_BIND_SQL } from "./bollingerShadowQueries.ts";

/** Phase 7 only. Normal observation/results persistence remains unguarded for existing callers. */
export type Phase7LeaseOwner = Readonly<{
  lockKey: "signalx-technical-bb-shadow-observation" | "signalx-technical-bb-shadow-results";
  ownerId: string;
  /** Required for real Phase 7 SAVE. Absence is permitted ONLY for offline legacy fixtures. */
  secretHex?: string;
}>;

type LeaseQueryClient = { query(text: string, values?: unknown[]): Promise<{
  rows: Record<string, unknown>[]; rowCount?: number | null; command?: string;
}> };

/** Must be called AFTER BEGIN on the SAME connection used to INSERT and COMMIT.
 * SELECT FOR UPDATE holds the row lock until transaction end and serializes takeover.
 * This is cooperative fencing, not proof of identity against another process with the same DB credentials.
 */
export async function assertPhase7LeaseForSave(client: LeaseQueryClient, lease: Phase7LeaseOwner) {
  if (!lease || ![
    "signalx-technical-bb-shadow-observation", "signalx-technical-bb-shadow-results",
  ].includes(lease.lockKey) || typeof lease.ownerId !== "string"
    || !/^[A-Za-z0-9_-]{1,128}$/.test(lease.ownerId)) {
    throw new Error("INVALID_PHASE7_LEASE");
  }
  if (lease.secretHex !== undefined) {
    if (!/^[a-f0-9]{64}$/.test(lease.secretHex)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lease.ownerId)) {
      throw new Error("INVALID_PHASE7_CAPABILITY");
    }
    const fenced = await client.query(PHASE7_CAP_FENCE_SQL, [lease.lockKey, lease.ownerId, lease.secretHex]);
    if (fenced.command !== undefined && fenced.command !== "SELECT") throw new Error("PHASE7_FENCE_ACK_FAILED");
    if (!Array.isArray(fenced.rows) || fenced.rows.length !== 1 || fenced.rows[0]?.fenced !== true)
      throw new Error("PHASE7_LEASE_LOST");
    // Transaction-local RLS capability. Must be bound AFTER BEGIN, on same transaction connection.
    const bound = await client.query(PHASE7_CAP_BIND_SQL, [lease.secretHex]);
    if (bound.command !== undefined && bound.command !== "SELECT") throw new Error("PHASE7_BIND_ACK_FAILED");
    if (!Array.isArray(bound.rows) || bound.rows.length !== 1 || bound.rows[0]?.bound !== true)
      throw new Error("PHASE7_BIND_FAILED");
    return;
  }
  // The old fence remains testable for offline fixtures, but real session guard rejects it.
  const result = await client.query(PHASE7_FENCE_LOCK_SQL, [lease.lockKey, lease.ownerId]);
  if (result.command !== undefined && result.command !== "SELECT") throw new Error("PHASE7_LEASE_CHECK_FAILED");
  if (!Array.isArray(result.rows) || result.rows.length !== 1
    || result.rows[0]?.lock_key !== lease.lockKey) throw new Error("PHASE7_LEASE_LOST");
}
