import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DailyResult = "WIN" | "LOSE" | "HOLD";

type TargetRow = {
  id: string;
  date: string;
  code: string;
  name: string;
  score: number;
  price: number;
};

type ScanStock = {
  code?: string | number;
  price?: string | number;
};

type UpdateItem = {
  id: string;
  code: string;
  nextPrice: number;
  changePercent: number;
  result: DailyResult;
};

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;
const SCAN_TIMEOUT_MS = 25_000;

/*
 * 同じ答え合わせ処理が同時に動かないようにする
 * PostgreSQL Advisory Lock用の固定キー
 */
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

function judgeResult(
  changePercent: number
): DailyResult {
  if (changePercent >= 2) {
    return "WIN";
  }

  if (changePercent <= -2) {
    return "LOSE";
  }

  return "HOLD";
}

function extractStocks(json: unknown): ScanStock[] {
  if (Array.isArray(json)) {
    return json as ScanStock[];
  }

  if (!json || typeof json !== "object") {
    return [];
  }

  const data = json as Record<string, unknown>;

  if (Array.isArray(data.stocks)) {
    return data.stocks as ScanStock[];
  }

  if (Array.isArray(data.results)) {
    return data.results as ScanStock[];
  }

  if (Array.isArray(data.data)) {
    return data.data as ScanStock[];
  }

  return [];
}

