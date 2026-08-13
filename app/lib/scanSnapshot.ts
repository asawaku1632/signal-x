import { buildScanResponsePayload } from "@/app/lib/learning/notificationEngine";
import { runScan, runSingleStockScan } from "@/app/lib/learning/scanEngine";
import {
  getDisplaySnapshot,
  runSnapshotRefresh,
  saveDisplaySnapshot,
} from "@/app/lib/displaySnapshot";

export const SCAN_SNAPSHOT_KEY = "scan:latest";
export const SCAN_FRESH_MS = 60_000;
const DEBUG_VERSION = "AI_POWER_V20_FINAL_ROUTE_REFACTOR_0706";
const AI_POWER_VERSION = "V20.0";

export type StoredScanPayload = ReturnType<typeof buildScanResponsePayload> & {
  updatedAt?: string;
};

function finite(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

// Keep the pre-Phase-1 public scan ordering exactly, including tie breakers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortStocksForPublicScan(stocks: any[]) {
  return [...stocks].sort((a, b) => {
    const scoreDiff = finite(b?.rawAiPower, b?.score ?? b?.aiPower) -
      finite(a?.rawAiPower, a?.score ?? a?.aiPower);
    if (scoreDiff !== 0) return scoreDiff;
    const changeDiff = finite(b?.changePercent) - finite(a?.changePercent);
    if (changeDiff !== 0) return changeDiff;
    const volumeDiff = finite(b?.volumeRatio) - finite(a?.volumeRatio);
    if (volumeDiff !== 0) return volumeDiff;
    return String(a?.code ?? "").localeCompare(String(b?.code ?? ""), "ja", {
      numeric: true,
    });
  });
}

export async function getLatestScanSnapshot() {
  return getDisplaySnapshot<StoredScanPayload>(SCAN_SNAPSHOT_KEY);
}

export async function refreshScanSnapshot(limit: number) {
  return runSnapshotRefresh(
    SCAN_SNAPSHOT_KEY,
    async () => {
      const startedAt = Date.now();
      const result = await runScan(limit);
      const stocks = sortStocksForPublicScan(result.stocks);
      const payload: StoredScanPayload = {
        ...buildScanResponsePayload({
          debugVersion: DEBUG_VERSION,
          aiPowerVersion: AI_POWER_VERSION,
          cached: false,
          limit,
          totalStockList: result.totalStockList,
          stocks,
          summaryStocks: stocks,
          marketPattern: result.marketPattern,
          scanDiagnostics: result.diagnostics,
          scanMs: Date.now() - startedAt,
          batchSize: result.batchSize,
        }),
        updatedAt: new Date().toISOString(),
      };
      // itemCount represents requested scan coverage, not only successful rows.
      await saveDisplaySnapshot(SCAN_SNAPSHOT_KEY, payload, result.limit);
      return payload;
    },
  );
}

export async function getStockSnapshot(code: string) {
  // Individual rows keep the complete versioned scan payload.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const individual = await getDisplaySnapshot<any>(`scan:stock:${code}`);
  if (individual) return individual;
  const scan = await getLatestScanSnapshot();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stock = scan?.payload.stocks.find((item: any) => String(item.code) === code);
  if (!scan || !stock) return null;
  return {
    key: `scan:stock:${code}`,
    payload: stock,
    itemCount: 1,
    updatedAt: scan.updatedAt,
  };
}

export async function refreshStockSnapshot(code: string) {
  return runSnapshotRefresh(`stock:${code}`, async () => {
    const result = await runSingleStockScan(code);
    const stock = result.stocks[0] ?? null;
    if (stock) await saveDisplaySnapshot(`scan:stock:${code}`, stock, 1);
    return stock;
  }, 30);
}
