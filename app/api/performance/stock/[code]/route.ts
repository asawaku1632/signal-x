import { NextResponse } from "next/server";

import {
  getDailyStockResults,
  type DailyStockResult,
} from "@/app/lib/dailyLearning";

type PerformanceResult = "WIN" | "LOSE" | "HOLD" | "PENDING";

type RecentPerformanceItem = {
  date: string;
  code: string;
  name: string;
  aiPower: number;
  judge: string;
  result: PerformanceResult;
  entryPrice: number;
  exitPrice: number | null;
  changePercent: number | null;
  profitYen: number | null;
  outcomeLabel: string;
};

function getJudge(score: number) {
  if (score >= 95) return "大本命";
  if (score >= 85) return "買い候補";
  if (score >= 75) return "押し目待ち";
  if (score >= 65) return "様子見";
  return "見送り";
}

function getOutcomeLabel(result: DailyStockResult["result"]) {
  if (result === "WIN") return "+2%以上";
  if (result === "LOSE") return "-2%以下";
  if (result === "HOLD") return "±2%未満";
  return "判定待ち";
}

function toPerformanceItem(
  item: DailyStockResult,
): RecentPerformanceItem {
  if (
    item.result === "UNKNOWN" ||
    item.nextPrice === null ||
    item.changePercent === null
  ) {
    return {
      date: item.date,
      code: item.code,
      name: item.name,
      aiPower: item.score,
      judge: getJudge(item.score),
      result: "PENDING",
      entryPrice: item.price,
      exitPrice: null,
      changePercent: null,
      profitYen: null,
      outcomeLabel: "判定待ち",
    };
  }

  return {
    date: item.date,
    code: item.code,
    name: item.name,
    aiPower: item.score,
    judge: getJudge(item.score),
    result: item.result,
    entryPrice: item.price,
    exitPrice: item.nextPrice,
    changePercent: item.changePercent,
    profitYen: Math.round((item.nextPrice - item.price) * 100),
    outcomeLabel: getOutcomeLabel(item.result),
  };
}

function calculateStreaks(
  chronologicalItems: RecentPerformanceItem[],
  newestFirstItems: RecentPerformanceItem[],
) {
  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let maxLoseStreak = 0;
  let runningWins = 0;
  let runningLoses = 0;

  for (const item of chronologicalItems) {
    if (item.result === "WIN") {
      runningWins += 1;
      runningLoses = 0;
      maxWinStreak = Math.max(maxWinStreak, runningWins);
    } else if (item.result === "LOSE") {
      runningLoses += 1;
      runningWins = 0;
      maxLoseStreak = Math.max(maxLoseStreak, runningLoses);
    } else {
      // HOLD は連勝・連敗を継続させない
      runningWins = 0;
      runningLoses = 0;
    }
  }

  for (const item of newestFirstItems) {
    if (item.result === "WIN") {
      currentWinStreak += 1;
      continue;
    }

    break;
  }

  return {
    currentWinStreak,
    maxWinStreak,
    maxLoseStreak,
  };
}

function getReliabilityScore({
  winRate,
  resolvedCount,
  averageProfitRate,
  averageLossRate,
}: {
  winRate: number;
  resolvedCount: number;
  averageProfitRate: number;
  averageLossRate: number;
}) {
  // データ量は WIN・LOSE・HOLD を含む「判定完了件数」で評価する
  const sampleScore = Math.min(resolvedCount / 30, 1) * 20;
  const winRateScore = winRate * 0.65;

  const profitLossBalance =
    averageLossRate > 0
      ? Math.min(averageProfitRate / averageLossRate, 2) * 7.5
      : averageProfitRate > 0
        ? 15
        : 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(winRateScore + sampleScore + profitLossBalance),
    ),
  );
}

