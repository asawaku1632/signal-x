import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({
      success: false,
      results: [],
      message: "検索ワードがありません",
    });
  }

  try {
    const apiKey = process.env.FINNHUB_API_KEY;

    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${apiKey}`
    );

    const data = await res.json();

    return NextResponse.json({
      success: true,
      results: data.result ?? [],
    });
  } catch {
    return NextResponse.json({
      success: false,
      results: [],
      message: "検索に失敗しました",
    });
  }
}