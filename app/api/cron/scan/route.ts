import { NextResponse } from "next/server";

import { requireCronAuth } from "@/app/lib/cronAuth";
import { clampLimit, runScan } from "@/app/lib/learning/scanEngine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_SCAN_LIMIT = Number(process.env.SCAN_LIMIT || 200);

export async function GET(req: Request) {
  const unauthorized = requireCronAuth(req);
  if (unauthorized) return unauthorized;

  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const requestedLimit = Number(searchParams.get("limit") || DEFAULT_SCAN_LIMIT);
    const limit = clampLimit(requestedLimit);
    const result = await runScan(limit);

    return NextResponse.json({
      success: true,
      source: "production-scan-engine",
      limit: result.limit,
      totalStockList: result.totalStockList,
      marketPattern: result.marketPattern ?? null,
      stocks: result.stocks,
      ranking: result.ranking,
      diagnostics: result.diagnostics,
      scanMs: Date.now() - startedAt,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/scan] production scan failed", error);

    return NextResponse.json(
      {
        success: false,
        source: "production-scan-engine",
        error: "SCAN_FAILED",
        message,
        scanMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
