import { NextResponse } from "next/server";
import { getNotificationLogs } from "@/app/lib/notificationLog";
import { saveNotificationResult } from "@/app/lib/notificationResult";

export const dynamic = "force-dynamic";

type Stock = {
  code: string;
  price?: number;
};

function getJapanTime() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Tokyo",
    })
  );
}

function isAfterMarketClose() {
  const now = getJapanTime();
  const hour = now.getHours();
  const minute = now.getMinutes();
  return hour > 15 || (hour === 15 && minute >= 30);
}

function isNextDay(notifiedAt: string) {
  const notified = new Date(notifiedAt);
  const now = new Date();

  const notifiedJp = new Date(
    notified.toLocaleString("en-US", {
      timeZone: "Asia/Tokyo",
    })
  );

  const nowJp = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Tokyo",
    })
  );

  return (
    nowJp.getFullYear() > notifiedJp.getFullYear() ||
    nowJp.getMonth() > notifiedJp.getMonth() ||
    nowJp.getDate() > notifiedJp.getDate()
  );
}

export async function GET() {
  try {
    const logs = await getNotificationLogs();

    if (logs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "通知履歴なし",
        checked: 0,
      });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    const scanRes = await fetch(`${baseUrl}/api/scan`, {
      cache: "no-store",
    });

    const scanJson = await scanRes.json();
    const stocks: Stock[] = scanJson.stocks || [];

    const latestLogs = logs.slice(0, 10);
    const savedResults = [];

    for (const log of latestLogs) {
      const stock = stocks.find((s) => s.code === log.code);
      const currentPrice = stock?.price ?? null;

      const closePrice = isAfterMarketClose()
        ? currentPrice
        : null;

      const nextClosePrice = isNextDay(log.notifiedAt)
        ? currentPrice
        : null;

      const saved = await saveNotificationResult(log, {
        price1h: currentPrice,
        closePrice,
        nextClosePrice,
      });

      savedResults.push(saved);
    }

    return NextResponse.json({
      success: true,
      checked: savedResults.length,
      afterMarketClose: isAfterMarketClose(),
      results: savedResults,
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