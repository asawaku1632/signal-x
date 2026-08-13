import { timingSafeEqual } from "node:crypto";

import pool from "@/app/lib/postgres";

export type DailyCheckStopReason =
  | "completed"
  | "max_batches"
  | "time_budget"
  | "no_progress"
  | "incomplete_price_coverage"
  | "already_running";

type DailyResult = "WIN" | "LOSE" | "HOLD";

type UpdateItem = {
  id: string;
  code: string;
  nextPrice: number;
  changePercent: number;
  result: DailyResult;
};

export type DailyCheckBatchReport = {
  batch: number;
  targetDate: string;
  priceDate: string;
  fetchedCount: number;
  updatedCount: number;
  missingPriceCount: number;
  remainingCount: number;
  comparableRemainingCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  experienceUpdatedCount: number;
  durationMs: number;
};

export type DailyCheckRunReport = {
  success: boolean;
  running: boolean;
  checkedAt: string;
  batchSize: number;
  maxBatches: number;
  processedBatches: number;
  fetchedCount: number;
  updatedCount: number;
  missingPriceCount: number;
  durationMs: number;
  stopReason: DailyCheckStopReason;
  batches: DailyCheckBatchReport[];
};

const CHECK_DAILY_LOCK_KEY = 73124001;
export const MAX_DAILY_CHECK_BATCH_SIZE = 200;
export const MAX_DAILY_CHECK_BATCHES = 5;
export const DEFAULT_DAILY_CHECK_TIME_BUDGET_MS = 45_000;
const DAILY_CHECK_TIME_SAFETY_MARGIN_MS = 1_000;

