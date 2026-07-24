import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PerformanceResult =
  | "WIN"
  | "LOSE"
  | "HOLD"
  | "UNKNOWN";

type PerformanceRow = {
  id: string;
  date: string;
  code: string;
  name: string;
  score: number;
  price: number;
  nextPrice: number | null;
  changePercent: number | null;
  result: PerformanceResult;
  checkedAt: string | null;
};

type PowerGroup = {
  key: string;
  label: string;
  minScore: number;
  maxScore: number;
};

const JST_TIME_ZONE = "Asia/Tokyo";

const POWER_GROUPS: PowerGroup[] = [
  {
    key: "power_90_100",
    label: "AI POWER 90〜100",
    minScore: 90,
    maxScore: 100,
  },
  {
    key: "power_80_89",
    label: "AI POWER 80〜89",
    minScore: 80,
    maxScore: 89,
  },
  {
    key: "power_70_79",
    label: "AI POWER 70〜79",
    minScore: 70,
    maxScore: 79,
  },
  {
    key: "power_60_69",
    label: "AI POWER 60〜69",
    minScore: 60,
    maxScore: 69,
  },
  {
    key: "power_0_59",
    label: "AI POWER 0〜59",
    minScore: 0,
    maxScore: 59,
  },
];

function toNumber(
  value: unknown,
  fallback = 0
): number {
  const num = Number(value ?? fallback);

  return Number.isFinite(num)
    ? num
    : fallback;
}

function round(
  value: number,
  digits = 1
): number {
  const multiplier = 10 ** digits;

  return (
    Math.round(value * multiplier) /
    multiplier
  );
}

function toDateOnly(value: unknown): string {
  if (!value) return "";

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function toIsoString(
  value: unknown
): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(String(value));

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return String(value);
}

