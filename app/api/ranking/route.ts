import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import {
  refreshScanSnapshot,
  SCAN_FRESH_MS,
  SCAN_SNAPSHOT_KEY,
} from "@/app/lib/scanSnapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const FULL_SCAN_LIMIT = 1200;

type RankingStock = {
  score?: number;
  [key: string]: unknown;
};

type RankingSnapshot = {
  item_count: number;
  updated_at: Date;
  total_stock_list: string | null;
  analyzed_success_count: string | null;
  scanned_count: number;
  ranking: RankingStock[];
};

// Compute the original score-descending top 20 inside Postgres. Returning only
// the selected full stock objects avoids transferring the ~5 MB scan snapshot
// to Next.js on every ranking-page request.
async function getRankingSnapshot(): Promise<RankingSnapshot | null> {
  const { rows } = await pool.query<RankingSnapshot>(`
    SELECT
      d.item_count,
      d.updated_at,
      d.payload->>'totalStockList' AS total_stock_list,
      d.payload->'scanDiagnostics'->>'analyzedSuccessCount' AS analyzed_success_count,
      CASE
        WHEN jsonb_typeof(d.payload->'stocks') = 'array'
          THEN jsonb_array_length(d.payload->'stocks')
        ELSE 0
      END AS scanned_count,
      COALESCE(
        (
          SELECT jsonb_agg(top_stock.stock ORDER BY top_stock.score DESC, top_stock.ordinality)
          FROM (
            SELECT
              stock.value AS stock,
              COALESCE((stock.value->>'score')::double precision, 0) AS score,
              stock.ordinality
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(d.payload->'stocks') = 'array'
                  THEN d.payload->'stocks'
                ELSE '[]'::jsonb
              END
            ) WITH ORDINALITY AS stock(value, ordinality)
            WHERE COALESCE((stock.value->>'score')::double precision, 0) >= 50
            ORDER BY score DESC, stock.ordinality
            LIMIT 20
          ) AS top_stock
        ),
        '[]'::jsonb
      ) AS ranking
    FROM display_snapshots d
    WHERE d.snapshot_key = $1
  `, [SCAN_SNAPSHOT_KEY]);

  return rows[0] ?? null;
}

export async function GET() {
  try {
    let snapshot = await getRankingSnapshot();
    const ageMs = snapshot
      ? Date.now() - new Date(snapshot.updated_at).getTime()
      : Infinity;

    // Keep the previous full-scan freshness/coverage contract. The refresh may
    // still scan all stocks; the ranking response itself only reads top 20.
    if (!snapshot || ageMs >= SCAN_FRESH_MS || snapshot.item_count < FULL_SCAN_LIMIT) {
      await refreshScanSnapshot(FULL_SCAN_LIMIT);
      snapshot = await getRankingSnapshot();
    }

    if (!snapshot || snapshot.item_count < FULL_SCAN_LIMIT) {
      return NextResponse.json(
        { success: false, error: "scan snapshot is not ready" },
        { status: 503 },
      );
    }

    const ranking = Array.isArray(snapshot.ranking) ? snapshot.ranking : [];
    const analyzedCount = snapshot.analyzed_success_count;
    const rankingUniverseCount = analyzedCount === null
      ? snapshot.scanned_count
      : Number(analyzedCount);

    return NextResponse.json({
      success: true,
      count: ranking.length,
      ranking,
      rankingUniverseCount,
      activeStockCount: Number(snapshot.total_stock_list) || null,
      rankingCount: ranking.length,
      snapshotUpdatedAt: new Date(snapshot.updated_at).toISOString(),
    });
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "ranking failed", message },
      { status: 500 },
    );
  }
}
