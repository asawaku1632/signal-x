import { NextResponse } from "next/server";
import { buildPatternJudgementPreview } from "@/app/lib/learning/patternJudgementEngine";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "V21_2_PATTERN_JUDGEMENT_PREVIEW_FIX1_0706";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 50);

    const report = await buildPatternJudgementPreview(limit);

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      mode: "preview",
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
