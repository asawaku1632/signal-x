import "server-only";
import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { verifyResearchDailyMergeContract } from "@/app/lib/research/bollingerDailyCloseLedger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Manual contract verification only. Never reads or writes a database. */
export async function GET() {
  if (!(await getLearningOwnerSession()).isOwner) {
    return NextResponse.json({ success: false, error: "OWNER_ONLY" }, { status: 403, headers });
  }
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.BB_DAILY100_DEV_DIAGNOSTIC !== "true") {
    return NextResponse.json({ success: false, error: "PREVIEW_ONLY_DISABLED" }, { status: 404, headers });
  }
  try {
    const passed = verifyResearchDailyMergeContract();
    return NextResponse.json({
      success: passed,
      mode: "OWNER_PREVIEW_READ_ONLY_DAILY_LEDGER_CONTRACT",
      contractPassed: passed,
      scenarios: ["first_insert", "repeat_idempotency", "next_trading_day", "price_conflict_preserves_original", "duplicate_incoming"],
      persisted: false,
      databaseAccessed: false,
      cronEnabled: false,
    }, { status: passed ? 200 : 500, headers });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message.slice(0, 100) : "UNKNOWN",
    }, { status: 500, headers });
  }
}
