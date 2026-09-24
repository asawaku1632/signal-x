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
  const { code } = await context.params;
  let snapshot = await getStockSnapshot(code);
  let ageMs = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : Infinity;

  // Individual analysis pages must not render a stale recommendation first.
  // Refresh synchronously when the snapshot is missing or older than the
  // freshness window so a notification tap cannot open an outdated AI POWER.
  if (!snapshot || ageMs >= SCAN_FRESH_MS) {
    await refreshStockSnapshot(code).catch((error) =>
      console.error("stock snapshot refresh failed:", error),
    );

    snapshot = await getStockSnapshot(code);
    ageMs = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : Infinity;
  }

  if (snapshot) {
    return NextResponse.json({
      success: true,
      status: ageMs < SCAN_FRESH_MS ? "fresh" : "stale",
      updatedAt: snapshot.updatedAt,
      stock: snapshot.payload,
    });
  }

  const basic = STOCKS.find((stock) => stock.code === code) ?? { code, name: code };
  return NextResponse.json(
    { success: true, status: "loading", updatedAt: null, stock: basic },
    { status: 202 },
  );
}
