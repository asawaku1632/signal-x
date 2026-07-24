import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DailyResult = "WIN" | "LOSE" | "HOLD";

type UpdateItem = {
  id: string;
  code: string;
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

    const requestedDate = url.searchParams.get("date");

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
            "別の答え合わせ処理が実行中です。少し待ってから再実行してください。",
        },
        { status: 409 }
      );
    }

    const todayJst = getJstDateString();

    /*
     * 日付指定がない場合：
     * 後日の価格データが存在するUNKNOWN日のうち、
     * 最も新しい予測日を選択する。
     */
    let targetDate: string | null = requestedDate;

    if (!targetDate) {
      const targetDateResult = await client.query(
        `
        SELECT MAX(target.date) AS target_date
        FROM daily_stock_results AS target
        WHERE target.result = 'UNKNOWN'
          AND target.date < $1
          AND EXISTS (
            SELECT 1
            FROM daily_stock_results AS future
            WHERE future.date > target.date
              AND future.price IS NOT NULL
              AND future.price > 0
          )
        `,
        [todayJst]
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
        date: null,
        priceDate: null,
        updatedCount: 0,
        remainingCount: 0,
        message:
          "答え合わせ可能な判定待ちデータはありません。",
      });
    }

    if (targetDate >= todayJst) {
      return NextResponse.json(
        {
          success: false,
          error: "same-day judgement is not allowed",
          targetDate,
          todayJst,
          message:
            "当日分はまだ答え合わせできません。",
        },
        { status: 400 }
      );
    }

    /*
     * 予測日より後に存在する最初の日付を取得する。
     * これが翌営業日の価格日になる。
     */
    const nextPriceDateResult = await client.query(
      `
      SELECT MIN(date) AS next_price_date
      FROM daily_stock_results
      WHERE date > $1
        AND price IS NOT NULL
        AND price > 0
      `,
      [targetDate]
    );

    const nextPriceDate =
      nextPriceDateResult.rows[0]?.next_price_date
        ? String(
            nextPriceDateResult.rows[0].next_price_date
          ).slice(0, 10)
        : null;

    if (!nextPriceDate) {
      return NextResponse.json(
        {
          success: false,
          error: "next price date not found",
          targetDate,
          message:
            "予測日より後の価格データがまだありません。",
        },
        { status: 400 }
      );
    }

    /*
     * 翌営業日の同一銘柄価格とJOINする。
     */
    const targetResult = await client.query(
      `
      WITH next_prices AS (
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
        next_prices.price AS next_price
      FROM daily_stock_results AS target
      INNER JOIN next_prices
        ON next_prices.code = target.code
      WHERE target.date = $2
        AND target.result = 'UNKNOWN'
        AND target.price IS NOT NULL
        AND target.price > 0
      ORDER BY
        target.score DESC,
        target.created_at ASC
      LIMIT $3
      `,
      [nextPriceDate, targetDate, batchSize]
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
            code: String(row.code ?? "").trim(),
            nextPrice,
            changePercent,
            result: judgeResult(changePercent),
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

    const remainingResult = await client.query(
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
            FROM daily_stock_results AS next_day
            WHERE next_day.date = $2
              AND next_day.code = target.code
              AND next_day.price IS NOT NULL
              AND next_day.price > 0
          )
        `,
        [targetDate, nextPriceDate]
      );

    const comparableRemainingCount = toNumber(
      comparableRemainingResult.rows[0]?.count
    );

    const missingPriceCount = Math.max(
      0,
      remainingCount - comparableRemainingCount
    );

    return NextResponse.json({
      success: true,
      completed: comparableRemainingCount === 0,
      checkedAt: new Date().toISOString(),
      todayJst,
      date: targetDate,
      priceDate: nextPriceDate,
      automaticallySelected:
        requestedDate === null,
      batchSize,
      targetCount: targetResult.rows.length,
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
          : `今回は${updatedCount}件を処理しました。この日付の翌営業日比較が完了しました。`,
      nextRequest:
        comparableRemainingCount > 0
          ? `/api/learning/check-daily?date=${targetDate}&batchSize=${batchSize}`
          : null,
      dataSource:
        "daily_stock_resultsに保存された翌営業日の価格",
      rule: {
        win: "予測時価格から翌営業日に2%以上上昇",
        lose: "予測時価格から翌営業日に2%以上下落",
        hold: "翌営業日の騰落率が±2%未満",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        checkedAt: new Date().toISOString(),
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