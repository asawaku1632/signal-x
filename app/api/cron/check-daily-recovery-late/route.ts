import { runDailyCheckRecovery } from "@/app/lib/learning/dailyCheckRecoveryCron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// 17:30 JST on weekdays: final bounded catch-up pass.
export async function GET(request: Request) {
  return runDailyCheckRecovery(request, "/api/cron/check-daily-recovery-late");
}
