import { NextRequest, NextResponse } from "next/server";
import { runAutoLearning } from "@/app/lib/learning/autoLearningRunner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toNumber(value: string | null, fallback: number): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get("mode") ?? "preview";
    const judgeLimit = toNumber(searchParams.get("limit"), 100);
    const minSampleCount = toNumber(searchParams.get("minSampleCount"), 3);

    const report = await runAutoLearning({
      mode,
      judgeLimit,
      minSampleCount,
    });

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        debugVersion: "V22_AUTO_AI_LEARNING_SYSTEM_0706",
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "auto learning failed",
      },
      { status: 500 }
    );
  }
}
