"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type UnknownRecord = Record<string, unknown>;

type PerformanceRow = {
  code: string;
  name: string;
  wins: number;
  losses: number;
  holds: number;
  total: number;
  winRate: number;
  profitRate: number;
  profitAmount: number;
  aiPower: number;
  entryPrice: number;
  exitPrice: number;
  hasJudgement: boolean;
  date?: string;
};

type PowerBand = {
  label: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
};

type MonthlyRow = {
  label: string;
  monthKey: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
};

type DashboardData = {
  lastUpdated: string;
  rows: PerformanceRow[];
  totalJudgements: number;
  totalWins: number;
  totalLosses: number;
  totalHolds: number;
  totalProfitAmount: number;
  averageProfitRate: number;
  averageLossRate: number;
  bestWinStreak: number;
  powerBands: PowerBand[];
  monthly: MonthlyRow[];
};

const API_ENDPOINTS = [
  "/api/learning/dashboard",
  "/api/evolution/summary",
  "/api/scan?limit=1000",
];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = value.replace(/[%円,+,\s]/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function firstNumber(
  source: UnknownRecord,
  keys: string[],
  fallback = 0,
) {
  for (const key of keys) {
    const value = source[key];
    const number = asNumber(value, Number.NaN);
    if (Number.isFinite(number)) return number;
  }

  return fallback;
}

function firstString(
  source: UnknownRecord,
  keys: string[],
  fallback = "",
) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return fallback;
}

function findArrayByKeys(
  source: unknown,
  keys: string[],
  depth = 0,
): unknown[] {
  if (depth > 4) return [];

  if (Array.isArray(source)) return source;
  if (!isRecord(source)) return [];

  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }

  for (const value of Object.values(source)) {
    if (isRecord(value)) {
      const found = findArrayByKeys(value, keys, depth + 1);
      if (found.length) return found;
    }
  }

  return [];
}

function collectCandidateArrays(source: unknown, depth = 0): unknown[][] {
  if (depth > 4) return [];
  if (Array.isArray(source)) return [source];
  if (!isRecord(source)) return [];

  return Object.values(source).flatMap((value) =>
    collectCandidateArrays(value, depth + 1),
  );
}

function normalizeResult(value: unknown) {
  const result = String(value ?? "").toUpperCase();

  if (["WIN", "WON", "SUCCESS", "HIT", "利確"].includes(result)) {
    return "WIN";
  }

  if (["LOSE", "LOSS", "LOST", "FAIL", "損切"].includes(result)) {
    return "LOSE";
  }

  if (["HOLD", "PENDING", "UNKNOWN", "保留", "未判定"].includes(result)) {
    return "HOLD";
  }

  return "";
}

