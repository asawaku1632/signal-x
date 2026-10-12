import Link from "next/link";
import pool from "@/app/lib/postgres";
import BottomNav from "@/app/components/BottomNav";
import ChartShapeSearchExplorer, {
  type ShapeStock,
  type ShapePatternStat,
} from "@/app/components/patterns/ChartShapeSearchExplorer";
import { chartPatternCatalog } from "@/app/lib/chartPatternCatalog";
import { SCAN_SNAPSHOT_KEY } from "@/app/lib/scanSnapshot";
import { marketScanGuard, quoteDateJst } from "@/app/lib/marketScanGuard";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { getPatternForwardStats } from "@/app/lib/learning/patternForwardLearning";

export const dynamic = "force-dynamic";

// Read only. Never refresh the scan from this page: an interactive filter
// should not start 1,200 stock analyses or modify learning/notification data.
type SnapshotRow = {
  updated_at: Date | string;
  item_count: number;
  scanned_count: number;
  stocks: unknown;
};

function numberOrNull(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStocks(value: unknown): {
  stocks: ShapeStock[];
  oldestQuoteDateJst: string | null;
  latestQuoteDateJst: string | null;
} {
  if (!Array.isArray(value)) return { stocks: [], oldestQuoteDateJst: null, latestQuoteDateJst: null };
  let oldestQuoteDateJst: string | null = null;
  let latestQuoteDateJst: string | null = null;
  const validIds = new Set(chartPatternCatalog.map((pattern) => pattern.id));
  const result: ShapeStock[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.code !== "string" || !/^[0-9A-Za-z]{4,5}$/.test(raw.code)) continue;
    const quoteDate = quoteDateJst(raw.barTimestamp);
    if (quoteDate) {
      if (!oldestQuoteDateJst || quoteDate < oldestQuoteDateJst) oldestQuoteDateJst = quoteDate;
      if (!latestQuoteDateJst || quoteDate > latestQuoteDateJst) latestQuoteDateJst = quoteDate;
    }
    if (!Array.isArray(raw.patterns)) continue;

    const patterns: ShapeStock["patterns"] = [];
    const seen = new Set<string>();
    for (const candidate of raw.patterns) {
      if (!candidate || typeof candidate !== "object") continue;
      const observation = candidate as Record<string, unknown>;
      const id = observation.id;
      if (typeof id !== "string" || !validIds.has(id) || seen.has(id)) continue;
      seen.add(id);
      patterns.push({ id, confidence: numberOrNull(observation.confidence) });
    }
    if (!patterns.length) continue;

    result.push({
      code: raw.code,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name : raw.code,
      score: numberOrNull(raw.score),
      price: numberOrNull(raw.price),
      patterns,
    });
  }
  return { stocks: result, oldestQuoteDateJst, latestQuoteDateJst };
}

