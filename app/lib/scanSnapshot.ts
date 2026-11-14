import pool from "@/app/lib/postgres";
import { getScanProvenancePool } from "@/app/lib/learning/scanProvenanceDb";
import { buildScanProvenanceCapture } from "@/app/lib/learning/scanProvenanceCapture.mjs";
import { buildScanResponsePayload } from "@/app/lib/learning/notificationEngine";
import { runScan, runSingleStockScan } from "@/app/lib/learning/scanEngine";
import {
  getDisplaySnapshot,
  getDisplaySnapshotStock,
  getDisplaySnapshotStockSlice,
  runSnapshotRefresh,
  saveDisplaySnapshot,
} from "@/app/lib/displaySnapshot";
import { shouldReplaceSnapshot } from "@/app/lib/learning/snapshotCoverage";
import { marketScanGuard } from "@/app/lib/marketScanGuard";
import { preferStockSnapshot } from "@/app/lib/preferStockSnapshot.mjs";

export const SCAN_SNAPSHOT_KEY = "scan:latest";
export const TODAY_MARKET_SCAN_SNAPSHOT_KEY = "scan:today-market";
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


/**
 * Research-only append-only observations. These are scan-time observations,
 * NOT proof that the score was available before a market move.
 * The captured_at DB timestamp, scan_generated_at, and candle timestamp are
 * intentionally kept separate. Failure must not affect public scan traffic.
 */
async function recordScanAudit(
  key: string,
  stocks: Array<Record<string, unknown>>,
  generatedAt: string,
  coverage: number,
) {
  if (key !== SCAN_SNAPSHOT_KEY) return;
  // Research windows in JST. Preserve the actual generation timestamp.
  const scanTime = new Date(generatedAt);
  if (!Number.isFinite(scanTime.getTime())) return;
  const jst = new Date(scanTime.getTime() + 9 * 60 * 60 * 1000);
  const hhmm = jst.getUTCHours() * 60 + jst.getUTCMinutes();
  const slots = [
    { name: "preopen_0850", start: 525, end: 540 },
    { name: "open_0905", start: 545, end: 555 },
    { name: "morning_0915", start: 555, end: 565 },
    { name: "midday_1130", start: 685, end: 695 },
    { name: "close_1530", start: 925, end: 940 },
  ];
  const slot = slots.find((entry) => hhmm >= entry.start && hhmm < entry.end);
  if (!slot) return;
  const captureSlot = jst.toISOString().slice(0, 10) + ":" + slot.name;
  const rows = stocks.filter((stock) => /^\d{4}$/.test(String(stock.code ?? "")));
  if (!rows.length) return;
  const observations = rows.map((stock, index) => ({
    code: String(stock.code),
    score: stock.rawAiPower == null && stock.aiPower == null && stock.score == null ? null
      : Number.isFinite(Number(stock.rawAiPower ?? stock.aiPower ?? stock.score))
      ? Number(stock.rawAiPower ?? stock.aiPower ?? stock.score) : null,
    rank: index + 1,
    price: stock.price == null ? null : Number.isFinite(Number(stock.price)) ? Number(stock.price) : null,
    barTime: stock.latestBarTimestamp == null ? null : String(stock.latestBarTimestamp),
  }));
  await pool.query(
    `INSERT INTO public.ai_power_scan_audit
      (snapshot_key,scan_generated_at,capture_slot,code,ai_power,rank,reference_price,
       latest_bar_timestamp,model_version,snapshot_coverage)
     SELECT $1,$2::timestamptz,$6,x.code,x.score,x.rank,x.price,x.bar_time,$4,$5
     FROM jsonb_to_recordset($3::jsonb)
       AS x(code text,score numeric,rank integer,price numeric,bar_time text)
     ON CONFLICT (snapshot_key,capture_slot,code) DO NOTHING`,
    [key, generatedAt, JSON.stringify(observations.map(x => ({
      code: x.code, score: x.score, rank: x.rank, price: x.price, bar_time: x.barTime,
    }))), AI_POWER_VERSION, coverage, captureSlot],
  );
}

/**
 * Optional forward-only shadow capture. Disabled unless explicitly enabled.
 * Table must be provisioned separately; any failure is isolated from scan traffic.
 */
