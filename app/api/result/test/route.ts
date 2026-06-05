import { NextResponse } from "next/server";
import { saveNotificationLog } from "@/app/lib/notificationLog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const saved = await saveNotificationLog({
      code: "7203",
      name: "トヨタ",
      price: 2911.5,
      aiPower: 79,
      judge: "無理に入るな",
      takeProfit: 2984,
      stopLoss: 2824,
    });

    return NextResponse.json({
      success: true,
      message: "テスト通知ログを保存しました",
      saved,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}