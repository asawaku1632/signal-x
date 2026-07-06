import { NextResponse } from "next/server";
import { runDailyLearning } from "@/app/lib/learning/learningScheduler";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "V21_5_DAILY_LEARNING_SCHEDULER_0706";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "preview";
    const judgeLimit = Number(searchParams.get("limit") || 20);
    const minSampleCount = Number(searchParams.get("minSampleCount") || 3);

    const report = await runDailyLearning({
      mode,
      judgeLimit,
      minSampleCount,
    });

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      ...report,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        debugVersion: DEBUG_VERSION,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
