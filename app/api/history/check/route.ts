import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "history check ok",
    checkedAt: new Date(),
  });
}