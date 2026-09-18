import { NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";

export async function GET(req: Request) {
  const unauthorized = requireCronAuth(req);
  if (unauthorized) return unauthorized;

  return NextResponse.json({
    success: true,
    disabled: true,
    reason: "legacy global profit/loss broadcast is retired",
    replacement: "/api/cron/favorite-ai-check",
  });
}
