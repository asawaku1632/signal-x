import { NextResponse } from "next/server";

import { getAdminSession } from "@/app/lib/admin";
import {
  saveRelatedLearning,
  type RelatedLearningStock,
} from "@/app/lib/relatedLearning";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const SCAN_TIMEOUT_MS = 125_000;

function getJstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function POST(request: Request) {
  const { isAdmin } = await getAdminSession();

  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: "Administrator access required" },
      { status: 403 },
    );
  }

  const targetDate = getJstDateString();

  try {
    const scanUrl = new URL("/api/scan?limit=1000", request.url);
    const cookie = request.headers.get("cookie");
    const scanResponse = await fetch(scanUrl, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    });

    if (!scanResponse.ok) {
      throw new Error(
        `scan api failed: ${scanResponse.status} ${scanResponse.statusText}`,
      );
    }

    const scan = (await scanResponse.json()) as {
      stocks?: RelatedLearningStock[];
    };
    const stocks = Array.isArray(scan.stocks) ? scan.stocks : [];

    if (stocks.length === 0) {
      throw new Error("scan api returned no stocks");
    }

    const result = await saveRelatedLearning(targetDate, stocks);

    return NextResponse.json({
      success: true,
      targetDate,
      scannedCount: stocks.length,
      dailyStockResultsChanged: false,
      ...result,
    });
  } catch (error) {
    console.error("related learning rebuild failed:", error);
    return NextResponse.json(
      {
        success: false,
        targetDate,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
