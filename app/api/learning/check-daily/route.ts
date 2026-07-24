import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DailyResult = "WIN" | "LOSE" | "HOLD";

type UpdateItem = {
  id: string;
  code: string;
  entryPrice: number;
  nextPrice: number;
  changePercent: number;
  result: DailyResult;
};

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 200;
const CHECK_DAILY_LOCK_KEY = 73124001;

function getJstDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toNumber(value: unknown, fallback = 0): number {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

function calculateChangePercent(
  entryPrice: number,
  nextPrice: number
): number {
  const changePercent =
    ((nextPrice - entryPrice) / entryPrice) * 100;

  return Math.round(changePercent * 100) / 100;
}

function judgeResult(changePercent: number): DailyResult {
  if (changePercent >= 2) return "WIN";
  if (changePercent <= -2) return "LOSE";

  return "HOLD";
}

async function bulkUpdateDailyResults(
  client: any,
  updates: UpdateItem[]
): Promise<number> {
  if (updates.length === 0) return 0;

  const values: unknown[] = [];

  const placeholders = updates.map((item, index) => {
    const base = index * 4;

    values.push(
      item.id,
      item.nextPrice,
      item.changePercent,
      item.result
    );

    return `(
      $${base + 1}::text,
      $${base + 2}::double precision,
      $${base + 3}::double precision,
      $${base + 4}::text
    )`;
  });

  const result = await client.query(
    `
    WITH update_values (
      id,
      next_price,
      change_percent,
      result
    ) AS (
      VALUES ${placeholders.join(",")}
    )
    UPDATE daily_stock_results AS daily
    SET
      next_price = update_values.next_price,
      change_percent = update_values.change_percent,
      result = update_values.result,
      checked_at = NOW()
    FROM update_values
    WHERE daily.id = update_values.id
      AND daily.result = 'UNKNOWN'
    `,
    values
  );

  return result.rowCount ?? 0;
}

async function bulkUpdateExperienceLogs(
  client: any,
  targetDate: string,
  updates: UpdateItem[]
): Promise<number> {
  if (updates.length === 0) return 0;

  const values: unknown[] = [targetDate];

  const placeholders = updates.map((item, index) => {
    const codePosition = index * 2 + 2;
    const resultPosition = index * 2 + 3;

    values.push(item.code, item.result);

    return `(
      $${codePosition}::text,
      $${resultPosition}::text
    )`;
  });

  const result = await client.query(
    `
    WITH update_values (
      code,
      result
    ) AS (
      VALUES ${placeholders.join(",")}
    )
    UPDATE experience_learning_logs AS experience
    SET result = update_values.result
    FROM update_values
    WHERE experience.trade_date = $1::date
      AND experience.code = update_values.code
      AND experience.result = 'UNKNOWN'
    `,
    values
  );

  return result.rowCount ?? 0;
}

export async function GET(request: Request) {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    const url = new URL(request.url);

    const requestedDate =
      url.searchParams.get("date");

    const requestedBatchSize = toNumber(
      url.searchParams.get("batchSize"),
      DEFAULT_BATCH_SIZE
    );

    const batchSize = Math.max(
      1,
      Math.min(
        MAX_BATCH_SIZE,
        Math.floor(requestedBatchSize)
      )
    );

    if (
      requestedDate &&
      !isValidDateString(requestedDate)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "invalid date",
          message:
            "dateはYYYY-MM-DD形式で指定してください。",
        },
        { status: 400 }
      );
    }

    const lockResult = await client.query(
      `
      SELECT pg_try_advisory_lock($1) AS acquired
      `,
      [CHECK_DAILY_LOCK_KEY]
    );

    lockAcquired =
      lockResult.rows[0]?.acquired === true;

    if (!lockAcquired) {
      return NextResponse.json(
        {
          success: false,
          running: true,
          message:
            "別の答え合わせ処理が実行中です。少し待ってから再度実行してください。",
        },
        { status: 409 }
      );
    }

    const todayJst = getJstDateString();

    /*
     * DBに保存されている最新の価格日を取得する。
     * /api/scanは呼ばない。
     */
    const latestPriceDateResult =
      await client.query(
        `
        SELECT MAX(date) AS latest_date
        FROM daily_stock_results
        WHERE price IS NOT NULL
          AND price > 0
        `
      );

    const latestPriceDate =
      latestPriceDateResult.rows[0]?.latest_date
        ? String(
            latestPriceDateResult.rows[0].latest_date
          ).slice(0, 10)
        : null;

    if (!latestPriceDate) {
      return NextResponse.json(
        {
          success: false,
          error: "latest price date not found",
          message:
            "比較に使える最新の価格データがありません。",
        },
        { status: 400 }
      );
    }

    if (
      requestedDate &&
      requestedDate >= latestPriceDate
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "future price data is not available",
          targetDate: requestedDate,
          latestPriceDate,
          message:
            "予測日より後の価格データがないため、まだ答え合わせできません。",
        },
        { status: 400 }
      );
    }

    let targetDate: string | null =
      requestedDate;

    /*
     * 最新価格日より前にあるUNKNOWNデータのうち、
     * 最も新しい予測日を選択する。
     */
    if (!targetDate) {
      const targetDateResult =
        await client.query(
          `
          SELECT MAX(date) AS target_date
          FROM daily_stock_results
          WHERE result = 'UNKNOWN'
            AND date < $1
          `,
          [latestPriceDate]
        );

      targetDate =
        targetDateResult.rows[0]?.target_date
          ? String(
              targetDateResult.rows[0].target_date
            ).slice(0, 10)
          : null;
    }

    if (!targetDate) {
      return NextResponse.json({
        success: true,
        completed: true,
        checkedAt: new Date().toISOString(),
        todayJst,
        latestPriceDate,
        date: null,
        updatedCount: 0,
        remainingCount: 0,
        message:
          "答え合わせ可能な判定待ちデータはありません。",
      });
    }

    /*
     * 最新日の同一銘柄価格とJOINして、
     * 今回処理する判定待ちデータを取得する。
     */
    const targetResult = await client.query(
      `
      WITH latest_prices AS (
        SELECT DISTINCT ON (code)
          code,
          price
        FROM daily_stock_results
        WHERE date = $1
          AND price IS NOT NULL
          AND price > 0
        ORDER BY
          code,
          created_at DESC
      )
      SELECT
        target.id,
        target.code,
        target.name,
        target.score,
        target.price AS entry_price,
        latest.price AS next_price
      FROM daily_stock_results AS target
      INNER JOIN latest_prices AS latest
        ON latest.code = target.code
      WHERE target.date = $2
        AND target.result = 'UNKNOWN'
        AND target.price IS NOT NULL
        AND target.price > 0
      ORDER BY
        target.score DESC,
        target.created_at ASC
      LIMIT $3
      `,
      [
        latestPriceDate,
        targetDate,
        batchSize,
      ]
    );

    const updates: UpdateItem[] =
      targetResult.rows
        .map((row: any) => {
          const entryPrice = toNumber(
            row.entry_price
          );

          const nextPrice = toNumber(
            row.next_price
          );

          if (
            entryPrice <= 0 ||
            nextPrice <= 0
          ) {
            return null;
          }

          const changePercent =
            calculateChangePercent(
              entryPrice,
              nextPrice
            );

          return {
            id: String(row.id ?? ""),
            code: String(row.code ?? ""),
            entryPrice,
            nextPrice,
            changePercent,
            result:
              judgeResult(changePercent),
          } satisfies UpdateItem;
        })
        .filter(
          (
            item: UpdateItem | null
          ): item is UpdateItem =>
            item !== null
        );

    const winCount = updates.filter(
      (item) => item.result === "WIN"
    ).length;

    const loseCount = updates.filter(
      (item) => item.result === "LOSE"
    ).length;

    const holdCount = updates.filter(
      (item) => item.result === "HOLD"
    ).length;

    let updatedCount = 0;
    let experienceUpdatedCount = 0;

    if (updates.length > 0) {
      await client.query("BEGIN");

      try {
        updatedCount =
          await bulkUpdateDailyResults(
            client,
            updates
          );

        experienceUpdatedCount =
          await bulkUpdateExperienceLogs(
            client,
            targetDate,
            updates
          );

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    const remainingResult =
      await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM daily_stock_results
        WHERE date = $1
          AND result = 'UNKNOWN'
        `,
        [targetDate]
      );

    const remainingCount = toNumber(
      remainingResult.rows[0]?.count
    );

    const comparableRemainingResult =
      await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM daily_stock_results AS target
        WHERE target.date = $1
          AND target.result = 'UNKNOWN'
          AND EXISTS (
            SELECT 1
            FROM daily_stock_results AS latest
            WHERE latest.date = $2
              AND latest.code = target.code
              AND latest.price IS NOT NULL
              AND latest.price > 0
          )
        `,
        [targetDate, latestPriceDate]
      );

    const comparableRemainingCount =
      toNumber(
        comparableRemainingResult.rows[0]
          ?.count
      );

    const missingPriceCount =
      Math.max(
        0,
        remainingCount -
          comparableRemainingCount
      );

    return NextResponse.json({
      success: true,
      completed:
        comparableRemainingCount === 0,
      checkedAt: new Date().toISOString(),
      todayJst,
      date: targetDate,
      priceDate: latestPriceDate,
      automaticallySelected:
        requestedDate === null,
      batchSize,
      targetCount:
        targetResult.rows.length,
      updatedCount,
      remainingCount,
      comparableRemainingCount,
      missingPriceCount,
      winCount,
      loseCount,
      holdCount,
      experienceUpdatedCount,
      message:
        comparableRemainingCount > 0
          ? `今回は${updatedCount}件を処理しました。比較可能な残りは${comparableRemainingCount}件です。`
          : `今回は${updatedCount}件を処理しました。この日付の比較可能なデータは完了しました。`,
      nextRequest:
        comparableRemainingCount > 0
          ? `/api/learning/check-daily?date=${targetDate}&batchSize=${batchSize}`
          : null,
      dataSource:
        "daily_stock_resultsに保存済みの最新価格",
      rule: {
        win: "予測時価格から2%以上上昇",
        lose: "予測時価格から2%以上下落",
        hold: "騰落率が±2%未満",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        checkedAt:
          new Date().toISOString(),
        error: "check daily failed",
        message:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  } finally {
    if (lockAcquired) {
      try {
        await client.query(
          `
          SELECT pg_advisory_unlock($1)
          `,
          [CHECK_DAILY_LOCK_KEY]
        );
      } catch (error) {
        console.error(
          "check-daily unlock failed:",
          error
        );
      }
    }

    client.release();
  }
}