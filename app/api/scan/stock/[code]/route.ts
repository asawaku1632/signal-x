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
  const { code } = await context.params;
  const snapshot = await getStockSnapshot(code);
  const ageMs = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : Infinity;

  if (!snapshot || ageMs >= SCAN_FRESH_MS) {
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

  const basic = STOCKS.find((stock) => stock.code === code) ?? { code, name: code };
  return NextResponse.json(
    { success: true, status: "loading", updatedAt: null, stock: basic },
    { status: 202 },
  );
}
