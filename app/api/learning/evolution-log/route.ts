import { NextRequest, NextResponse } from "next/server";
import {
  getRecentEvolutionLogs,
  runEvolutionLogger,
} from "@/app/lib/learning/evolutionLogger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toNumber(value: string | null, fallback: number): number {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? "run";

    if (action === "logs") {
      const logs = await getRecentEvolutionLogs(
        toNumber(searchParams.get("limit"), 10)
      );

      return NextResponse.json({
        success: true,
        debugVersion: "V24_3_EVOLUTION_LOGGER_0707",
        checkedAt: new Date().toISOString(),
        count: logs.length,
        logs,
        latest: logs[0] ?? null,
      });
    }

    const report = await runEvolutionLogger({
      mode: searchParams.get("mode") ?? "preview",
      minJudgedCount: toNumber(searchParams.get("minJudgedCount"), 5),
      weightLimit: toNumber(searchParams.get("weightLimit"), 100),
      minSampleCount: toNumber(searchParams.get("minSampleCount"), 3),
    });

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        debugVersion: "V24_3_EVOLUTION_LOGGER_0707",
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "evolution logger failed",
      },
      { status: 500 }
    );
  }
}
