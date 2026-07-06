import { NextResponse } from "next/server";
import { buildPostgresLearningQualityReport } from "@/app/lib/learning/learningQualityReporter";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "V21_1_POSTGRES_LEARNING_QUALITY_0706";

export async function GET() {
  try {
    const report = await buildPostgresLearningQualityReport();

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
