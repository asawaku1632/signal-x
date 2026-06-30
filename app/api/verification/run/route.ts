import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type VerificationError = {
  code?: string;
  name?: string;
  reason: string;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const scanRes = await fetch(`${baseUrl}/api/scan?limit=1000`, {
      cache: "no-store",
    });

    if (!scanRes.ok) {
      return NextResponse.json(
        {
          success: false,
          status: "ERROR",
          error: `/api/scan error: ${scanRes.status}`,
        },
        { status: 500 }
      );
    }

    const scanData = await scanRes.json();
    const stocks = scanData.stocks || [];

    let validCode = 0;
    let validName = 0;
    let validPrice = 0;
    let validScore = 0;
    let validReason = 0;

    const errors: VerificationError[] = [];

    for (const stock of stocks) {
      if (stock.code) validCode++;
      else errors.push({ reason: "銘柄コードなし" });

      if (stock.name) validName++;
      else errors.push({ code: stock.code, reason: "銘柄名なし" });

      if (stock.price !== null && stock.price !== undefined) validPrice++;
      else
        errors.push({
          code: stock.code,
          name: stock.name,
          reason: "現在価格なし",
        });

      if (stock.score !== null && stock.score !== undefined) validScore++;
      else
        errors.push({
          code: stock.code,
          name: stock.name,
          reason: "AI POWERなし",
        });

      if (
        stock.reasons ||
        stock.reason ||
        stock.comment ||
        stock.description
      ) {
        validReason++;
      } else {
        errors.push({
          code: stock.code,
          name: stock.name,
          reason: "判定理由なし",
        });
      }
    }

    const stockCount = stocks.length;
    const requestedLimit = scanData.requestedLimit ?? 1000;
    const totalStockList = scanData.totalStockList ?? null;
    const missingCount = Math.max(0, 1000 - stockCount);

    const pass =
      scanData.success === true &&
      stockCount === 1000 &&
      validCode === stockCount &&
      validName === stockCount &&
      validPrice === stockCount &&
      validScore === stockCount &&
      validReason === stockCount &&
      errors.length === 0;

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),

      status: pass ? "PASS" : "FAIL",

      scanSuccess: scanData.success,
      cached: scanData.cached ?? false,
      fallback: scanData.fallback ?? false,
      debugVersion: scanData.debugVersion,

      requestedLimit,
      totalStockList,
      stockCount,
      missingCount,

      validCode,
      validName,
      validPrice,
      validScore,
      validReason,

      errorCount: errors.length,
      errors: errors.slice(0, 100),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: "ERROR",
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}