function normalizeRows(payloads: unknown[]): PerformanceRow[] {
  const preferredKeys = [
    "stockPerformance",
    "performanceByStock",
    "topStocks",
    "stockRanking",
    "rankings",
    "results",
    "dailyResults",
    "learningLogs",
    "stocks",
    "items",
    "data",
  ];

  const preferredArrays = payloads.flatMap((payload) => {
    const array = findArrayByKeys(payload, preferredKeys);
    return array.length ? [array] : [];
  });

  const fallbackArrays = payloads.flatMap((payload) =>
    collectCandidateArrays(payload),
  );

  const arrays = [...preferredArrays, ...fallbackArrays];
  const rows = arrays
    .flat()
    .filter(isRecord)
    .map((item): PerformanceRow | null => {
      const code = firstString(item, [
        "code",
        "stockCode",
        "ticker",
        "symbol",
      ]);

      const name = firstString(item, [
        "name",
        "stockName",
        "companyName",
        "company",
      ]);

      if (!code && !name) return null;

      const wins = firstNumber(item, ["wins", "win", "winCount"]);
      const losses = firstNumber(item, [
        "losses",
        "lose",
        "loss",
        "loseCount",
        "lossCount",
      ]);
      const holds = firstNumber(item, [
        "holds",
        "hold",
        "holdCount",
        "pending",
        "pendingCount",
      ]);

      const rawResult = normalizeResult(
        item.result ??
          item.judgement ??
          item.judge ??
          item.status ??
          item.outcome,
      );

      const rowWins = wins || (rawResult === "WIN" ? 1 : 0);
      const rowLosses = losses || (rawResult === "LOSE" ? 1 : 0);
      const rowHolds = holds || (rawResult === "HOLD" ? 1 : 0);

      const explicitTotal = firstNumber(item, [
        "total",
        "count",
        "judged",
        "judgementCount",
        "trades",
      ]);

      const total =
        explicitTotal || rowWins + rowLosses + rowHolds || (rawResult ? 1 : 0);

      const judged = rowWins + rowLosses;
      const explicitWinRate = firstNumber(item, [
        "winRate",
        "winningRate",
        "accuracy",
        "hitRate",
      ]);

      const winRate =
        explicitWinRate > 0
          ? explicitWinRate
          : judged > 0
            ? (rowWins / judged) * 100
            : 0;

      const entryPrice = firstNumber(item, [
        "entryPrice",
        "savedPrice",
        "basePrice",
        "startPrice",
        "beforePrice",
        "priceAtPrediction",
        "entry_price",
        "saved_price",
        "base_price",
        "start_price",
        "before_price",
      ]);

      const exitPrice = firstNumber(item, [
        "exitPrice",
        "resultPrice",
        "nextDayPrice",
        "afterPrice",
        "closePrice",
        "judgedPrice",
        "exit_price",
        "result_price",
        "next_day_price",
        "after_price",
        "close_price",
        "judged_price",
      ]);

      const explicitProfitRate = firstNumber(item, [
        "profitRate",
        "returnRate",
        "pnlRate",
        "gainPercent",
        "resultRate",
        "profit_rate",
        "return_rate",
        "pnl_rate",
        "gain_percent",
        "result_rate",
      ]);

      const calculatedProfitRate =
        entryPrice > 0 && exitPrice > 0
          ? ((exitPrice - entryPrice) / entryPrice) * 100
          : 0;

      const profitRate =
        explicitProfitRate !== 0 ? explicitProfitRate : calculatedProfitRate;

      const explicitProfitAmount = firstNumber(item, [
        "profitAmount",
        "profit",
        "totalProfit",
        "pnl",
        "gain",
        "profit_amount",
        "total_profit",
      ]);

      const calculatedProfitAmount =
        entryPrice > 0 && exitPrice > 0 ? (exitPrice - entryPrice) * 100 : 0;

      const profitAmount =
        explicitProfitAmount !== 0
          ? explicitProfitAmount
          : calculatedProfitAmount;

      const aiPower = firstNumber(item, [
        "aiPower",
        "score",
        "power",
        "confidence",
      ]);

      const date = firstString(item, [
        "date",
        "targetDate",
        "resultDate",
        "tradeDate",
        "predictionDate",
        "createdAt",
        "updatedAt",
        "judgedAt",
        "target_date",
        "result_date",
        "trade_date",
        "prediction_date",
        "created_at",
        "updated_at",
        "judged_at",
      ]);

      return {
        code: code || "----",
        name: name || "銘柄名未取得",
        wins: rowWins,
        losses: rowLosses,
        holds: rowHolds,
        total,
        winRate,
        profitRate,
        profitAmount,
        aiPower,
        entryPrice,
        exitPrice,
        hasJudgement: rawResult === "WIN" || rawResult === "LOSE" || rawResult === "HOLD",
        date,
      };
    })
    .filter((row): row is PerformanceRow => row !== null);

  const merged = new Map<string, PerformanceRow>();

  for (const row of rows) {
    const key = `${row.code}-${row.name}`;
    const current = merged.get(key);

    if (!current) {
      merged.set(key, row);
      continue;
    }

    const wins = Math.max(current.wins, row.wins);
    const losses = Math.max(current.losses, row.losses);
    const holds = Math.max(current.holds, row.holds);
    const total = Math.max(
      current.total,
      row.total,
      wins + losses + holds,
    );

    const judged = wins + losses;

    merged.set(key, {
      ...current,
      ...row,
      wins,
      losses,
      holds,
      total,
      winRate:
        row.winRate ||
        current.winRate ||
        (judged > 0 ? (wins / judged) * 100 : 0),
      profitRate:
        Math.abs(row.profitRate) >= Math.abs(current.profitRate)
          ? row.profitRate
          : current.profitRate,
      profitAmount:
        Math.abs(row.profitAmount) >= Math.abs(current.profitAmount)
          ? row.profitAmount
          : current.profitAmount,
      aiPower: Math.max(current.aiPower, row.aiPower),
      entryPrice: row.entryPrice || current.entryPrice,
      exitPrice: row.exitPrice || current.exitPrice,
      hasJudgement: current.hasJudgement || row.hasJudgement,
      date: row.date || current.date,
    });
  }

  return Array.from(merged.values());
}

