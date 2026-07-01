import { VERIFICATION_EXCLUDED_STOCKS } from "@/app/lib/verificationExcludedStocks";
import { NextResponse } from "next/server";
import { STOCKS, type Stock } from "@/app/lib/stockList";
import { saveVerificationLog } from "@/app/lib/verification";

export const dynamic = "force-dynamic";

type VerificationError = {
  code?: string;
  name?: string;
  reason: string;
};

function getUniqueStocks(stocks: Stock[]) {
  const map = new Map<string, Stock>();

  for (const stock of stocks) {
    if (!map.has(stock.code)) {
      map.set(stock.code, stock);
    }
  }

  return Array.from(map.values());
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const scanRes = await fetch(
  `${baseUrl}/api/scan?limit=1000&t=${Date.now()}`,
  {
    cache: "no-store",
  }
);

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

    const uniqueStocks = getUniqueStocks(STOCKS).slice(0, 1000);

    const returnedCodeSet = new Set(
      stocks.map((stock: any) => String(stock.code))
    );

    const missingStocks = uniqueStocks
      .filter((stock) => !returnedCodeSet.has(String(stock.code)))
      .map((stock) => ({
        code: stock.code,
        name: stock.name,
        reason: "scan結果に未返却",
      }));

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
      else errors.push({
        code: stock.code,
        reason: "銘柄名なし",
      });

      if (stock.price !== null && stock.price !== undefined)
        validPrice++;
      else
        errors.push({
          code: stock.code,
          name: stock.name,
          reason: "現在価格なし",
        });

      if (stock.score !== null && stock.score !== undefined)
        validScore++;
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
    const requestedLimit =
      scanData.requestedLimit ?? 1000;

    const totalStockList =
      scanData.totalStockList ??
      uniqueStocks.length;

    const missingCount =
      missingStocks.length;
      const excludedCodeSet = new Set(
  VERIFICATION_EXCLUDED_STOCKS.map((stock) => String(stock.code))
);

const excludedMissingStocks = missingStocks.filter((stock) =>
  excludedCodeSet.has(String(stock.code))
);

const investigationRequiredStocks = missingStocks.filter(
  (stock) => !excludedCodeSet.has(String(stock.code))
);

const excludedCount = excludedMissingStocks.length;
const investigationRequiredCount = investigationRequiredStocks.length;

const acquisitionRate =
  totalStockList > 0 ? stockCount / totalStockList : 0;

   const pass =
  scanData.success === true &&
  acquisitionRate >= 0.99 &&
  validCode === stockCount &&
  validName === stockCount &&
  validPrice === stockCount &&
  validScore === stockCount &&
  validReason === stockCount &&
  errors.length === 0;
          await saveVerificationLog({
      status: pass ? "PASS" : "FAIL",
      stockCount,
      missingCount,
      validCode,
      validName,
      validPrice,
      validScore,
      validReason,
      errorCount: errors.length,
      scanMs: scanData.scanMs ?? 0,
      debugVersion: scanData.debugVersion ?? "",
    });

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
      acquisitionRate,

      missingCount,
      missingStocks,
      excludedCount,
excludedMissingStocks,
investigationRequiredCount,
investigationRequiredStocks,

      validCode,
      validName,
      validPrice,
      validScore,
      validReason,

      errorCount: errors.length,
      errors: errors.slice(0, 100),
    });
  } catch (error) {
    console.error("Verification Error:", error);

    return NextResponse.json(
      {
        success: false,
        status: "ERROR",
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}