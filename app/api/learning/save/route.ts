import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    saved: true,
    count: 0,
    updatedAt: new Date(),
  });
}