function readSummaryNumber(
  payloads: unknown[],
  keys: string[],
  fallback = 0,
) {
  const visit = (value: unknown, depth = 0): number | null => {
    if (depth > 5 || value === null || value === undefined) return null;

    if (isRecord(value)) {
      for (const key of keys) {
        if (key in value) {
          const number = asNumber(value[key], Number.NaN);
          if (Number.isFinite(number)) return number;
        }
      }

      for (const child of Object.values(value)) {
        const found = visit(child, depth + 1);
        if (found !== null) return found;
      }
    }

    return null;
  };

  for (const payload of payloads) {
    const found = visit(payload);
    if (found !== null) return found;
  }

  return fallback;
}

function buildPowerBands(rows: PerformanceRow[]): PowerBand[] {
  const bands = [
    { label: "90〜100", min: 90, max: 100 },
    { label: "80〜89", min: 80, max: 89.999 },
    { label: "70〜79", min: 70, max: 79.999 },
    { label: "60〜69", min: 60, max: 69.999 },
    { label: "0〜59", min: 0, max: 59.999 },
  ];

  return bands.map((band) => {
    const targets = rows.filter(
      (row) => row.aiPower >= band.min && row.aiPower <= band.max,
    );

    const wins = targets.reduce((sum, row) => sum + row.wins, 0);
    const losses = targets.reduce((sum, row) => sum + row.losses, 0);
    const total = wins + losses;

    return {
      label: band.label,
      wins,
      losses,
      total,
      winRate: total > 0 ? (wins / total) * 100 : 0,
    };
  });
}

function buildMonthly(rows: PerformanceRow[]): MonthlyRow[] {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
  });

  const grouped = new Map<
    string,
    { wins: number; losses: number; total: number; date: Date }
  >();

  for (const row of rows) {
    if (!row.date) continue;

    const date = new Date(row.date);
    if (Number.isNaN(date.getTime())) continue;

    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}`;

    const current = grouped.get(monthKey) ?? {
      wins: 0,
      losses: 0,
      total: 0,
      date,
    };

    current.wins += row.wins;
    current.losses += row.losses;
    current.total += row.wins + row.losses;

    grouped.set(monthKey, current);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([monthKey, value]) => ({
      monthKey,
      label: `${formatter.format(value.date)}月`,
      wins: value.wins,
      losses: value.losses,
      total: value.total,
      winRate:
        value.total > 0 ? (value.wins / value.total) * 100 : 0,
    }));
}

function formatYen(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("ja-JP")}円`;
}