async function recordScanProvenanceShadow(
  key: string,
  stocks: Array<Record<string, unknown>>,
  generatedAt: string,
) {
  if (key !== SCAN_SNAPSHOT_KEY || process.env.SCAN_PROVENANCE_SHADOW_ENABLED !== "true") return;
  const shadowPool = getScanProvenancePool();
  if (!shadowPool) return; // No fallback to the production DATABASE_URL.
  const captures = stocks
    .filter((stock) => /^[0-9]{4}$/.test(String(stock.code ?? "")))
    .map((stock) => buildScanProvenanceCapture({
      stock,
      generatedAt,
      modelVersion: AI_POWER_VERSION,
      // No reliable point-in-time learning watermark currently available.
      learningAsOf: null,
    }));
  if (!captures.length) return;
  await shadowPool.query(
    `INSERT INTO scan_provenance_research.shadow_capture_test
       (snapshot_key, scan_generated_at, code, input_fingerprint_sha256, capture)
     SELECT $1, $2::timestamptz, x.code, x.fingerprint, x.capture
     FROM jsonb_to_recordset($3::jsonb)
       AS x(code text, fingerprint text, capture jsonb)
     ON CONFLICT (snapshot_key, scan_generated_at, code) DO NOTHING`,
    [key, generatedAt, JSON.stringify(captures.map((capture) => ({
      code: capture.code,
      fingerprint: capture.inputFingerprintSha256,
      capture,
    })))],
  );
}

export async function getLatestScanSnapshot() {
  return getDisplaySnapshot<StoredScanPayload>(SCAN_SNAPSHOT_KEY);
}

export async function getLatestScanSnapshotSlice(stockLimit: number) {
  return getDisplaySnapshotStockSlice<StoredScanPayload>(SCAN_SNAPSHOT_KEY, stockLimit);
}

export async function getTodayMarketScanSnapshot() {
  return getDisplaySnapshot<StoredScanPayload>(TODAY_MARKET_SCAN_SNAPSHOT_KEY);
}

async function refreshSnapshot(
  key: string,
  limit: number,
  existingSnapshot?: Awaited<ReturnType<typeof getLatestScanSnapshot>>,
) {
  // Shared boundary: /api/scan, /api/ranking and today-market refreshes all
  // pass through here. Avoid full-market rescans on JPX holidays/weekends.
  // Never change the saved snapshot or its updated_at on a closed day.
  const market = marketScanGuard();
  if (!market.refreshAllowed) {
    return existingSnapshot ?? getDisplaySnapshot<StoredScanPayload>(key);
  }
  return runSnapshotRefresh(
    key,
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
      const existing = existingSnapshot !== undefined
        ? existingSnapshot
        : await getDisplaySnapshot<StoredScanPayload>(key);
      if (shouldReplaceSnapshot(existing?.itemCount ?? null, result.limit)) {
        const saved = await saveDisplaySnapshot(key, payload, result.limit);
        await recordScanAudit(key, stocks, payload.updatedAt!, result.limit)
          .catch((error) => console.error("scan audit capture failed:", error));
        await recordScanProvenanceShadow(key, stocks, payload.updatedAt!)
          .catch((error) => console.error("scan provenance shadow capture failed:", error));
        return saved;
      }
      return existing;
    },
  );
}

export function refreshScanSnapshot(
  limit: number,
  existingSnapshot?: Awaited<ReturnType<typeof getLatestScanSnapshot>>,
) {
  return refreshSnapshot(SCAN_SNAPSHOT_KEY, limit, existingSnapshot);
}

export function refreshTodayMarketScanSnapshot(limit = 20) {
  return refreshSnapshot(TODAY_MARKET_SCAN_SNAPSHOT_KEY, limit);
}

export async function getStockSnapshot(code: string) {
  // Individual rows keep the complete versioned scan payload.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [individual, market] = await Promise.all([
    getDisplaySnapshot<any>(`scan:stock:${code}`),
    getDisplaySnapshotStock<any>(SCAN_SNAPSHOT_KEY, code),
  ]);
  // Compare the Yahoo candle times: the last saved isolated stock analysis
  // can be older than the latest market-wide scan used by Favorites.
  return preferStockSnapshot(individual, market);
}

export async function refreshStockSnapshot(code: string) {
  return runSnapshotRefresh(`stock:${code}`, async () => {
    const result = await runSingleStockScan(code);
    const stock = result.stocks[0] ?? null;
    if (stock) await saveDisplaySnapshot(`scan:stock:${code}`, stock, 1);
    return stock;
  }, 30);
}