function toNumber(value: unknown, fallback = 0): number {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

function getJstDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function calculateChangePercent(entryPrice: number, nextPrice: number) {
  return Math.round(((nextPrice - entryPrice) / entryPrice) * 10_000) / 100;
}

function judgeResult(changePercent: number): DailyResult {
  if (changePercent >= 2) return "WIN";
  if (changePercent <= -2) return "LOSE";
  return "HOLD";
}

export function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;

  const suppliedSecret = authorization.slice("Bearer ".length);
  const expected = Buffer.from(cronSecret);
  const supplied = Buffer.from(suppliedSecret);

  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

async function findComparableDate(
  client: import("pg").PoolClient,
  todayJst: string,
  requestedDate?: string,
  priority: "newest" | "oldest" = "newest",
): Promise<{ targetDate: string; priceDate: string } | null> {
  const { rows } = await client.query(
    `
    WITH date_stats AS (
      SELECT
        date,
        BOOL_OR(result = 'UNKNOWN') AS has_unknown,
        BOOL_OR(price IS NOT NULL AND price > 0) AS has_price
      FROM daily_stock_results
      WHERE date IS NOT NULL
      GROUP BY date
    ),
    date_pairs AS (
      SELECT
        target.date AS target_date,
        MIN(future.date) AS price_date
      FROM date_stats AS target
      INNER JOIN date_stats AS future
        ON future.date > target.date
        AND future.has_price
      WHERE target.has_unknown
        AND target.date < $1
        AND ($2::text IS NULL OR target.date = $2)
      GROUP BY target.date
    )
    SELECT
      pair.target_date,
      pair.price_date
    FROM date_pairs AS pair
    INNER JOIN daily_stock_results AS target
      ON target.date = pair.target_date
      AND target.result = 'UNKNOWN'
      AND target.price IS NOT NULL
      AND target.price > 0
    INNER JOIN daily_stock_results AS future
      ON future.date = pair.price_date
      AND future.code = target.code
      AND future.price IS NOT NULL
      AND future.price > 0
    GROUP BY pair.target_date, pair.price_date
    ORDER BY pair.target_date ${priority === "newest" ? "DESC" : "ASC"}
    LIMIT 1
    `,
    [todayJst, requestedDate ?? null],
  );

  if (!rows[0]) return null;

  return {
    targetDate: String(rows[0].target_date).slice(0, 10),
    priceDate: String(rows[0].price_date).slice(0, 10),
  };
}

async function bulkUpdateDailyResults(
  client: import("pg").PoolClient,
  updates: UpdateItem[],
): Promise<number> {
  if (updates.length === 0) return 0;

  const values: unknown[] = [];
  const placeholders = updates.map((item, index) => {
    const base = index * 4;
    values.push(item.id, item.nextPrice, item.changePercent, item.result);

    return `(
      $${base + 1}::text,
      $${base + 2}::double precision,
      $${base + 3}::double precision,
      $${base + 4}::text
    )`;
  });

  const result = await client.query(
    `
    WITH update_values (id, next_price, change_percent, result) AS (
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
    values,
  );

  return result.rowCount ?? 0;
}

async function bulkUpdateExperienceLogs(
  client: import("pg").PoolClient,
  targetDate: string,
  updates: UpdateItem[],
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
    WITH update_values (code, result) AS (
      VALUES ${placeholders.join(",")}
    )
    UPDATE experience_learning_logs AS experience
    SET result = update_values.result
    FROM update_values
    WHERE experience.trade_date = $1::date
      AND experience.code = update_values.code
      AND experience.result = 'UNKNOWN'
    `,
    values,
  );

  return result.rowCount ?? 0;
}

async function runBatch(
  batch: number,
  batchSize: number,
  todayJst: string,
  requestedDate?: string,
  priority: "newest" | "oldest" = "newest",
): Promise<DailyCheckBatchReport | null> {
  const batchStartedAt = Date.now();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const target = await findComparableDate(
      client,
      todayJst,
      requestedDate,
      priority,
    );
    if (!target) {
      await client.query("ROLLBACK");
      return null;
    }

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
        ORDER BY code, created_at DESC, id ASC
      )
      SELECT
        target.id,
        target.code,
        target.price AS entry_price,
        next_prices.price AS next_price
      FROM daily_stock_results AS target
      INNER JOIN next_prices
        ON next_prices.code = target.code
      WHERE target.date = $2
        AND target.result = 'UNKNOWN'
        AND target.price IS NOT NULL
        AND target.price > 0
      ORDER BY target.score DESC, target.created_at ASC, target.id ASC
      LIMIT $3
      FOR UPDATE OF target SKIP LOCKED
      `,
      [target.priceDate, target.targetDate, batchSize],
    );

    const updates: UpdateItem[] = targetResult.rows.map((row) => {
      const entryPrice = toNumber(row.entry_price);
      const nextPrice = toNumber(row.next_price);
      const changePercent = calculateChangePercent(entryPrice, nextPrice);

      return {
        id: String(row.id),
        code: String(row.code).trim(),
        nextPrice,
        changePercent,
        result: judgeResult(changePercent),
      };
    });

    const updatedCount = await bulkUpdateDailyResults(client, updates);
    const experienceUpdatedCount = await bulkUpdateExperienceLogs(
      client,
      target.targetDate,
      updates,
    );

    await client.query("COMMIT");

    const countsResult = await pool.query(
      `
      WITH next_codes AS (
        SELECT DISTINCT code
        FROM daily_stock_results
        WHERE date = $2
          AND price IS NOT NULL
          AND price > 0
      )
      SELECT
        COUNT(*)::int AS remaining_count,
        COUNT(*) FILTER (
          WHERE target.price IS NOT NULL
            AND target.price > 0
            AND target.code IN (SELECT code FROM next_codes)
        )::int AS comparable_remaining_count
      FROM daily_stock_results AS target
      WHERE target.date = $1
        AND target.result = 'UNKNOWN'
      `,
      [target.targetDate, target.priceDate],
    );

    const remainingCount = toNumber(countsResult.rows[0]?.remaining_count);
    const comparableRemainingCount = toNumber(
      countsResult.rows[0]?.comparable_remaining_count,
    );

    return {
      batch,
      targetDate: target.targetDate,
      priceDate: target.priceDate,
      fetchedCount: updates.length,
      updatedCount,
      missingPriceCount: Math.max(
        0,
        remainingCount - comparableRemainingCount,
      ),
      remainingCount,
      comparableRemainingCount,
      winCount: updates.filter((item) => item.result === "WIN").length,
      loseCount: updates.filter((item) => item.result === "LOSE").length,
      holdCount: updates.filter((item) => item.result === "HOLD").length,
      experienceUpdatedCount,
      durationMs: Date.now() - batchStartedAt,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function runDailyCheck(options?: {
  batchSize?: number;
  maxBatches?: number;
  timeBudgetMs?: number;
  targetDate?: string;
}): Promise<DailyCheckRunReport> {
  const startedAt = Date.now();
  const batchSize = Math.max(
    1,
    Math.min(
      MAX_DAILY_CHECK_BATCH_SIZE,
      Math.floor(options?.batchSize ?? MAX_DAILY_CHECK_BATCH_SIZE),
    ),
  );
  const maxBatches = Math.max(
    1,
    Math.min(
      MAX_DAILY_CHECK_BATCHES,
      Math.floor(options?.maxBatches ?? 1),
    ),
  );
  const timeBudgetMs = Math.max(
    1_000,
    Math.min(
      DEFAULT_DAILY_CHECK_TIME_BUDGET_MS,
      Math.floor(
        options?.timeBudgetMs ?? DEFAULT_DAILY_CHECK_TIME_BUDGET_MS,
      ),
    ),
  );
  const todayJst = getJstDateString();
  const batches: DailyCheckBatchReport[] = [];
  const lockClient = await pool.connect();
  let lockTransactionStarted = false;

  try {
    await lockClient.query("BEGIN");
    lockTransactionStarted = true;

    const lockResult = await lockClient.query(
      "SELECT pg_try_advisory_xact_lock($1) AS acquired",
      [CHECK_DAILY_LOCK_KEY],
    );

    if (lockResult.rows[0]?.acquired !== true) {
      return {
        success: true,
        running: true,
        checkedAt: new Date().toISOString(),
        batchSize,
        maxBatches,
        processedBatches: 0,
        fetchedCount: 0,
        updatedCount: 0,
        missingPriceCount: 0,
        durationMs: Date.now() - startedAt,
        stopReason: "already_running",
        batches,
      };
    }

    let stopReason: DailyCheckStopReason = "max_batches";

    for (let batch = 1; batch <= maxBatches; batch += 1) {
      const elapsedMs = Date.now() - startedAt;
      const previousBatchDurationMs = batches.at(-1)?.durationMs;
      const estimatedNextBatchMs =
        previousBatchDurationMs === undefined
          ? 0
          : previousBatchDurationMs + DAILY_CHECK_TIME_SAFETY_MARGIN_MS;

      if (elapsedMs + estimatedNextBatchMs >= timeBudgetMs) {
        stopReason = "time_budget";
        break;
      }

      const report = await runBatch(
        batch,
        batchSize,
        todayJst,
        options?.targetDate,
        // Process the newest date first, then reserve one early batch for the
        // oldest backlog. The remaining batches return to newest-first work.
        // Explicit date runs still process only the requested date.
        !options?.targetDate && maxBatches > 1 && batch === 2
          ? "oldest"
          : "newest",
      );
      if (!report) {
        stopReason = "completed";
        break;
      }

      batches.push(report);
      console.info("[check-daily] batch completed", report);

      if (
        report.remainingCount > 0 &&
        report.comparableRemainingCount === 0
      ) {
        stopReason = "incomplete_price_coverage";
        break;
      }

      if (report.updatedCount === 0) {
        stopReason = "no_progress";
        break;
      }
    }

    if (
      stopReason === "max_batches" &&
      !(await findComparableDate(
        lockClient,
        todayJst,
        options?.targetDate,
      ))
    ) {
      stopReason = "completed";
    }

    const result: DailyCheckRunReport = {
      success: true,
      running: false,
      checkedAt: new Date().toISOString(),
      batchSize,
      maxBatches,
      processedBatches: batches.length,
      fetchedCount: batches.reduce(
        (total, batch) => total + batch.fetchedCount,
        0,
      ),
      updatedCount: batches.reduce(
        (total, batch) => total + batch.updatedCount,
        0,
      ),
      missingPriceCount: batches.at(-1)?.missingPriceCount ?? 0,
      durationMs: Date.now() - startedAt,
      stopReason,
      batches,
    };

    console.info("[check-daily] run completed", result);
    return result;
  } finally {
    if (lockTransactionStarted) {
      try {
        await lockClient.query("ROLLBACK");
      } catch (error) {
        console.error("[check-daily] lock release failed", error);
      }
    }
    lockClient.release();
  }
}