function formatPercent(value: number, digits = 1) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "取得できませんでした";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function StatCard({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${
        emphasis
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs font-black tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-black ${
          emphasis ? "text-blue-700" : "text-slate-950"
        }`}
      >
        {value}
      </p>
      {note ? (
        <p className="mt-1 text-xs font-bold text-slate-400">{note}</p>
      ) : null}
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-xs font-black tracking-[0.16em] text-blue-600">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export default function PerformanceCenterPage() {
  const [payloads, setPayloads] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(
    new Date().toISOString(),
  );

  async function loadDashboard() {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled(
      API_ENDPOINTS.map(async (endpoint) => {
        const response = await fetch(endpoint, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`${endpoint}: ${response.status}`);
        }

        return response.json() as Promise<unknown>;
      }),
    );

    const fulfilled = results
      .filter(
        (result): result is PromiseFulfilledResult<unknown> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);

    if (!fulfilled.length) {
      setError(
        "AI実績データを取得できませんでした。APIの状態を確認してください。",
      );
    }

    setPayloads(fulfilled);
    setRefreshedAt(new Date().toISOString());
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const dashboard = useMemo<DashboardData>(() => {
    const rows = normalizeRows(payloads);

    const rowWins = rows.reduce((sum, row) => sum + row.wins, 0);
    const rowLosses = rows.reduce((sum, row) => sum + row.losses, 0);
    const rowHolds = rows.reduce((sum, row) => sum + row.holds, 0);

    const totalWins = readSummaryNumber(
      payloads,
      ["totalWins", "wins", "winCount"],
      rowWins,
    );

    const totalLosses = readSummaryNumber(
      payloads,
      ["totalLosses", "losses", "loseCount", "lossCount"],
      rowLosses,
    );

    const totalHolds = readSummaryNumber(
      payloads,
      ["totalHolds", "holds", "holdCount", "pendingCount"],
      rowHolds,
    );

    const totalJudgements = readSummaryNumber(
      payloads,
      [
        "totalJudgements",
        "judgedCount",
        "totalJudged",
        "judgementCount",
      ],
      totalWins + totalLosses + totalHolds,
    );

    const totalProfitAmount = readSummaryNumber(
      payloads,
      ["totalProfitAmount", "totalProfit", "profitAmount", "pnl"],
      rows
        .filter((row) => row.hasJudgement)
        .reduce((sum, row) => sum + row.profitAmount, 0),
    );

    const positiveRates = rows
      .map((row) => row.profitRate)
      .filter((value) => value > 0);

    const negativeRates = rows
      .map((row) => row.profitRate)
      .filter((value) => value < 0);

    const averageProfitRate = readSummaryNumber(
      payloads,
      ["averageProfitRate", "avgProfitRate", "averageGain"],
      positiveRates.length
        ? positiveRates.reduce((sum, value) => sum + value, 0) /
            positiveRates.length
        : 0,
    );

    const averageLossRate = readSummaryNumber(
      payloads,
      ["averageLossRate", "avgLossRate", "averageLoss"],
      negativeRates.length
        ? negativeRates.reduce((sum, value) => sum + value, 0) /
            negativeRates.length
        : 0,
    );

    const bestWinStreak = readSummaryNumber(
      payloads,
      ["bestWinStreak", "maxWinStreak", "highestWinStreak"],
      0,
    );

    return {
      lastUpdated: refreshedAt,
      rows,
      totalJudgements,
      totalWins,
      totalLosses,
      totalHolds,
      totalProfitAmount,
      averageProfitRate,
      averageLossRate,
      bestWinStreak,
      powerBands: buildPowerBands(rows),
      monthly: buildMonthly(rows),
    };
  }, [payloads, refreshedAt]);

  const judgedTotal = dashboard.totalWins + dashboard.totalLosses;
  const overallWinRate =
    judgedTotal > 0 ? (dashboard.totalWins / judgedTotal) * 100 : 0;

  const winRateRanking = [...dashboard.rows]
    .filter((row) => row.wins + row.losses > 0)
    .sort((a, b) => {
      const aJudged = a.wins + a.losses;
      const bJudged = b.wins + b.losses;
      const aReliabilityScore = a.winRate * Math.log2(aJudged + 1);
      const bReliabilityScore = b.winRate * Math.log2(bJudged + 1);

      if (bReliabilityScore !== aReliabilityScore) {
        return bReliabilityScore - aReliabilityScore;
      }

      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return bJudged - aJudged;
    })
    .slice(0, 10);

  const profitRanking = [...dashboard.rows]
    .filter(
      (row) =>
        row.hasJudgement &&
        (row.profitAmount !== 0 || row.profitRate !== 0),
    )
    .sort((a, b) => {
      if (b.profitAmount !== a.profitAmount) {
        return b.profitAmount - a.profitAmount;
      }

      return b.profitRate - a.profitRate;
    })
    .slice(0, 10);

  const highestPower = [...dashboard.rows].sort(
    (a, b) => b.aiPower - a.aiPower,
  )[0];

  const bestProfit = profitRanking[0];
  const bestWinRate = winRateRanking[0];

  const growthCandidate = [...dashboard.rows]
    .filter((row) => row.total >= 2)
    .sort((a, b) => {
      const aScore = a.winRate + a.aiPower * 0.2;
      const bScore = b.winRate + b.aiPower * 0.2;
      return bScore - aScore;
    })[0];

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="font-black text-blue-600">
            ← Homeへ戻る
          </Link>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm disabled:opacity-50"
          >
            {loading ? "更新中..." : "再読み込み"}
          </button>
        </div>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white">
            <p className="text-xs font-black tracking-[0.18em] text-blue-200">
              SIGNALX V3.4 FINAL
            </p>

            <h1 className="mt-2 text-3xl font-black">
              🏆 AI PERFORMANCE CENTER
            </h1>

            <p className="mt-3 text-sm font-bold leading-7 text-blue-100">
              AIの実績をリアルタイムで公開。勝率・利益・AI POWER別成績から、
              SIGNALX全体の信頼性を数字で確認できます。
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-black tracking-[0.12em] text-blue-200">
                最終更新
              </p>
              <p className="mt-1 text-sm font-black text-white">
                {formatDateTime(dashboard.lastUpdated)}
              </p>
            </div>
          </div>

          <div className="space-y-8 p-5">
            {error ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
                <p className="font-black text-rose-700">データ取得エラー</p>
                <p className="mt-2 text-sm font-bold leading-6 text-rose-600">
                  {error}
                </p>
              </div>
            ) : null}

            <section>
              <SectionTitle
                eyebrow="OVERALL SUMMARY"
                title="全体サマリー"
                description="保留を除いた判定結果から全体勝率を算出します。"
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatCard
                  label="全体勝率"
                  value={`${overallWinRate.toFixed(1)}%`}
                  note={`${dashboard.totalWins.toLocaleString()}勝 / ${dashboard.totalLosses.toLocaleString()}敗`}
                  emphasis
                />

                <StatCard
                  label="総判定"
                  value={`${dashboard.totalJudgements.toLocaleString()}件`}
                  note={`保留 ${dashboard.totalHolds.toLocaleString()}件`}
                />

                <StatCard
                  label="総利益"
                  value={formatYen(dashboard.totalProfitAmount)}
                  note="判定済み実績を100株換算"
                  emphasis
                />

                <StatCard
                  label="平均利益"
                  value={formatPercent(dashboard.averageProfitRate, 2)}
                />

                <StatCard
                  label="平均損失"
                  value={formatPercent(dashboard.averageLossRate, 2)}
                />

                <StatCard
                  label="最高連勝"
                  value={
                    dashboard.bestWinStreak > 0
                      ? `${dashboard.bestWinStreak}連勝`
                      : "集計待ち"
                  }
                />
              </div>
            </section>

            <section>
              <SectionTitle
                eyebrow="WIN RATE RANKING"
                title="勝率ランキング TOP10"
                description="勝率だけでなく判定数も加味した信頼度順で表示します。"
              />

              <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-xs font-bold leading-5 text-blue-700">
                同じ勝率の場合は、判定数が多い銘柄を高く評価します。
                1勝0敗の100%より、十分な実績を持つ銘柄が上位になりやすい設計です。
              </div>

              <div className="mt-4 space-y-3">
                {winRateRanking.length ? (
                  winRateRanking.map((row, index) => (
                    <Link
                      key={`${row.code}-${row.name}`}
                      href={`/analysis/${row.code}`}
                      className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 transition hover:border-blue-300"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-black ${
                          index === 0
                            ? "bg-amber-100 text-amber-700"
                            : index === 1
                              ? "bg-slate-200 text-slate-700"
                              : index === 2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-slate-950">
                          {row.code} {row.name}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          判定 {row.wins + row.losses}件・{row.wins}勝 {row.losses}敗
                        </p>
                      </div>

                      <p className="text-xl font-black text-blue-700">
                        {row.winRate.toFixed(1)}%
                      </p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-3xl bg-slate-50 p-5 text-center">
                    <p className="text-sm font-black text-slate-500">
                      銘柄別の勝敗データを集計中です
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <SectionTitle
                eyebrow="PROFIT RANKING"
                title="利益ランキング"
                description="判定済み実績のみを対象に、保存価格と結果価格から100株換算します。"
              />

              <div className="mt-4 space-y-3">
                {profitRanking.length ? (
                  profitRanking.map((row, index) => (
                    <Link
                      key={`${row.code}-${row.name}-profit`}
                      href={`/analysis/${row.code}`}
                      className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 font-black text-emerald-700">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-slate-950">
                          {row.code} {row.name}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {row.profitRate !== 0
                            ? formatPercent(row.profitRate, 2)
                            : "利益率未取得"}
                        </p>
                      </div>

                      <p
                        className={`text-right text-base font-black ${
                          row.profitAmount >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {row.profitAmount !== 0
                          ? formatYen(row.profitAmount)
                          : formatPercent(row.profitRate, 2)}
                      </p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-3xl bg-slate-50 p-5 text-center">
                    <p className="text-sm font-black text-slate-500">
                      利益データを集計中です
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <SectionTitle
                eyebrow="AI POWER PERFORMANCE"
                title="AI POWER別実績"
                description="AI POWERが高いほど結果が良いかを帯別に検証します。"
              />

              <div className="mt-4 space-y-3">
                {dashboard.powerBands.map((band) => (
                  <div
                    key={band.label}
                    className="rounded-3xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">
                          AI POWER {band.label}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {band.total > 0
                            ? `判定 ${band.total}件・${band.wins}勝 ${band.losses}敗`
                            : "判定 0件"}
                        </p>
                      </div>

                      <p className="text-xl font-black text-blue-700">
                        {band.total > 0
                          ? `${band.winRate.toFixed(1)}%`
                          : "--"}
                      </p>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, band.winRate))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle
                eyebrow="MONTHLY TREND"
                title="月別推移"
                description="直近6か月の勝率推移からAIの進化を確認します。"
              />

              <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                {dashboard.monthly.length ? (
                  <div className="space-y-4">
                    {dashboard.monthly.map((month) => (
                      <div key={month.monthKey}>
                        <div className="flex items-center justify-between">
                          <p className="font-black text-slate-700">
                            {month.label}
                          </p>
                          <p className="font-black text-blue-700">
                            {month.winRate.toFixed(1)}%
                          </p>
                        </div>

                        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, month.winRate),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm font-black text-slate-500">
                    日付付き判定データが蓄積されると表示されます
                  </p>
                )}
              </div>
            </section>

            <section>
              <SectionTitle
                eyebrow="TODAY HIGHLIGHTS"
                title="今日のAIハイライト"
                description="現在取得できる最新データから注目銘柄を自動選出します。"
              />

              <div className="mt-4 grid gap-3">
                <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-white p-5 ring-1 ring-amber-100">
                  <p className="text-xs font-black tracking-[0.12em] text-amber-700">
                    🏆 今日の最高AI POWER
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-950">
                    {highestPower
                      ? `${highestPower.code} ${highestPower.name}`
                      : "集計待ち"}
                  </p>
                  <p className="mt-1 text-sm font-black text-amber-700">
                    {highestPower ? `AI POWER ${highestPower.aiPower}` : "--"}
                  </p>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-white p-5 ring-1 ring-emerald-100">
                  <p className="text-xs font-black tracking-[0.12em] text-emerald-700">
                    💰 今日の期待利益 No.1
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-950">
                    {bestProfit
                      ? `${bestProfit.code} ${bestProfit.name}`
                      : "集計待ち"}
                  </p>
                  <p className="mt-1 text-sm font-black text-emerald-700">
                    {bestProfit
                      ? bestProfit.profitAmount !== 0
                        ? formatYen(bestProfit.profitAmount)
                        : formatPercent(bestProfit.profitRate, 2)
                      : "--"}
                  </p>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-white p-5 ring-1 ring-blue-100">
                  <p className="text-xs font-black tracking-[0.12em] text-blue-700">
                    🔥 今日の高勝率AI
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-950">
                    {bestWinRate
                      ? `${bestWinRate.code} ${bestWinRate.name}`
                      : "集計待ち"}
                  </p>
                  <p className="mt-1 text-sm font-black text-blue-700">
                    {bestWinRate
                      ? `勝率 ${bestWinRate.winRate.toFixed(1)}%`
                      : "--"}
                  </p>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-violet-50 to-white p-5 ring-1 ring-violet-100">
                  <p className="text-xs font-black tracking-[0.12em] text-violet-700">
                    📈 成長中AI
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-950">
                    {growthCandidate
                      ? `${growthCandidate.code} ${growthCandidate.name}`
                      : "集計待ち"}
                  </p>
                  <p className="mt-1 text-sm font-black text-violet-700">
                    {growthCandidate
                      ? `勝率 ${growthCandidate.winRate.toFixed(
                          1,
                        )}% / AI POWER ${growthCandidate.aiPower}`
                      : "--"}
                  </p>
                </div>
              </div>
            </section>

            <div className="rounded-3xl bg-slate-950 p-5 text-white">
              <p className="text-xs font-black tracking-[0.14em] text-blue-300">
                SIGNALX PERFORMANCE POLICY
              </p>
              <p className="mt-2 text-lg font-black">
                仮データではなく、実績で証明する。
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-300">
                APIに存在しない数値は作らず、「集計待ち」として表示します。
                学習データが増えるほど、このページの精度も自動的に高まります。
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}