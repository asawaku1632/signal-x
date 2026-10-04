import { after } from "next/server";
import { NextResponse } from "next/server";
import { STOCKS } from "@/app/lib/stockList";
import {
  getStockSnapshot,
  refreshStockSnapshot,
  SCAN_FRESH_MS,
} from "@/app/lib/scanSnapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code: requestedCode } = await context.params;
  const decoded = decodeURIComponent(requestedCode);
  const matchedStock = STOCKS.find(
    (stock) => stock.code === decoded || stock.name === decoded,
  );
  const code = matchedStock?.code ?? decoded;
  let snapshot = await getStockSnapshot(code);
  let ageMs = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : Infinity;

  // A stock-detail page needs a complete analysis payload. When there is no
  // usable snapshot yet, build it synchronously instead of returning only the
  // basic stock name (which the UI would otherwise render as zero values).
  const hasAnalysisData = Boolean(
    snapshot?.payload &&
      Number.isFinite(Number(snapshot.payload.price ?? snapshot.payload.currentPrice)) &&
      Number.isFinite(Number(snapshot.payload.score ?? snapshot.payload.aiPower)),
  );

  if (!hasAnalysisData) {
    const refreshed = await refreshStockSnapshot(code).catch((error) => {
      console.error("stock snapshot initial refresh failed:", error);
      return null;
    });

    if (refreshed) {
      snapshot = await getStockSnapshot(code);
      ageMs = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : Infinity;
    }
  }

  if (snapshot && hasAnalysisData && ageMs >= SCAN_FRESH_MS) {
    after(async () => {
      await refreshStockSnapshot(code).catch((error) =>
        console.error("stock snapshot refresh failed:", error),
      );
    });
  }

  if (snapshot) {
    return NextResponse.json({
      success: true,
      status: ageMs < SCAN_FRESH_MS ? "fresh" : "stale",
      updatedAt: snapshot.updatedAt,
      stock: snapshot.payload,
    });
  }

  const basic = matchedStock ?? STOCKS.find((stock) => stock.code === code) ?? { code, name: decoded };
  return NextResponse.json(
    { success: true, status: "loading", updatedAt: null, stock: basic },
    { status: 202 },
  );
}
