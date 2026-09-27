import { NextResponse } from "next/server";

import stockResults from "@/data/daily-stock-results.json";

type StockRow = {
  code?: string;
  name?: string;
};

const stocks = Array.from(
  new Map(
    (stockResults as StockRow[])
      .filter((row) => row.code && row.name)
      .map((row) => [String(row.code).trim(), { code: String(row.code).trim(), name: String(row.name).trim() }]),
  ).values(),
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();

    if (!q) {
      return NextResponse.json({ success: true, results: [] });
    }

    const results = stocks
      .filter((stock) => stock.code.includes(q) || stock.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aExact = a.code === q || a.name.toLowerCase() === q;
        const bExact = b.code === q || b.name.toLowerCase() === q;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aPrefix = a.code.startsWith(q) || a.name.toLowerCase().startsWith(q);
        const bPrefix = b.code.startsWith(q) || b.name.toLowerCase().startsWith(q);
        if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;
        return a.code.localeCompare(b.code, "ja");
      })
      .slice(0, 50);

    return NextResponse.json(
      { success: true, results, totalStocks: stocks.length },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("[jp-search] failed", error);
    return NextResponse.json(
      { success: false, results: [], error: "stock search failed" },
      { status: 500 },
    );
  }
}
