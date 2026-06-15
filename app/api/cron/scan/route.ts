import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CACHE_TTL = 30 * 1000;

// まずは安全に200。
// Vercel環境変数 SCAN_LIMIT を変えれば 500 → 1000 に増やせる。
const DEFAULT_SCAN_LIMIT = Number(process.env.SCAN_LIMIT || 200);

type ScanCache = {
  timestamp: number;
  limit: number;
  data: any;
};

declare global {
  var signalxScanCache: ScanCache | undefined;
}

// 仮の銘柄リスト
// 既に別ファイルで銘柄リストを管理している場合は、ここを置き換える
const stockList = [
  "7203",
  "9984",
  "8306",
  "9432",
  "6758",
  "8035",
  "7974",
  "6861",
  "6098",
  "4063",
  "4502",
  "4519",
  "4568",
  "6501",
  "6503",
  "6594",
  "6723",
  "6981",
  "7011",
  "7012",
  "7267",
  "7751",
  "8001",
  "8058",
  "8316",
  "8411",
  "8591",
  "8766",
  "8801",
  "9020",
  "9022",
  "9101",
  "9104",
  "9202",
  "9433",
  "9434",
  "9501",
  "9503",
  "9613",
  "9843",
  "2914",
  "3382",
  "3402",
  "3407",
  "3659",
  "3697",
  "4901",
  "5020",
  "5401",
  "5802",
];

function clampLimit(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SCAN_LIMIT;
  if (value < 1) return DEFAULT_SCAN_LIMIT;
  if (value > 1000) return 1000;
  return value;
}

function calcAiPower(code: string) {
  // ここは仮ロジック。
  // 既存のAI POWER計算がある場合は後でそこに差し替える。
  const seed = Number(code.slice(-2));
  return Math.min(100, Math.max(40, 50 + seed));
}

function judgeFromPower(power: number) {
  if (power >= 85) return "激熱";
  if (power >= 70) return "強い";
  if (power >= 50) return "静観";
  return "触るな";
}

async function scanStock(code: string) {
  // TODO:
  // ここを既存のYahoo取得・RSI・出来高・ローソク判定処理に差し替える
  const aiPower = calcAiPower(code);

  return {
    code,
    name: code,
    price: 1000 + Number(code.slice(-2)) * 10,
    changeRate: 0,
    volumeRate: 1,
    rsi: 50,
    aiPower,
    confidence: aiPower,
    finalJudge: aiPower >= 70 ? "買い候補" : "見送り",
    recommendation: judgeFromPower(aiPower),
    reason: "1000銘柄対応テスト用データ",
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(req.url);

    const requestedLimit = Number(
      searchParams.get("limit") || DEFAULT_SCAN_LIMIT
    );

    const limit = clampLimit(requestedLimit);
    const now = Date.now();

    // 30秒以内ならキャッシュを返す
    if (
      globalThis.signalxScanCache &&
      now - globalThis.signalxScanCache.timestamp < CACHE_TTL &&
      globalThis.signalxScanCache.limit === limit
    ) {
      return NextResponse.json({
        ...globalThis.signalxScanCache.data,
        cached: true,
        cacheAge: Math.floor(
          (now - globalThis.signalxScanCache.timestamp) / 1000
        ),
      });
    }

    const targetStocks = stockList.slice(0, limit);

    const results = await Promise.all(
      targetStocks.map(async (code) => {
        try {
          return await scanStock(code);
        } catch (error) {
          return {
            code,
            name: code,
            error: true,
            message: String(error),
          };
        }
      })
    );

    const validStocks = results.filter((s: any) => !s.error);

    const sortedStocks = validStocks.sort(
      (a: any, b: any) => (b.aiPower || 0) - (a.aiPower || 0)
    );

    const responseData = {
      success: true,
      stocks: sortedStocks,
      count: sortedStocks.length,
      requestedLimit: limit,
      cached: false,
      scanMs: Date.now() - startedAt,
      updatedAt: new Date().toISOString(),
    };

    globalThis.signalxScanCache = {
      timestamp: Date.now(),
      limit,
      data: responseData,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    if (globalThis.signalxScanCache) {
      return NextResponse.json({
        ...globalThis.signalxScanCache.data,
        success: true,
        cached: true,
        fallback: true,
        error: String(error),
      });
    }

    return NextResponse.json(
      {
        success: false,
        stocks: [],
        error: String(error),
      },
      { status: 500 }
    );
  }
}