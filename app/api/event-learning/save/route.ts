import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

function detectEventType(stock: any) {
  const reason = String(stock.reason ?? "");
  const patternSignal = String(stock.patternSignal ?? "");
  const candleSignal = String(stock.candleSignal ?? "");

  if (
    reason.includes("決算") ||
    reason.includes("上方修正") ||
    reason.includes("下方修正")
  ) {
    return "EARNINGS";
  }

  if (
    reason.includes("配当") ||
    reason.includes("増配") ||
    reason.includes("自社株買い")
  ) {
    return "SHAREHOLDER_RETURN";
  }

  if (
    reason.includes("ニュース") ||
    reason.includes("材料")
  ) {
    return "NEWS";
  }

  if (
    patternSignal !== "NONE" ||
    candleSignal !== "NONE"
  ) {
    return "TECHNICAL_EVENT";
  }

  return "NONE";
}

function getEventLabel(eventType: string) {
  switch (eventType) {
    case "EARNINGS":
      return "決算・業績イベント";
    case "SHAREHOLDER_RETURN":
      return "配当・自社株買い";
    case "NEWS":
      return "ニュース・材料";
    case "TECHNICAL_EVENT":
      return "テクニカルイベント";
    default:
      return "通常";
  }
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const scanRes = await fetch(`${baseUrl}/api/scan?limit=1000`, {
      cache: "no-store",
    });

    const scanData = await scanRes.json();

    if (!scanData.success) {
      throw new Error("SCAN_FAILED");
    }

    const stocks = scanData.stocks ?? [];
    const today = new Date().toISOString().slice(0, 10);

    let saved = 0;

    for (const stock of stocks) {
      const eventType = detectEventType(stock);
      const eventLabel = getEventLabel(eventType);

      await pool.query(
        `
        INSERT INTO event_learning_logs (
          trade_date,
          stock_code,
          stock_name,
          event_type,
          event_label,
          ai_power,
          entry_price,
          result
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,'PENDING'
        )
        ON CONFLICT (
          trade_date,
          stock_code,
          event_type
        )
        DO UPDATE SET
          stock_name = EXCLUDED.stock_name,
          event_label = EXCLUDED.event_label,
          ai_power = EXCLUDED.ai_power,
          entry_price = EXCLUDED.entry_price,
          result = 'PENDING'
        `,
        [
          today,
          stock.code,
          stock.name,
          eventType,
          eventLabel,
          Number(stock.aiPower ?? stock.score ?? 0),
          Number(stock.price ?? stock.currentPrice ?? 0),
        ]
      );

      saved++;
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.11_EVENT_SAVE",
      learningDate: today,
      saved,
      stockCount: stocks.length,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("event save error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.11_EVENT_SAVE",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}