/** Offline-only fault-injection simulation. No vendor, DB, Cron or production imports. */
export type Daily100FetchResult = { code: string; state: "OK" | "SOURCE_FAILED" };
export type Daily100PartitionResult = {
  partitionId: number; requested: number; observed: number; failed: number;
  status: "COMPLETE" | "PARTIAL" | "FAILED"; checks: Daily100FetchResult[];
};
export async function simulateDaily100Partition(
  partitionId: number, codes: readonly string[],
  fetchOne: (code: string) => Promise<unknown>,
): Promise<Daily100PartitionResult> {
  if (!Number.isInteger(partitionId) || partitionId < 0 || partitionId > 4 ||
      codes.length !== 20 || new Set(codes).size !== 20 ||
      codes.some(code => !/^\d{4}$/.test(code))) {
    throw new Error("DAILY100_SIMULATION_INPUT_INVALID");
  }
  const checks: Daily100FetchResult[] = [];
  for (const code of codes) {
    try {
      await fetchOne(code);
      checks.push({ code, state: "OK" });
    } catch {
      checks.push({ code, state: "SOURCE_FAILED" });
    }
  }
  const observed = checks.filter(check => check.state === "OK").length;
  const failed = checks.length - observed;
  return {
    partitionId, requested: codes.length, observed, failed,
    status: failed === 0 ? "COMPLETE" : observed === 0 ? "FAILED" : "PARTIAL",
    checks,
  };
}
