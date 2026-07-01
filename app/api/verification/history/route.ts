import { NextResponse } from "next/server";
import { getVerificationLogs } from "@/app/lib/verification";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logs = await getVerificationLogs(10);

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error("Verification History Error:", error);

    return NextResponse.json(
      {
        success: false,
        logs: [],
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}