import { NextRequest, NextResponse } from "next/server";
import { optimizeWeightRules } from "@/app/lib/learning/weightOptimizer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toNumber(value: string | null, fallback: number): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const report = await optimizeWeightRules({
      mode: searchParams.get("mode") ?? "preview",
      limit: toNumber(searchParams.get("limit"), 100),
      minSampleCount: toNumber(searchParams.get("minSampleCount"), 3),
    });

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        debugVersion: "V24_1_WEIGHT_OPTIMIZER_0707",
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "weight optimizer failed",
      },
      { status: 500 }
    );
  }
}
