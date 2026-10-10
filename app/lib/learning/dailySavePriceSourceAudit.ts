/**
 * Passive provenance summary for daily save runs.
 *
 * These fields are diagnostics only. Do not change AI scores, trading decisions,
 * saved prices, scan schedule, coverage checks or notification behavior.
 */
export type DiagnosticStock = {
  code?: string;
  price?: number;
  dataSource?: string;
  latestBarTimestamp?: number | null; // Yahoo candle's UNIX seconds, NOT API receipt time
};

export type DiagnosticScanMeta = {
  cached?: boolean;
  cacheAge?: number;
  updatedAt?: string | null;
  status?: string;
};

type DiagnosticArgs = {
  targetDate: string;
  receivedAt: string;
  scanMeta: DiagnosticScanMeta;
  stocks: DiagnosticStock[];
};

const WATCH_CODES = new Set(["9984", "4062", "4493", "7182", "6740"]);
const MAX_DIAGNOSTIC_BARS = 8;

function jstParts(timestamp: number) {
  const items = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(timestamp * 1000));
  const get = (type: string) => items.find((item) => item.type === type)?.value ?? "";
  return { date: get("year") + "-" + get("month") + "-" + get("day"), time: get("hour") + ":" + get("minute") };
}
function validUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= 1_600_000_000 && value <= 4_000_000_000;
}
function safeAgeMinutes(receivedMs: number, timestamp: number): number | null {
  const difference = (receivedMs - timestamp * 1000) / 60_000;
  return Number.isFinite(difference) && difference >= 0
    ? Math.round(difference * 10) / 10 : null;
}
function safeIsoTime(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export function buildDailySavePriceSourceAudit({ targetDate, receivedAt, scanMeta, stocks }: DiagnosticArgs) {
  const receiveMs = Date.parse(receivedAt);
  const scanSnapshotUpdatedAt = safeIsoTime(scanMeta.updatedAt);
  const sourceCounts: Record<string, number> = {};
  const barClockCounts = new Map<string, number>();
  const sampleBars = [];
  let missingBarTimestamp = 0;
  let barsFromOtherTradingDate = 0;
  let barsMoreThan10MinOld = 0;
  let barAgeUnavailable = 0;
  const barAgeMinutes: number[] = [];
  for (const stock of stocks) {
    const source = stock.dataSource === "intraday" || stock.dataSource === "daily_fallback"
      ? stock.dataSource : "unknown";
    sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
    const barTime = stock.latestBarTimestamp;
    if (!validUnixSeconds(barTime)) {
      missingBarTimestamp += 1;
      continue;
    }
    const jst = jstParts(barTime);
    barClockCounts.set(jst.time, (barClockCounts.get(jst.time) ?? 0) + 1);
    if (jst.date !== targetDate) barsFromOtherTradingDate += 1;
    const ageMinutes = safeAgeMinutes(receiveMs, barTime);
    if (ageMinutes === null) {
      barAgeUnavailable += 1;
    } else {
      barAgeMinutes.push(ageMinutes);
      if (ageMinutes > 10) barsMoreThan10MinOld += 1;
    }
    if (WATCH_CODES.has(stock.code ?? "")) {
      sampleBars.push({
        code: stock.code, price: stock.price,
        source, barTimeJst: jst.date + " " + jst.time,
        barAgeMinutes: ageMinutes,
      });
    }
  }
  barAgeMinutes.sort((a, b) => a - b);
  const medianBarAgeMinutes = barAgeMinutes.length
    ? barAgeMinutes[Math.floor((barAgeMinutes.length - 1) / 2)] : null;
  const snapshotAgeSeconds = scanSnapshotUpdatedAt && Number.isFinite(receiveMs)
    ? Math.round((receiveMs - Date.parse(scanSnapshotUpdatedAt)) / 1000) : null;
  return {
    version: 1,
    targetDate,
    scanSnapshotUpdatedAt,
    // "cached:true" only means a display snapshot was served, NOT that it was fresh.
    scanCached: scanMeta.cached === true,
    scanStatus: typeof scanMeta.status === "string" ? scanMeta.status : null,
    scanCacheAgeSeconds: typeof scanMeta.cacheAge === "number" &&
      Number.isFinite(scanMeta.cacheAge) ? scanMeta.cacheAge : null,
    snapshotAgeSeconds: Number.isFinite(snapshotAgeSeconds) ? snapshotAgeSeconds : null,
    stockCount: stocks.length,
    sourceCounts,
    missingBarTimestamp,
    barsFromOtherTradingDate,
    barsMoreThan10MinOld,
    barAgeUnavailable,
    medianBarAgeMinutes,
    lastBarClockJstTop: [...barClockCounts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_DIAGNOSTIC_BARS).map(([time, count]) => ({time, count})),
    sampleBars: sampleBars.sort((a,b) => String(a.code).localeCompare(String(b.code))),
    note: "Research metadata only. Candle time is the Yahoo bar timestamp, not quote-receipt time or proof of a finalized exchange close.",
  };
}
