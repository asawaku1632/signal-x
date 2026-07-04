import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const baseUrl = new URL(req.url).origin;

    const generateRes = await fetch(
      `${baseUrl}/api/ai-power/recommendations/generate`,
      { cache: "no-store" }
    );
    const generateData = await generateRes.json();

    if (!generateData.success) {
      throw new Error("GENERATE_FAILED");
    }

    const saveRes = await fetch(
      `${baseUrl}/api/ai-power/recommendations/save-generated`,
      { cache: "no-store" }
    );
    const saveData = await saveRes.json();

    if (!saveData.success) {
      throw new Error("SAVE_FAILED");
    }

    const applyRes = await fetch(
      `${baseUrl}/api/ai-power/apply-recommendations`,
      { cache: "no-store" }
    );
    const applyData = await applyRes.json();

    if (!applyData.success) {
      throw new Error("APPLY_FAILED");
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V11.3_AUTO_EVOLVE",
      generated: generateData.recommendationCount ?? 0,
      saved: saveData.savedCount ?? 0,
      applied: applyData.applied ?? 0,
      evolutionLogsAdded:
        applyData.evolutionLogsAdded ?? 0,
      apiTimeMs: Date.now() - startedAt,
      baseUrl,
      steps: {
        generate: generateData.success,
        save: saveData.success,
        apply: applyData.success,
      },
    });
  } catch (error) {
    console.error("auto evolve error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V11.3_AUTO_EVOLVE",
        error:
          error instanceof Error
            ? error.message
            : String(error),
        apiTimeMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}