function getReliabilityRank(score: number, resolvedCount: number) {
  if (resolvedCount < 5) return "DATA_BUILDING";
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getMonthLabel(monthKey: string) {
  const [, month] = monthKey.split("-");
  return `${Number(month)}月`;
}

function buildMonthlySummary(
  items: RecentPerformanceItem[],
  monthKey: string,
) {
  const monthItems = items.filter(
    (item) => getMonthKey(item.date) === monthKey,
  );

  // 判定完了 = WIN・LOSE・HOLD
  const resolvedItems = monthItems.filter(
    (item) => item.result !== "PENDING",
  );

  // 勝率の対象 = WIN・LOSE のみ
  const decisiveItems = resolvedItems.filter(
    (item) => item.result === "WIN" || item.result === "LOSE",
  );

  const wins = decisiveItems.filter(
    (item) => item.result === "WIN",
  ).length;

  const losses = decisiveItems.filter(
    (item) => item.result === "LOSE",
  ).length;

  const holds = resolvedItems.filter(
    (item) => item.result === "HOLD",
  ).length;

  const winRate =
    decisiveItems.length > 0
      ? Math.round((wins / decisiveItems.length) * 1000) / 10
      : 0;

  const totalProfitYen = resolvedItems.reduce(
    (sum, item) => sum + (item.profitYen ?? 0),
    0,
  );

  return {
    month: monthKey,
    label: getMonthLabel(monthKey),

    // 互換性維持: total も判定完了件数
    total: resolvedItems.length,

    // 画面の「判定済み」に使用
    judgedTotal: resolvedItems.length,

    // 勝率グラフが HOLD のみの月を 0% と誤表示しないために分離
    decisiveTotal: decisiveItems.length,

    wins,
    losses,
    holds,
    pending: monthItems.length - resolvedItems.length,
    winRate,
    totalProfitYen,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;

    const allResults = await getDailyStockResults();

    const stockResults = allResults
      .filter((item) => item.code === code)
      .map(toPerformanceItem)
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

    const latestStock = stockResults[0];
    const recent3Days = stockResults.slice(0, 3);

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const last30Days = stockResults.filter((item) => {
      const itemDate = new Date(`${item.date}T00:00:00`);
      return itemDate >= thirtyDaysAgo && itemDate <= now;
    });

    // 判定完了 = WIN・LOSE・HOLD
    const resolved30Days = last30Days.filter(
      (item) => item.result !== "PENDING",
    );

    const pending30Days = last30Days.filter(
      (item) => item.result === "PENDING",
    );

    // 勝率計算対象 = WIN・LOSE のみ
    const decisive30Days = resolved30Days.filter(
      (item) => item.result === "WIN" || item.result === "LOSE",
    );

    const wins = decisive30Days.filter(
      (item) => item.result === "WIN",
    );

    const losses = decisive30Days.filter(
      (item) => item.result === "LOSE",
    );

    const holds = resolved30Days.filter(
      (item) => item.result === "HOLD",
    );

    const winRate =
      decisive30Days.length > 0
        ? Math.round((wins.length / decisive30Days.length) * 1000) / 10
        : 0;

    const totalProfitYen = resolved30Days.reduce(
      (sum, item) => sum + (item.profitYen ?? 0),
      0,
    );

    const averageProfitRate =
      wins.length > 0
        ? Math.round(
            (wins.reduce(
              (sum, item) => sum + (item.changePercent ?? 0),
              0,
            ) /
              wins.length) *
              100,
          ) / 100
        : 0;

    const averageLossRate =
      losses.length > 0
        ? Math.round(
            Math.abs(
              losses.reduce(
                (sum, item) => sum + (item.changePercent ?? 0),
                0,
              ) / losses.length,
            ) * 100,
          ) / 100
        : 0;

    const newestResolved30Days = [...resolved30Days].sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const chronological30Days = [...resolved30Days].sort(
      (a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const streaks = calculateStreaks(
      chronological30Days,
      newestResolved30Days,
    );

    const reliabilityScore = getReliabilityScore({
      winRate,
      resolvedCount: resolved30Days.length,
      averageProfitRate,
      averageLossRate,
    });

    const currentMonthKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}`;

    const currentMonth = buildMonthlySummary(
      stockResults,
      currentMonthKey,
    );

    const monthlyTrend = Array.from({ length: 3 }, (_, index) => {
      const target = new Date(
        now.getFullYear(),
        now.getMonth() - (2 - index),
        1,
      );

      const monthKey = `${target.getFullYear()}-${String(
        target.getMonth() + 1,
      ).padStart(2, "0")}`;

      return buildMonthlySummary(stockResults, monthKey);
    });

    return NextResponse.json({
      success: true,
      stock: {
        code,
        name: latestStock?.name ?? "",
      },
      recent3Days,
      summary30Days: {
        // 判定完了件数: WIN + LOSE + HOLD
        total: resolved30Days.length,
        allTotal: last30Days.length,
        pending: pending30Days.length,
        judgedTotal: resolved30Days.length,

        // 勝率対象件数: WIN + LOSE
        decisiveTotal: decisive30Days.length,

        wins: wins.length,
        losses: losses.length,
        holds: holds.length,
        winRate,
        averageProfitRate,
        averageLossRate,
        totalProfitYen,
      },
      currentMonth,
      monthlyTrend,
      reliability: {
        score: reliabilityScore,
        rank: getReliabilityRank(
          reliabilityScore,
          resolved30Days.length,
        ),
        currentWinStreak: streaks.currentWinStreak,
        maxWinStreak: streaks.maxWinStreak,
        maxLoseStreak: streaks.maxLoseStreak,
      },
      rules: {
        win: "+2%以上",
        lose: "-2%以下",
        hold: "±2%未満",
        profitYen: "（翌日価格 - 保存時価格）× 100株",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "performance api failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}