import { NextResponse } from "next/server";
import { runPatternJudge } from "@/app/lib/learning/patternJudgeEngine";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "V21_4_PATTERN_JUDGE_ENGINE_0706";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "preview";
    const limit = Number(searchParams.get("limit") || 20);

    const report = await runPatternJudge({
      mode,
      limit,
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