async function loadSnapshot(): Promise<{
  updatedAt: string | null;
  requestedCount: number;
  scannedCount: number;
  stocks: ShapeStock[];
  oldestQuoteDateJst: string | null;
  latestQuoteDateJst: string | null;
  unavailable: boolean;
}> {
  try {
    // Build a small projection inside Postgres. Never ship the several-MB
    // original snapshot or invoke the Yahoo/AI scan for a filter click.
    const { rows } = await pool.query<SnapshotRow>(`
      WITH snapshot AS (
        SELECT
          updated_at,
          item_count,
          CASE WHEN jsonb_typeof(payload->'stocks') = 'array'
            THEN payload->'stocks'
            ELSE '[]'::jsonb
          END AS stock_array
        FROM display_snapshots
        WHERE snapshot_key = $1
      )
      SELECT
        s.updated_at,
        s.item_count,
        jsonb_array_length(s.stock_array) AS scanned_count,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'code', entry.stock->>'code',
              'name', entry.stock->>'name',
              'score', entry.stock->'score',
              'price', entry.stock->'price',
              'barTimestamp', entry.stock->'latestBarTimestamp',
              'patterns', CASE
                WHEN jsonb_typeof(entry.stock->'patternObservations') = 'array'
                  THEN entry.stock->'patternObservations'
                WHEN jsonb_typeof(entry.stock->'detectedPatterns') = 'array'
                  THEN entry.stock->'detectedPatterns'
                ELSE '[]'::jsonb
              END
            ) ORDER BY entry.ordinality
          )
          FROM jsonb_array_elements(s.stock_array)
            WITH ORDINALITY AS entry(stock, ordinality)
        ), '[]'::jsonb) AS stocks
      FROM snapshot s
    `, [SCAN_SNAPSHOT_KEY]);
    const row = rows[0];
    if (!row) {
      return { updatedAt: null, requestedCount: 0, scannedCount: 0, stocks: [],
        oldestQuoteDateJst: null, latestQuoteDateJst: null, unavailable: false };
    }
    const timestamp = new Date(row.updated_at);
    const parsed = parseStocks(row.stocks);
    return {
      updatedAt: Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString(),
      requestedCount: Number(row.item_count) || 0,
      scannedCount: Number(row.scanned_count) || 0,
      ...parsed,
      unavailable: false,
    };
  } catch (error) {
    console.error("chart shape read-only snapshot failed:", error);
    return { updatedAt: null, requestedCount: 0, scannedCount: 0, stocks: [],
      oldestQuoteDateJst: null, latestQuoteDateJst: null, unavailable: true };
  }
}

export default async function ChartShapeSearchPage() {
  const [snapshot, owner] = await Promise.all([loadSnapshot(), getLearningOwnerSession()]);
  const market = marketScanGuard();
  // Forward outcomes are private research data. Public visitors only receive
  // the existing shape-matching snapshot; never serialize the private stats.
  let historicalStats: ShapePatternStat[] | null = null;
  let statsUnavailable = false;
  if (owner.isOwner) {
    try {
      const stats = await getPatternForwardStats();
      historicalStats = stats.map((item) => ({
        id: item.patternId,
        status: item.validationStatus,
        sampleCount: item.sampleCount,
        completed5dCount: item.completed5dCount,
        winRate5d: item.winRate5d,
        avgDirectionalReturn5d: item.avgDirectionalReturn5d,
        distinctCodes: item.distinctCodes,
        distinctDates: item.distinctDates,
      }));
    } catch (error) {
      // Never turn a research-stat outage into a shape-search outage.
      console.error("chart shape private forward stats unavailable:", error);
      historicalStats = [];
      statsUnavailable = true;
    }
  }
  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <div className="mx-auto max-w-5xl px-3 pt-5 sm:px-6">
        <header className="mb-5 flex items-center gap-3">
          <Link href="/learning/patterns" aria-label="チャート図鑑に戻る"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-2xl font-bold shadow-sm">‹</Link>
          <div>
            <p className="text-[10px] font-black tracking-widest text-blue-700">SIGNALX / PATTERN SEARCH</p>
            <h1 className="text-2xl font-black">チャート形状から銘柄検索</h1>
          </div>
        </header>
        <p className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-6 text-slate-700">
          55種類のチャート形状から、保存済みの最新スキャンに一致した銘柄を探せます。
          検出は過去の足を使った形状判定です。将来の上昇・下落や勝率を保証するものではありません。
        </p>
        <ChartShapeSearchExplorer
          patterns={chartPatternCatalog}
          stocks={snapshot.stocks}
          updatedAt={snapshot.updatedAt}
          requestedCount={snapshot.requestedCount}
          scannedCount={snapshot.scannedCount}
          unavailable={snapshot.unavailable}
          historicalStats={historicalStats}
          statsUnavailable={statsUnavailable}
          marketClosed={market.closed}
          oldestQuoteDateJst={snapshot.oldestQuoteDateJst}
          latestQuoteDateJst={snapshot.latestQuoteDateJst}
        />
      </div>
      <BottomNav />
    </main>
  );
}
