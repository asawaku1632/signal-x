import { NextRequest, NextResponse } from "next/server";
import { evaluateAiPowerAccuracy } from "@/app/lib/learning/accuracyEvaluator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toNumber(value: string | null, fallback: number): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const report = await evaluateAiPowerAccuracy({
      mode: searchParams.get("mode") ?? "preview",
      minJudgedCount: toNumber(searchParams.get("minJudgedCount"), 5),
    });

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        debugVersion: "V24_2_AI_POWER_ACCURACY_EVALUATOR_FIX_0707",
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "accuracy evaluator failed",
      },
      { status: 500 }
    );
  }
}
