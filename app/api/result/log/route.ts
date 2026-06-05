import { NextResponse } from "next/server";
import {
  getNotificationLogs,
  saveNotificationLog,
} from "@/app/lib/notificationLog";

export const dynamic = "force-dynamic";

export async function GET() {
  const logs = await getNotificationLogs();

  return NextResponse.json({
    success: true,
    logs,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const saved = await saveNotificationLog({
      code: body.code,
      name: body.name,
      price: Number(body.price),
      aiPower: Number(body.aiPower),
      judge: body.judge,
      takeProfit: Number(body.takeProfit),
      stopLoss: Number(body.stopLoss),
    });

    return NextResponse.json({
      success: true,
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