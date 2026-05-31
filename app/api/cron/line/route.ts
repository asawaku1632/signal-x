import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://signal-x-ppjg.vercel.app";

    const res = await fetch(`${baseUrl}/api/line`, {
      cache: "no-store",
    });

    const json = await res.json();

    return NextResponse.json({
      success: true,
      result: json,
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "cron failed",
      },
      {
        status: 500,
      }
    );
  }
}