import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/scan`, {
    cache: "no-store",
  });

  const json = await res.json();

  return NextResponse.json({
    success: true,
    message: "SIGNALX cron scan executed",
    stocks: json.stocks?.length || 0,
    updatedAt: new Date(),
  });
}