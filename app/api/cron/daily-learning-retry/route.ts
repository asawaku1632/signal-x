import type { NextRequest } from "next/server";

import { runDailyLearningCron } from "@/app/api/cron/daily-learning/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return runDailyLearningCron(request);
}
