import { NextRequest, NextResponse } from "next/server";
import { getExperienceReport } from "@/app/lib/learning/experienceAiEngine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toNumber(value: string | null, fallback: number): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const report = await getExperienceReport({
      patternKey: searchParams.get("patternKey"),
      rsiBand: searchParams.get("rsiBand"),
      macdKey: searchParams.get("macdKey"),
      vwapKey: searchParams.get("vwapKey"),
      ema20Key: searchParams.get("ema20Key"),
      trendKey: searchParams.get("trendKey"),
      minSampleCount: toNumber(searchParams.get("minSampleCount"), 3),
    });

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        debugVersion: "V23_1_EXPERIENCE_AI_WIN_LOSE_RATE_0707",
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "experience ai failed",
      },
      { status: 500 }
    );
  }
}
