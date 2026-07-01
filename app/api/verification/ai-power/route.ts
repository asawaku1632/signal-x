import { NextResponse } from "next/server";

type Stock = {
  code?: string;
  name?: string;
  price?: number;
  currentPrice?: number;
  aiPower?: number;
  ai_power?: number;
  score?: number;
  rank?: string;
  reason?: string;
  reasons?: string[];
  comment?: string;
  judge?: string;
  signal?: string;
  requiredCapital?: number;
  required_capital?: number;
};

function getAiPower(stock: Stock): number | null {
  const value = stock.aiPower ?? stock.ai_power ?? stock.score;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getExpectedRank(aiPower: number): string {
  if (aiPower >= 85) return "S";
  if (aiPower >= 70) return "A";
  if (aiPower >= 50) return "B";
  return "C";
}

export async function GET(req: Request) {
  const start = Date.now();
  const url = new URL(req.url);
  const baseUrl = url.origin;

  try {
    const scanRes = await fetch(`${baseUrl}/api/scan?limit=1000`, {
      cache: "no-store",
    });

    if (!scanRes.ok) {
      return NextResponse.json({
        success: false,
        error: "SCAN_API_FAILED",
        status: scanRes.status,
      });
    }

    const scanJson = await scanRes.json();

    const stocks: Stock[] =
      scanJson.stocks ||
      scanJson.data ||
      scanJson.results ||
      scanJson.items ||
      [];

    const failedStocks: {
      code: string;
      name: string;
      errors: string[];
    }[] = [];

    for (const stock of stocks) {
      const errors: string[] = [];
      const code = String(stock.code ?? "UNKNOWN");
      const name = String(stock.name ?? "");

      const aiPower = getAiPower(stock);

      if (aiPower === null) {
        errors.push("AI_POWER_MISSING");
      } else {
        if (aiPower < 0 || aiPower > 100) {
          errors.push("AI_POWER_OUT_OF_RANGE");
        }

        if (stock.rank) {
          const expectedRank = getExpectedRank(aiPower);
          if (String(stock.rank).toUpperCase() !== expectedRank) {
            errors.push(`RANK_MISMATCH_EXPECTED_${expectedRank}`);
          }
        }
      }

      const hasReason =
        typeof stock.reason === "string" && stock.reason.trim().length > 0;

      const hasReasons =
        Array.isArray(stock.reasons) && stock.reasons.length > 0;

      const hasComment =
        typeof stock.comment === "string" && stock.comment.trim().length > 0;

      if (!hasReason && !hasReasons && !hasComment) {
        errors.push("REASON_MISSING");
      }

      const price = stock.price ?? stock.currentPrice;
      const requiredCapital = stock.requiredCapital ?? stock.required_capital;

      if (typeof price === "number" && typeof requiredCapital === "number") {
        const expectedCapital = price * 100;
        const diff = Math.abs(requiredCapital - expectedCapital);

        if (diff > Math.max(10, expectedCapital * 0.01)) {
          errors.push("REQUIRED_CAPITAL_MISMATCH");
        }
      }

       const hasJudge =
  typeof stock.judge === "string" && stock.judge.trim().length > 0;

      if (errors.length > 0) {
        failedStocks.push({
          code,
          name,
          errors,
        });
      }
    }

    const checked = stocks.length;
    const fail = failedStocks.length;
    const pass = checked - fail;
    const passRate =
      checked > 0 ? Number(((pass / checked) * 100).toFixed(2)) : 0;

    return NextResponse.json({
      success: true,
      checked,
      pass,
      fail,
      passRate,
      status: fail === 0 && checked > 0 ? "PASS" : "FAIL",
      apiTimeMs: Date.now() - start,
      failedStocks,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "AI_POWER_VERIFICATION_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}