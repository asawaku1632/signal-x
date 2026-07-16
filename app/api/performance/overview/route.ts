import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";

const RESULT_TABLE = "daily_stock_results";

type ColumnSet = Set<string>;

function pickColumn(columns: ColumnSet, candidates: string[]) {
  return candidates.find((column) => columns.has(column)) ?? null;
}

function quoted(column: string) {
  return `"${column.replace(/"/g, '""')}"`;
}

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export async function GET() {
  try {
    const schemaResult = await pool.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
      `,
      [RESULT_TABLE],
    );

    const columns: ColumnSet = new Set(
      schemaResult.rows.map((row) => String(row.column_name)),
    );

    const codeColumn = pickColumn(columns, ["code", "stock_code", "symbol"]);
    const nameColumn = pickColumn(columns, ["name", "stock_name", "company_name"]);
    const resultColumn = pickColumn(columns, ["result", "judgement", "status"]);
    const dateColumn = pickColumn(columns, [
      "created_at",
      "target_date",
      "result_date",
      "judged_at",
      "updated_at",
      "date",
    ]);
    const aiPowerColumn = pickColumn(columns, [
      "ai_power",
      "aiPower",
      "score",
      "power",
      "confidence",
    ]);
    const entryPriceColumn = pickColumn(columns, [
      "saved_price",
      "entry_price",
      "base_price",
      "start_price",
      "before_price",
      "price_at_prediction",
      "price",
    ]);
    const exitPriceColumn = pickColumn(columns, [
      "result_price",
      "exit_price",
      "next_day_price",
      "after_price",
      "judged_price",
      "close_price",
      "next_close_price",
    ]);

    if (!codeColumn || !resultColumn) {
      return NextResponse.json(
        {
          success: false,
          error: "daily_stock_results に必要な code/result 列が見つかりません。",
        },
        { status: 500 },
      );
    }

    const codeExpr = quoted(codeColumn);
    const resultExpr = quoted(resultColumn);
    const nameExpr = nameColumn
      ? `COALESCE(MAX(${quoted(nameColumn)}), ${codeExpr}::text)`
      : `${codeExpr}::text`;
    const dateExpr = dateColumn ? quoted(dateColumn) : null;
    const aiPowerExpr = aiPowerColumn ? quoted(aiPowerColumn) : null;
    const entryExpr = entryPriceColumn ? quoted(entryPriceColumn) : null;
    const exitExpr = exitPriceColumn ? quoted(exitPriceColumn) : null;

    const profitSummarySql =
      entryExpr && exitExpr
        ? `,
        SUM(
          CASE
            WHEN UPPER(${resultExpr}::text) IN ('WIN', 'LOSE')
             AND ${entryExpr} IS NOT NULL
             AND ${exitExpr} IS NOT NULL
            THEN (${exitExpr}::numeric - ${entryExpr}::numeric) * 100
            ELSE 0
          END
        )::numeric AS total_profit_amount,
        AVG(
          CASE
            WHEN UPPER(${resultExpr}::text) = 'WIN'
             AND ${entryExpr}::numeric > 0
             AND ${exitExpr} IS NOT NULL
            THEN ((${exitExpr}::numeric - ${entryExpr}::numeric) / ${entryExpr}::numeric) * 100
            ELSE NULL
          END
        )::numeric AS average_profit_rate,
        AVG(
          CASE
            WHEN UPPER(${resultExpr}::text) = 'LOSE'
             AND ${entryExpr}::numeric > 0
             AND ${exitExpr} IS NOT NULL
            THEN ((${exitExpr}::numeric - ${entryExpr}::numeric) / ${entryExpr}::numeric) * 100
            ELSE NULL
          END
        )::numeric AS average_loss_rate`
        : "";

    const summaryQuery = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE UPPER(${resultExpr}::text) = 'WIN')::int AS win,
        COUNT(*) FILTER (WHERE UPPER(${resultExpr}::text) = 'LOSE')::int AS lose,
        COUNT(*) FILTER (WHERE UPPER(${resultExpr}::text) = 'HOLD')::int AS hold,
        COUNT(*) FILTER (
          WHERE UPPER(${resultExpr}::text) NOT IN ('WIN', 'LOSE', 'HOLD')
             OR ${resultExpr} IS NULL
        )::int AS unknown
        ${profitSummarySql}
      FROM ${RESULT_TABLE}
    `;

    const stockQuery = `
      SELECT
        ${codeExpr}::text AS code,
        ${nameExpr} AS name,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE UPPER(${resultExpr}::text) = 'WIN')::int AS win,
        COUNT(*) FILTER (WHERE UPPER(${resultExpr}::text) = 'LOSE')::int AS lose,
        COUNT(*) FILTER (WHERE UPPER(${resultExpr}::text) = 'HOLD')::int AS hold,
        COUNT(*) FILTER (
          WHERE UPPER(${resultExpr}::text) NOT IN ('WIN', 'LOSE', 'HOLD')
             OR ${resultExpr} IS NULL
        )::int AS unknown,
        ${aiPowerExpr ? `MAX(${aiPowerExpr}::numeric)::numeric` : "0::numeric"} AS ai_power,
        ${entryExpr ? `MAX(${entryExpr}::numeric) FILTER (WHERE ${entryExpr} IS NOT NULL)` : "NULL::numeric"} AS entry_price,
        ${exitExpr ? `MAX(${exitExpr}::numeric) FILTER (WHERE ${exitExpr} IS NOT NULL)` : "NULL::numeric"} AS exit_price,
        ${dateExpr ? `MAX(${dateExpr})` : "NULL::timestamp"} AS latest_date,
        ${
          entryExpr && exitExpr
            ? `SUM(
                CASE
                  WHEN UPPER(${resultExpr}::text) IN ('WIN', 'LOSE')
                   AND ${entryExpr} IS NOT NULL
                   AND ${exitExpr} IS NOT NULL
                  THEN (${exitExpr}::numeric - ${entryExpr}::numeric) * 100
                  ELSE 0
                END
              )::numeric`
            : "0::numeric"
        } AS profit_amount
      FROM ${RESULT_TABLE}
      WHERE ${codeExpr} IS NOT NULL
      GROUP BY ${codeExpr}
    `;

    const powerBandsQuery = aiPowerExpr
      ? `
        WITH judged AS (
          SELECT
            CASE
              WHEN ${aiPowerExpr}::numeric >= 90 THEN '90〜100'
              WHEN ${aiPowerExpr}::numeric >= 80 THEN '80〜89'
              WHEN ${aiPowerExpr}::numeric >= 70 THEN '70〜79'
              WHEN ${aiPowerExpr}::numeric >= 60 THEN '60〜69'
              ELSE '0〜59'
            END AS label,
            CASE
              WHEN ${aiPowerExpr}::numeric >= 90 THEN 1
              WHEN ${aiPowerExpr}::numeric >= 80 THEN 2
              WHEN ${aiPowerExpr}::numeric >= 70 THEN 3
              WHEN ${aiPowerExpr}::numeric >= 60 THEN 4
              ELSE 5
            END AS sort_order,
            UPPER(${resultExpr}::text) AS result
          FROM ${RESULT_TABLE}
          WHERE UPPER(${resultExpr}::text) IN ('WIN', 'LOSE')
            AND ${aiPowerExpr} IS NOT NULL
        )
        SELECT
          label,
          sort_order,
          COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,
          COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose,
          COUNT(*)::int AS total
        FROM judged
        GROUP BY label, sort_order
        ORDER BY sort_order
      `
      : null;

    const monthlyQuery = dateExpr
      ? `
        SELECT
          TO_CHAR(DATE_TRUNC('month', ${dateExpr}), 'YYYY-MM') AS month_key,
          TO_CHAR(DATE_TRUNC('month', ${dateExpr}), 'FMMM"月"') AS label,
          COUNT(*) FILTER (WHERE UPPER(${resultExpr}::text) = 'WIN')::int AS win,
          COUNT(*) FILTER (WHERE UPPER(${resultExpr}::text) = 'LOSE')::int AS lose,
          COUNT(*) FILTER (
            WHERE UPPER(${resultExpr}::text) IN ('WIN', 'LOSE')
          )::int AS total
        FROM ${RESULT_TABLE}
        WHERE ${dateExpr} IS NOT NULL
        GROUP BY DATE_TRUNC('month', ${dateExpr})
        ORDER BY DATE_TRUNC('month', ${dateExpr}) DESC
        LIMIT 6
      `
      : null;

    const [summaryResult, stockResult, powerBandsResult, monthlyResult] =
      await Promise.all([
        pool.query(summaryQuery),
        pool.query(stockQuery),
        powerBandsQuery ? pool.query(powerBandsQuery) : Promise.resolve({ rows: [] }),
        monthlyQuery ? pool.query(monthlyQuery) : Promise.resolve({ rows: [] }),
      ]);

    const summary = summaryResult.rows[0] ?? {};
    const total = toNumber(summary.total);
    const win = toNumber(summary.win);
    const lose = toNumber(summary.lose);
    const hold = toNumber(summary.hold);
    const unknown = toNumber(summary.unknown);
    const judged = win + lose;
    const winRate = judged > 0 ? (win / judged) * 100 : 0;

    const stockPerformance = stockResult.rows
      .map((row) => {
        const stockWin = toNumber(row.win);
        const stockLose = toNumber(row.lose);
        const stockHold = toNumber(row.hold);
        const stockJudged = stockWin + stockLose;
        const entryPrice = toNullableNumber(row.entry_price);
        const exitPrice = toNullableNumber(row.exit_price);
        const profitAmount = toNumber(row.profit_amount);
        const profitRate =
          entryPrice && exitPrice
            ? ((exitPrice - entryPrice) / entryPrice) * 100
            : 0;

        return {
          code: String(row.code ?? ""),
          name: String(row.name ?? row.code ?? ""),
          wins: stockWin,
          losses: stockLose,
          holds: stockHold,
          unknown: toNumber(row.unknown),
          total: toNumber(row.total),
          winRate: stockJudged > 0 ? (stockWin / stockJudged) * 100 : 0,
          aiPower: toNumber(row.ai_power),
          entryPrice: entryPrice ?? 0,
          exitPrice: exitPrice ?? 0,
          profitAmount,
          profitRate,
          hasJudgement: stockJudged > 0,
          date: row.latest_date
            ? new Date(row.latest_date).toISOString()
            : undefined,
        };
      })
      .sort((a, b) => {
        const aJudged = a.wins + a.losses;
        const bJudged = b.wins + b.losses;
        const aReliability = a.winRate * Math.log2(aJudged + 1);
        const bReliability = b.winRate * Math.log2(bJudged + 1);

        if (bReliability !== aReliability) return bReliability - aReliability;
        if (bJudged !== aJudged) return bJudged - aJudged;
        return b.winRate - a.winRate;
      });

    const allBandLabels = ["90〜100", "80〜89", "70〜79", "60〜69", "0〜59"];
    const bandMap = new Map(
      powerBandsResult.rows.map((row) => [String(row.label), row]),
    );

    const powerBands = allBandLabels.map((label) => {
      const row = bandMap.get(label) ?? {};
      const wins = toNumber(row.win);
      const losses = toNumber(row.lose);
      const bandTotal = toNumber(row.total);

      return {
        label,
        wins,
        losses,
        total: bandTotal,
        winRate: bandTotal > 0 ? (wins / bandTotal) * 100 : 0,
      };
    });

    const monthly = [...monthlyResult.rows]
      .reverse()
      .map((row) => {
        const wins = toNumber(row.win);
        const losses = toNumber(row.lose);
        const monthTotal = toNumber(row.total);

        return {
          monthKey: String(row.month_key ?? ""),
          label: String(row.label ?? ""),
          wins,
          losses,
          total: monthTotal,
          winRate: monthTotal > 0 ? (wins / monthTotal) * 100 : 0,
        };
      });

    return NextResponse.json({
      success: true,
      total,
      win,
      lose,
      hold,
      pending: unknown,
      winRate,
      totalProfitAmount: toNumber(summary.total_profit_amount),
      averageProfitRate: toNumber(summary.average_profit_rate),
      averageLossRate: toNumber(summary.average_loss_rate),
      bestWinStreak: 0,
      stockPerformance,
      powerBands,
      monthly,
      schema: {
        aiPowerAvailable: Boolean(aiPowerColumn),
        profitAvailable: Boolean(entryPriceColumn && exitPriceColumn),
        aiPowerColumn,
        entryPriceColumn,
        exitPriceColumn,
        dateColumn,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("performance overview error:", error);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
        total: 0,
        win: 0,
        lose: 0,
        hold: 0,
        pending: 0,
        stockPerformance: [],
        powerBands: [],
        monthly: [],
      },
      { status: 500 },
    );
  }
}