/** Bounded, read-only vendor probe. No DB writes, scheduler, LINE or trade actions. */
export type Daily100ProbeResult = {
  requested: number; succeeded: number; failed: number; elapsedMs: number;
  checks: { code: string; ok: boolean; elapsedMs: number; error?: string }[];
};
export async function probeDaily100Vendor(
  codes: readonly string[],
  fetchOne: (code: string) => Promise<unknown>,
  options: { maxCodes?: number; timeoutMs?: number; now?: () => number } = {},
): Promise<Daily100ProbeResult> {
  const maxCodes = options.maxCodes ?? 5;
  const timeoutMs = options.timeoutMs ?? 12000;
  const now = options.now ?? Date.now;
  if (!Number.isInteger(maxCodes) || maxCodes < 1 || maxCodes > 5 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 12000 ||
      codes.length < 1 || codes.length > maxCodes ||
      new Set(codes).size !== codes.length ||
      codes.some(code => !/^\d{4}$/.test(code))) {
    throw Error("DAILY100_PROBE_BUDGET_INVALID");
  }
  const started = now();
  const checks: Daily100ProbeResult["checks"] = [];
  for (const code of codes) {
    const start = now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve().then(() => fetchOne(code)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(Error("SOURCE_TIMEOUT")), timeoutMs);
        }),
      ]);
      checks.push({ code, ok: true, elapsedMs: Math.max(0, now() - start) });
    } catch (error) {
      checks.push({
        code, ok: false, elapsedMs: Math.max(0, now() - start),
        error: error instanceof Error ? error.message.slice(0, 100) : "UNKNOWN",
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return {
    requested: checks.length,
    succeeded: checks.filter(check => check.ok).length,
    failed: checks.filter(check => !check.ok).length,
    elapsedMs: Math.max(0, now() - started),
    checks,
  };
}