function getJstDateString(
  value: string | Date
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isValidResult(
  value: unknown
): value is PerformanceResult {
  return [
    "WIN",
    "LOSE",
    "HOLD",
    "UNKNOWN",
  ].includes(String(value));
}

function mapRow(row: any): PerformanceRow {
  const rawResult = row.result;

  return {
    id: String(row.id ?? ""),
    date: toDateOnly(row.date),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    score: toNumber(row.score),
    price: toNumber(row.price),
    nextPrice:
      row.next_price === null ||
      row.next_price === undefined
        ? null
        : toNumber(row.next_price),
    changePercent:
      row.change_percent === null ||
      row.change_percent === undefined
        ? null
        : toNumber(row.change_percent),
    result: isValidResult(rawResult)
      ? rawResult
      : "UNKNOWN",
    checkedAt: toIsoString(row.checked_at),
  };
}

/*
 * 過去に保存日と同日に答え合わせされ、
 * 予測価格と判定価格が完全に同額になったデータを判定する。
 *
 * changePercentが本当に0%だった正常データまで除外しないよう、
 * 以下の条件がすべて揃ったものだけを対象にする。
 */
function isInvalidSameDayJudgement(
  row: PerformanceRow
): boolean {
  if (
    row.result === "UNKNOWN" ||
    row.nextPrice === null ||
    row.changePercent === null ||
    !row.checkedAt
  ) {
    return false;
  }

  const checkedDateJst =
    getJstDateString(row.checkedAt);

  const sameDate =
    checkedDateJst === row.date;

  const samePrice =
    Math.abs(row.price - row.nextPrice) <
    0.000001;

  const zeroChange =
    Math.abs(row.changePercent) <
    0.000001;

  return (
    sameDate &&
    samePrice &&
    zeroChange
  );
}

function createSummary(
  rows: PerformanceRow[]
) {
  const judgedRows = rows.filter(
    (row) => row.result !== "UNKNOWN"
  );

  const winCount = judgedRows.filter(
    (row) => row.result === "WIN"
  ).length;

  const loseCount = judgedRows.filter(
    (row) => row.result === "LOSE"
  ).length;

  const holdCount = judgedRows.filter(
    (row) => row.result === "HOLD"
  ).length;

  const unknownCount = rows.filter(
    (row) => row.result === "UNKNOWN"
  ).length;

  const changedRows = judgedRows.filter(
    (row) =>
      row.changePercent !== null &&
      Number.isFinite(row.changePercent)
  );

  const positiveCount = changedRows.filter(
    (row) =>
      (row.changePercent ?? 0) > 0
  ).length;

  const negativeCount = changedRows.filter(
    (row) =>
      (row.changePercent ?? 0) < 0
  ).length;

  const flatCount = changedRows.filter(
    (row) =>
      Math.abs(row.changePercent ?? 0) <
      0.000001
  ).length;

  const averageChangePercent =
    changedRows.length > 0
      ? changedRows.reduce(
          (sum, row) =>
            sum +
            (row.changePercent ?? 0),
          0
        ) / changedRows.length
      : 0;

  /*
   * 現在のWINは「2%以上上昇した件数」。
   * HOLDを含む全判定済み件数を分母にしている。
   */
  const winRate =
    judgedRows.length > 0
      ? round(
          (winCount / judgedRows.length) *
            100,
          1
        )
      : 0;

  /*
   * 値上がり件数の割合。
   * WINだけでなく、0〜2%未満の上昇も含む。
   */
  const positiveRate =
    changedRows.length > 0
      ? round(
          (positiveCount /
            changedRows.length) *
            100,
          1
        )
      : 0;

  /*
   * WINとLOSEだけを分母にした参考値。
   * HOLDを除いた方向性判定の比率。
   */
  const directionalCount =
    winCount + loseCount;

  const directionalWinRate =
    directionalCount > 0
      ? round(
          (winCount /
            directionalCount) *
            100,
          1
        )
      : 0;

  return {
    totalCount: rows.length,
    judgedCount: judgedRows.length,
    unknownCount,
    winCount,
    loseCount,
    holdCount,
    winRate,
    directionalCount,
    directionalWinRate,
    positiveCount,
    negativeCount,
    flatCount,
    positiveRate,
    averageChangePercent: round(
      averageChangePercent,
      2
    ),
  };
}

function createPowerStats(
  rows: PerformanceRow[]
) {
  return POWER_GROUPS.map((group) => {
    const groupRows = rows.filter(
      (row) =>
        row.score >= group.minScore &&
        row.score <= group.maxScore
    );

    return {
      key: group.key,
      label: group.label,
      minScore: group.minScore,
      maxScore: group.maxScore,
      ...createSummary(groupRows),
    };
  });
}

export async function GET(
  request: Request
) {
  try {
    const url = new URL(request.url);

    const requestedLimit = toNumber(
      url.searchParams.get("limit"),
      100
    );

    const limit = Math.max(
      1,
      Math.min(
        500,
        Math.floor(requestedLimit)
      )
    );

    const date =
      url.searchParams.get("date");

    const requestedResult =
      url.searchParams.get("result");

    const result =
      requestedResult &&
      isValidResult(requestedResult)
        ? requestedResult
        : null;

    const minScoreParam =
      url.searchParams.get("minScore");

    const maxScoreParam =
      url.searchParams.get("maxScore");

    const minScore =
      minScoreParam !== null &&
      Number.isFinite(Number(minScoreParam))
        ? Number(minScoreParam)
        : null;

    const maxScore =
      maxScoreParam !== null &&
      Number.isFinite(Number(maxScoreParam))
        ? Number(maxScoreParam)
        : null;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (date) {
      values.push(date);
      conditions.push(
        `date = $${values.length}`
      );
    }

    if (result) {
      values.push(result);
      conditions.push(
        `result = $${values.length}`
      );
    }

    if (minScore !== null) {
      values.push(minScore);
      conditions.push(
        `score >= $${values.length}`
      );
    }

    if (maxScore !== null) {
      values.push(maxScore);
      conditions.push(
        `score <= $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(
            " AND "
          )}`
        : "";

    const allRowsResult =
      await pool.query(
        `
        SELECT
          id,
          date,
          code,
          name,
          score,
          price,
          next_price,
          change_percent,
          result,
          checked_at,
          created_at
        FROM daily_stock_results
        ${whereClause}
        ORDER BY
          date DESC,
          score DESC,
          created_at DESC
        `,
        values
      );

    const rawRows =
      allRowsResult.rows.map(mapRow);

    const invalidRows = rawRows.filter(
      isInvalidSameDayJudgement
    );

    const validRows = rawRows.filter(
      (row) =>
        !isInvalidSameDayJudgement(row)
    );

    const latestRows =
      validRows.slice(0, limit);

    /*
     * フィルターに関係なく、
     * DB全体の最新保存日を取得する。
     */
    const latestDateResult =
      await pool.query(`
        SELECT MAX(date) AS latest_date
        FROM daily_stock_results
      `);

    const latestDateValue =
      latestDateResult.rows[0]
        ?.latest_date;

    const latestDate =
      latestDateValue
        ? toDateOnly(latestDateValue)
        : null;

    const latestDateRows =
      latestDate
        ? validRows.filter(
            (row) =>
              row.date === latestDate
          )
        : [];

    const validJudgedRows =
      validRows.filter(
        (row) =>
          row.result !== "UNKNOWN"
      );

    const dateList = Array.from(
      new Set(
        validRows.map((row) => row.date)
      )
    )
      .filter(Boolean)
      .sort((a, b) =>
        b.localeCompare(a)
      );

    return NextResponse.json({
      success: true,
      checkedAt:
        new Date().toISOString(),
      latestDate,
      filters: {
        date: date ?? null,
        result,
        minScore,
        maxScore,
        limit,
      },
      dataQuality: {
        rawCount: rawRows.length,
        validCount: validRows.length,
        validJudgedCount:
          validJudgedRows.length,
        excludedInvalidCount:
          invalidRows.length,
        exclusionRule:
          "保存日と判定日が同日で、予測価格と判定価格が同額かつ騰落率0%のデータを除外",
        excludedSamples:
          invalidRows
            .slice(0, 10)
            .map((row) => ({
              id: row.id,
              date: row.date,
              code: row.code,
              name: row.name,
              score: row.score,
              price: row.price,
              nextPrice: row.nextPrice,
              changePercent:
                row.changePercent,
              checkedAt: row.checkedAt,
            })),
      },
      summary:
        createSummary(validRows),
      latestDateSummary:
        createSummary(latestDateRows),
      powerStats:
        createPowerStats(validRows),
      availableDates:
        dateList.slice(0, 60),
      rows: latestRows,
      definitions: {
        win:
          "予測時価格から判定時価格が2%以上上昇",
        lose:
          "予測時価格から判定時価格が2%以上下落",
        hold:
          "予測時価格から判定時価格の騰落率が±2%未満",
        winRate:
          "判定済み全件のうちWINになった割合。現在はAI推奨の的中率ではありません。",
        directionalWinRate:
          "WINとLOSEだけを対象にした場合のWIN割合",
        positiveRate:
          "判定価格が予測時価格より高かった銘柄の割合",
      },
      note:
        "現在のWIN・LOSE・HOLDは価格変動の分類です。AIの買い・見送り判断を含む正式な的中率ではありません。",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "performance api failed";

    return NextResponse.json(
      {
        success: false,
        checkedAt:
          new Date().toISOString(),
        error: message,
      },
      { status: 500 }
    );
  }
}