async function fetchCurrentPrices(
  origin: string
): Promise<Map<string, number>> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, SCAN_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${origin}/api/scan?limit=1200`,
      {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `scan api failed: ${response.status}`
      );
    }

    const json = await response.json();
    const stocks = extractStocks(json);

    const priceMap = new Map<string, number>();

    for (const stock of stocks) {
      const code = String(
        stock?.code ?? ""
      ).trim();

      const price = toNumber(stock?.price);

      if (
        code &&
        Number.isFinite(price) &&
        price > 0
      ) {
        priceMap.set(code, price);
      }
    }

    if (priceMap.size === 0) {
      throw new Error(
        "scan apiから有効な株価を取得できませんでした"
      );
    }

    return priceMap;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function bulkUpdateDailyResults(
  client: any,
  updates: UpdateItem[]
): Promise<number> {
  if (updates.length === 0) {
    return 0;
  }

  const values: unknown[] = [];

  const placeholders = updates.map(
    (item, index) => {
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
    }
  );

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
  if (updates.length === 0) {
    return 0;
  }

  const values: unknown[] = [targetDate];

  const placeholders = updates.map(
    (item, index) => {
      const codePosition = index * 2 + 2;
      const resultPosition = index * 2 + 3;

      values.push(item.code, item.result);

      return `(
        $${codePosition}::text,
        $${resultPosition}::text
      )`;
    }
  );

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

    /*
     * APIの二重実行を防止
     */
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
            "現在、別の答え合わせ処理が実行中です。少し待ってから再度開いてください。",
        },
        { status: 409 }
      );
    }

    const todayJst = getJstDateString();

    /*
     * 今日の予測を今日の価格で判定しない
     */
    if (
      requestedDate &&
      requestedDate >= todayJst
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "same-day judgement is not allowed",
          targetDate: requestedDate,
          todayJst,
          message:
            "当日の予測を当日の価格で判定することはできません。翌営業日以降に実行してください。",
        },
        { status: 400 }
      );
    }

    let targetDate: string | null =
      requestedDate;

    /*
     * daily_stock_results.dateはtext型。
     * YYYY-MM-DD形式なので文字列のまま比較する。
     *
     * 日付指定がない場合は、
     * 今日より前にある最新のUNKNOWN日を取得する。
     */
    if (!targetDate) {
      const dateResult = await client.query(
        `
        SELECT
          MAX(date) AS target_date
        FROM daily_stock_results
        WHERE result = 'UNKNOWN'
          AND date < $1
        `,
        [todayJst]
      );

      targetDate =
        dateResult.rows[0]?.target_date
          ? String(
              dateResult.rows[0].target_date
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
        batchSize,
        targetCount: 0,
        preparedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        remainingCount: 0,
        winCount: 0,
        loseCount: 0,
        holdCount: 0,
        experienceUpdatedCount: 0,
        message:
          "判定可能な過去のUNKNOWNデータはありません。",
      });
    }

    /*
     * 1回につき指定件数だけ取得。
     * すでに更新された行はUNKNOWNではないため、
     * 次回以降は自動的に対象外になる。
     */
    const targetResult = await client.query(
      `
      SELECT
        id,
        date,
        code,
        name,
        score,
        price
      FROM daily_stock_results
      WHERE date = $1
        AND result = 'UNKNOWN'
      ORDER BY
        score DESC,
        created_at ASC
      LIMIT $2
      `,
      [targetDate, batchSize]
    );

    const targets: TargetRow[] =
      targetResult.rows.map((row: any) => ({
        id: String(row.id ?? ""),
        date: String(row.date ?? "").slice(
          0,
          10
        ),
        code: String(row.code ?? "").trim(),
        name: String(row.name ?? ""),
        score: toNumber(row.score),
        price: toNumber(row.price),
      }));

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        completed: true,
        checkedAt: new Date().toISOString(),
        todayJst,
        date: targetDate,
        batchSize,
        targetCount: 0,
        preparedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        remainingCount: 0,
        winCount: 0,
        loseCount: 0,
        holdCount: 0,
        experienceUpdatedCount: 0,
        message:
          "指定日の判定待ちデータはありません。",
      });
    }

    const priceMap =
      await fetchCurrentPrices(url.origin);

    const updates: UpdateItem[] = [];

    const skipped: Array<{
      code: string;
      name: string;
      reason: string;
    }> = [];

    for (const target of targets) {
      const entryPrice = toNumber(
        target.price
      );

      const nextPrice =
        priceMap.get(target.code) ?? 0;

      if (
        !Number.isFinite(entryPrice) ||
        entryPrice <= 0
      ) {
        skipped.push({
          code: target.code,
          name: target.name,
          reason: "予測時価格が不正",
        });

        continue;
      }

      if (
        !Number.isFinite(nextPrice) ||
        nextPrice <= 0
      ) {
        skipped.push({
          code: target.code,
          name: target.name,
          reason:
            "現在価格を取得できませんでした",
        });

        continue;
      }

      const changePercent =
        calculateChangePercent(
          entryPrice,
          nextPrice
        );

      updates.push({
        id: target.id,
        code: target.code,
        nextPrice,
        changePercent,
        result: judgeResult(changePercent),
      });
    }

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

    /*
     * daily_stock_results.dateはtext型なので、
     * ここも::dateを付けず文字列として比較する。
     */
    const remainingResult =
      await client.query(
        `
        SELECT
          COUNT(*)::int AS count
        FROM daily_stock_results
        WHERE date = $1
          AND result = 'UNKNOWN'
        `,
        [targetDate]
      );

    const remainingCount = toNumber(
      remainingResult.rows[0]?.count
    );

    return NextResponse.json({
      success: true,
      completed: remainingCount === 0,
      checkedAt: new Date().toISOString(),
      todayJst,
      date: targetDate,
      automaticallySelected:
        requestedDate === null,
      batchSize,
      targetCount: targets.length,
      preparedCount: updates.length,
      updatedCount,
      skippedCount: skipped.length,
      remainingCount,
      winCount,
      loseCount,
      holdCount,
      experienceUpdatedCount,
      skipped: skipped.slice(0, 20),
      message:
        remainingCount > 0
          ? `今回は${updatedCount}件を処理しました。残り${remainingCount}件です。`
          : "この日付の答え合わせが完了しました。",
      nextRequest:
        remainingCount > 0
          ? `/api/learning/check-daily?date=${targetDate}&batchSize=${batchSize}`
          : null,
      rule: {
        win: "予測時価格から2%以上上昇",
        lose: "予測時価格から2%以上下落",
        hold: "騰落率が±2%未満",
      },
    });
  } catch (error) {
    const isAbortError =
      error instanceof Error &&
      error.name === "AbortError";

    return NextResponse.json(
      {
        success: false,
        checkedAt: new Date().toISOString(),
        error: isAbortError
          ? "scan api timeout"
          : "check daily failed",
        message: isAbortError
          ? "銘柄スキャンの取得が時間切れになりました。少し待って再実行してください。"
          : error instanceof Error
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