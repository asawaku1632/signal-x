import { NextResponse } from "next/server";

const jpStocks = [
  { code: "7203", name: "トヨタ自動車" },
  { code: "6758", name: "ソニーグループ" },
  { code: "7974", name: "任天堂" },
  { code: "9984", name: "ソフトバンクグループ" },
  { code: "8306", name: "三菱UFJ" },
  { code: "7011", name: "三菱重工業" },
  { code: "9432", name: "NTT" },
  { code: "4755", name: "楽天グループ" },
  { code: "6740", name: "ジャパンディスプレイ" },
  { code: "6857", name: "アドバンテスト" },
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.toLowerCase() || "";

    const results = jpStocks.filter((stock) => {
      return (
        stock.code.includes(q) ||
        stock.name.toLowerCase().includes(q)
      );
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      results: [],
    });
  }
}