import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

type PatternLog = {
  id: number;
  code: string;
  name: string | null;
  entry_price: string | number | null;
};

type PriceMap = Map<string, number>;

const WIN_PERCENT = 2;
const LOSE_PERCENT = -2;

async function fetchCurrentPrice(code: string): Promise<number | null> {
  const symbol = `${code}.T`;

  async function fetchChart(range: string, interval: string) {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=${range}&interval=${interval}`,
      {
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const result = data.chart?.result?.[0];
    const close =
      result?.meta?.regularMarketPrice ??
      result?.indicators?.quote?.[0]?.close?.filter(Boolean)?.at(-1);

    return typeof close === "number" && Number.isFinite(close)
      ? close
      : null;
  }

  const intraday = await fetchChart("1d", "5m");
  if (intraday !== null) return intraday;

  const daily = await fetchChart("5d", "1d");
  if (daily !== null) return daily;

  return null;
}

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
) {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn));

    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results;
}

function judgeResult(entryPrice: number, currentPrice: number) {
  const changePercent = ((currentPrice - entryPrice) / entryPrice) * 100;

  if (changePercent >= WIN_PERCENT) {
    return {
      result: "WIN",
      changePercent,
    };
  }

  if (changePercent <= LOSE_PERCENT) {
    return {
      result: "LOSE",
      changePercent,
    };
  }

  return {
    result: "HOLD",
    changePercent,
  };
}

async function updateResults(
  logs: PatternLog[],
  priceMap: PriceMap
) {
  let win = 0;
  let lose = 0;
  let hold = 0;
  let skipped = 0;
  let updated = 0;

  for (const log of logs) {
    const entryPrice = Number(log.entry_price);
    const currentPrice = priceMap.get(log.code);

    if (
      !Number.isFinite(entryPrice) ||
      entryPrice <= 0 ||
      typeof currentPrice !== "number" ||
      !Number.isFinite(currentPrice)
    ) {
      skipped += 1;
      continue;
    }

    const judged = judgeResult(entryPrice, currentPrice);

    if (judged.result === "WIN") win += 1;
    if (judged.result === "LOSE") lose += 1;
    if (judged.result === "HOLD") hold += 1;

    await pool.query(
      `
      UPDATE pattern_learning_logs
      SET
        result = $1
      WHERE id = $2
      `,
      [judged.result, log.id]
    );

    updated += 1;
  }

  return {
    updated,
    win,
    lose,
    hold,
    skipped,
  };
}
export async function GET(req: Request) {
  const startedAt = Date.now();

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 1000);

    const { rows } = await pool.query(
      `
      SELECT
        id,
        code,
        name,
        entry_price
      FROM pattern_learning_logs
      WHERE result = 'UNKNOWN'
      ORDER BY created_at ASC
      LIMIT $1
      `,
      [limit]
    );

    const logs = rows as PatternLog[];

    if (logs.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        updated: 0,
        win: 0,
        lose: 0,
        hold: 0,
        skipped: 0,
        message: "判定待ちのパターン学習ログはありません。",
        apiTimeMs: Date.now() - startedAt,
      });
    }

    const uniqueCodes = Array.from(
      new Set(logs.map((log) => log.code).filter(Boolean))
    );

    const priceResults = await runInBatches(uniqueCodes, 20, async (code) => {
      const price = await fetchCurrentPrice(code);

      return {
        code,
        price,
      };
    });

    const priceMap: PriceMap = new Map();

    for (const item of priceResults) {
      if (
        item.price !== null &&
        typeof item.price === "number" &&
        Number.isFinite(item.price)
      ) {
        priceMap.set(item.code, item.price);
      }
    }

    const result = await updateResults(logs, priceMap);

    return NextResponse.json({
      success: true,
      checked: logs.length,
      uniqueCodes: uniqueCodes.length,
      priceFound: priceMap.size,
      ...result,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("pattern learning check error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "PATTERN_LEARNING_CHECK_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}