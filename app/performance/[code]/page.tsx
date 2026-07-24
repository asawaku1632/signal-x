"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type PerformanceItem = {
  date: string;
  code: string;
  name: string;
  aiPower: number;
  judge: string;
  result: "WIN" | "LOSE" | "HOLD" | "PENDING";
  entryPrice: number;
  exitPrice: number | null;
  changePercent: number | null;
  profitYen: number | null;
  outcomeLabel: string;
};

type PerformanceResponse = {
  success: boolean;
  stock: {
    code: string;
    name: string;
  };
  recent3Days: PerformanceItem[];
  summary30Days: {
    total: number;
    allTotal?: number;
    pending?: number;
    judgedTotal: number;
    decisiveTotal?: number;
    wins: number;
    losses: number;
    holds: number;
    winRate: number;
    averageProfitRate: number;
    averageLossRate: number;
    totalProfitYen: number;
  };
  currentMonth: {
    month: string;
    label: string;
    total: number;
    judgedTotal: number;
    decisiveTotal?: number;
    wins: number;
    losses: number;
    holds: number;
    winRate: number;
    totalProfitYen: number;
  };
  monthlyTrend: {
    month: string;
    label: string;
    total: number;
    judgedTotal: number;
    decisiveTotal?: number;
    wins: number;
    losses: number;
    holds: number;
    winRate: number;
    totalProfitYen: number;
  }[];
  reliability: {
    score: number;
    rank: string;
    currentWinStreak: number;
    maxWinStreak: number;
    maxLoseStreak: number;
  };
  rules: {
    win: string;
    lose: string;
    hold: string;
    profitYen: string;
  };
};

function yen(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value).toLocaleString("ja-JP")}円`;
}

function priceYen(value: number) {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function resultLabel(result: PerformanceItem["result"]) {
  if (result === "WIN") return "WIN";
  if (result === "LOSE") return "LOSE";
  if (result === "HOLD") return "HOLD";
  return "判定待ち";
}

function resultIcon(result: PerformanceItem["result"]) {
  if (result === "WIN") return "🟢";
  if (result === "LOSE") return "🔴";
  if (result === "HOLD") return "🟡";
  return "🟣";
}

function resultStyle(result: PerformanceItem["result"]) {
  if (result === "WIN") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (result === "LOSE") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (result === "HOLD") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-violet-200 bg-violet-50 text-violet-700";
}

function rankLabel(rank: string) {
  if (rank === "DATA_BUILDING") return "データ蓄積中";
  return `${rank}ランク`;
}

function scoreComment(score: number, judgedTotal: number) {
  if (judgedTotal < 5) {
    return "判定数がまだ少ないため、過去実績スコアは参考値です。データ蓄積により精度が高まります。";
  }

  if (score >= 90) {
    return "過去30日で非常に高い実績を維持しています。";
  }

  if (score >= 80) {
    return "過去30日で安定した実績を維持しています。";
  }

  if (score >= 70) {
    return "過去実績は良好です。相場状況と合わせて確認しましょう。";
  }

  if (score >= 60) {
    return "標準的な実績です。今後の判定結果も確認しましょう。";
  }

  return "実績はまだ安定していません。AI判断だけに頼らず慎重に確認しましょう。";
}

function buildAiComment(data: PerformanceResponse) {
  const {
    wins,
    losses,
    holds,
    winRate,
    totalProfitYen,
    judgedTotal,
    averageProfitRate,
    averageLossRate,
    pending = 0,
  } = data.summary30Days;

  const updateComment =
    pending > 0
      ? `最新営業日までAI分析は反映されています。現在${pending}件が判定待ちで、翌営業日の株価取得後に自動で成績へ反映されます。`
      : "最新営業日までの判定結果が成績へ反映されています。";

  if (judgedTotal === 0) {
    return `${updateComment} まだ判定済みデータがないため、結果が蓄積されるとここにAI実績コメントが表示されます。`;
  }

  const resultSummary = `過去30日では判定済み${judgedTotal}件（WIN ${wins}件・LOSE ${losses}件・HOLD ${holds}件）です。`;
  const winRateSummary =
    wins + losses > 0
      ? `勝敗が付いた${wins + losses}件での勝率は${winRate}%です。`
      : "まだWIN・LOSEの勝敗が付いたデータはありません。";

  if (judgedTotal < 5) {
    return `${updateComment} 現在は判定数が${judgedTotal}件と少ないため、過去実績スコアは参考値です。${resultSummary}${winRateSummary}100株換算の累計損益は${yen(
      totalProfitYen,
    )}です。今後のデータ蓄積により、評価精度が高まります。`;
  }

  const balanceComment =
    averageLossRate === 0 && averageProfitRate > 0
      ? "現在はLOSEがないため平均損失は未算出です。"
      : averageProfitRate > averageLossRate
        ? "平均利益が平均損失を上回っており、損益バランスは良好です。"
        : "平均損失が平均利益を上回っているため、慎重な確認が必要です。";

  return `${updateComment} ${resultSummary}${winRateSummary}100株換算の累計損益は${yen(
    totalProfitYen,
  )}です。${balanceComment}`;
}

function getAiLevel(score: number, judgedTotal: number) {
  if (judgedTotal < 3) {
    return {
      level: 1,
      title: "学習開始",
      stars: 1,
    };
  }

  if (judgedTotal < 5) {
    return {
      level: 2,
      title: "データ蓄積中",
      stars: 2,
    };
  }

  if (score >= 90) {
    return {
      level: 7,
      title: "マスターAI",
      stars: 5,
    };
  }

  if (score >= 85) {
    return {
      level: 6,
      title: "エキスパートAI",
      stars: 5,
    };
  }

  if (score >= 80) {
    return {
      level: 5,
      title: "プロフェッショナル",
      stars: 4,
    };
  }

  if (score >= 70) {
    return {
      level: 4,
      title: "高精度",
      stars: 4,
    };
  }

  if (score >= 60) {
    return {
      level: 3,
      title: "安定判定",
      stars: 3,
    };
  }

  return {
    level: 2,
    title: "データ蓄積中",
    stars: 2,
  };
}

function getOverallGrade(
  score: number,
  judgedTotal: number,
  winRate: number,
) {
  if (judgedTotal < 3) return "学習開始";
  if (judgedTotal < 5) return "データ蓄積中";
  if (score >= 90) return "マスター";
  if (score >= 85) return "エキスパート";
  if (score >= 80) return "優秀";
  if (score >= 70) return "高精度";
  if (score >= 60) return "良好";
  if (winRate >= 50) return "標準";
  return "要確認";
}

function renderStars(count: number) {
  return `${"★".repeat(count)}${"☆".repeat(Math.max(5 - count, 0))}`;
}

export default function PerformancePage() {
  const params = useParams();
  const code = String(params.code);

  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const response = await fetch(`/api/performance/stock/${code}`, {
          cache: "no-store",
        });

        const json = (await response.json()) as PerformanceResponse & {
          message?: string;
          error?: string;
        };

        if (!response.ok || !json.success) {
          throw new Error(
            json.message || json.error || "AI実績の取得に失敗しました。",
          );
        }

        setData(json);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "AI実績の取得に失敗しました。",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [code]);

  const aiComment = useMemo(() => {
    if (!data) return "";
    return buildAiComment(data);
  }, [data]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-slate-900">
        <div className="mx-auto max-w-md">
          <div className="rounded-[2rem] border border-white bg-white p-6 text-center shadow-sm">
            <p className="text-2xl font-black">
              AI実績を読み込み中...
            </p>
            <p className="mt-2 text-sm font-bold text-slate-500">
              直近3件・30日成績・過去実績スコアを集計しています。
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!data || errorMessage) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-slate-900">
        <div className="mx-auto max-w-md">
          <Link
            href={`/analysis/${code}`}
            className="font-black text-blue-600"
          >
            ← 個別解析へ戻る
          </Link>

          <div className="mt-5 rounded-[2rem] border border-red-100 bg-white p-6 shadow-sm">
            <p className="text-xl font-black text-red-600">
              AI実績を取得できませんでした
            </p>
            <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
              {errorMessage || "時間をおいて再度お試しください。"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const {
    summary30Days,
    currentMonth,
    monthlyTrend,
    reliability,
    recent3Days,
    stock,
    rules,
  } = data;

  const aiLevel = getAiLevel(
    reliability.score,
    summary30Days.judgedTotal,
  );

  const overallGrade = getOverallGrade(
    reliability.score,
    summary30Days.judgedTotal,
    summary30Days.winRate,
  );

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-16 text-slate-900">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="sticky top-0 z-30 -mx-4 border-b border-white/70 bg-[#f7f9fc]/85 px-4 pb-3 pt-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <Link
              href={`/analysis/${code}`}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-2xl font-black shadow-sm transition active:scale-95"
              aria-label="個別解析へ戻る"
            >
              ‹
            </Link>

            <div className="text-center">
              <div className="text-3xl font-black tracking-tight">
                SIGNAL<span className="text-blue-600">X</span>
              </div>
              <div className="text-[10px] font-black tracking-[0.22em] text-slate-500">
                AI PERFORMANCE
              </div>
            </div>

            <Link
              href="/performance"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-xl shadow-sm transition active:scale-95"
              aria-label="AI PERFORMANCE CENTER"
            >
              🏆
            </Link>
          </div>
        </header>

        <section className="mt-5 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-2xl shadow-blue-200">
          <p className="text-xs font-black tracking-[0.18em] text-blue-200">
            AI PERFORMANCE CENTER
          </p>

          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black leading-none">
                {stock.code}
              </h1>
              <p className="mt-2 text-xl font-black leading-tight">
                {stock.name || "銘柄名"}
              </p>
            </div>

            <div className="rounded-3xl bg-white/10 px-4 py-3 text-center backdrop-blur">
              <p className="text-[10px] font-black text-blue-100">
                AI Lv.
              </p>
              <p className="mt-1 text-4xl font-black">
                {aiLevel.level}
              </p>
              <p className="mt-1 text-[10px] font-bold text-blue-100">
                {aiLevel.title}
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm font-bold leading-7 text-blue-100">
            AIが過去どれだけ当ててきたかを、実データで確認できます。
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <HeroMini
              label="30日勝率"
              value={`${summary30Days.winRate}%`}
            />
            <HeroMini
              label="判定済み"
              value={`${summary30Days.judgedTotal}件`}
            />
            <HeroMini
              label="判定待ち"
              value={`${summary30Days.pending ?? 0}件`}
            />
            <HeroMini
              label="累計損益"
              value={yen(summary30Days.totalProfitYen)}
            />
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                OVERALL RATING
              </p>
              <h2 className="mt-2 text-2xl font-black">
                AI総合評価
              </h2>
            </div>

            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-white">
              <p className="text-[10px] font-black text-blue-300">
                AI LEVEL
              </p>
              <p className="mt-1 text-3xl font-black">
                Lv.{aiLevel.level}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[2rem] bg-gradient-to-br from-blue-50 to-cyan-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-black text-yellow-500">
                  {renderStars(aiLevel.stars)}
                </p>
                <p className="mt-2 text-xl font-black text-slate-900">
                  {overallGrade}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {aiLevel.title}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs font-black text-slate-500">
                  過去実績スコア
                </p>
                <p className="mt-1 text-5xl font-black text-blue-600">
                  {reliability.score}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ResultMini
                label="30日勝率"
                value={`${summary30Days.winRate}%`}
                valueClass="text-blue-600"
              />
              <ResultMini
                label="判定済み"
                value={`${summary30Days.judgedTotal}件`}
              />
            </div>

            <div className="mt-3 rounded-2xl border border-violet-100 bg-white px-4 py-3">
              <p className="text-xs font-black text-slate-500">
                最新データ状況
              </p>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm font-black">
                <span className="text-violet-700">
                  判定待ち {summary30Days.pending ?? 0}件
                </span>
                <span className="text-emerald-700">
                  判定済み {summary30Days.judgedTotal}件
                </span>
              </div>
            </div>

            <p className="mt-4 text-sm font-bold leading-7 text-slate-700">
              {scoreComment(
                reliability.score,
                summary30Days.judgedTotal,
              )}
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-blue-600">
            RECENT RESULTS
          </p>
          <h2 className="mt-2 text-2xl font-black">
            直近3件のAI実績
          </h2>
          <p className="mt-2 text-xs font-bold text-slate-500">
            100株換算
          </p>

          <div className="relative mt-5 space-y-4 pl-7">
            {recent3Days.length > 0 ? (
              <>
                <div className="absolute bottom-5 left-[11px] top-5 w-0.5 rounded-full bg-slate-200" />
                {recent3Days.map((item) => (
                  <article
                    key={`${item.date}-${item.code}`}
                    className="relative rounded-3xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <span
                      className={`absolute -left-[30px] top-5 grid h-6 w-6 place-items-center rounded-full border-4 border-white text-[10px] shadow-sm ${
                        item.result === "WIN"
                          ? "bg-emerald-500"
                          : item.result === "LOSE"
                            ? "bg-red-500"
                            : item.result === "HOLD"
                              ? "bg-amber-400"
                              : "bg-violet-500"
                      }`}
                      aria-hidden="true"
                    />

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {formatDate(item.date)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        AI POWER {item.aiPower}・{item.judge}
                      </p>
                    </div>

                    <span
                      className={`rounded-2xl border px-3 py-2 text-xs font-black ${resultStyle(
                        item.result,
                      )}`}
                    >
                      {resultIcon(item.result)}{" "}
                      {resultLabel(item.result)}
                    </span>
                  </div>

                  {item.result === "PENDING" ? (
                    <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
                      <p className="text-sm font-black text-violet-700">
                        翌営業日の結果を判定中
                      </p>

                      <p className="mt-2 text-xs font-bold leading-6 text-violet-600">
                        翌営業日の株価が取得されると、WIN・LOSE・HOLDと損益が自動で反映されます。
                      </p>

                      <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-[11px] font-bold text-slate-500">
                        <span>保存時価格</span>
                        <span>{priceYen(item.entryPrice)}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <ResultMini
                          label="損益"
                          value={yen(item.profitYen ?? 0)}
                          valueClass={
                            (item.profitYen ?? 0) >= 0
                              ? "text-emerald-600"
                              : "text-red-500"
                          }
                        />
                        <ResultMini
                          label="騰落率"
                          value={`${(item.changePercent ?? 0) >= 0 ? "+" : ""}${
                            item.changePercent ?? 0
                          }%`}
                          valueClass={
                            (item.changePercent ?? 0) >= 0
                              ? "text-emerald-600"
                              : "text-red-500"
                          }
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-[11px] font-bold text-slate-500">
                        <span>{priceYen(item.entryPrice)}</span>
                        <span>→</span>
                        <span>{priceYen(item.exitPrice ?? item.entryPrice)}</span>
                      </div>
                    </>
                  )}
                  </article>
                ))}
              </>
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-center">
                <p className="text-sm font-black text-slate-600">
                  直近の判定データはありません
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-3xl bg-blue-50 p-4">
            <p className="text-sm font-black text-blue-700">
              AIコメント
            </p>
            <p className="mt-2 text-sm font-bold leading-7 text-slate-700">
              {aiComment}
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-blue-600">
            30 DAY PERFORMANCE
          </p>
          <h2 className="mt-2 text-2xl font-black">
            過去30日AI成績
          </h2>

          <div className="mt-5 rounded-[2rem] bg-gradient-to-br from-blue-700 to-cyan-500 p-5 text-white">
            <p className="text-xs font-black text-blue-100">
              勝率
            </p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-6xl font-black">
                {summary30Days.winRate}
                <span className="text-2xl">%</span>
              </p>
              <p className="pb-2 text-sm font-black text-blue-100">
                {summary30Days.wins}勝{" "}
                {summary30Days.losses}敗
              </p>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${Math.min(
                    Math.max(summary30Days.winRate, 0),
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricCard
              label="平均利益"
              value={`+${summary30Days.averageProfitRate}%`}
              tone="profit"
            />
            <MetricCard
              label="平均損失"
              value={`-${summary30Days.averageLossRate}%`}
              tone="loss"
            />
            <MetricCard
              label="合計損益"
              value={yen(summary30Days.totalProfitYen)}
              tone={
                summary30Days.totalProfitYen >= 0
                  ? "profit"
                  : "loss"
              }
            />
            <MetricCard
              label="HOLD"
              value={`${summary30Days.holds}件`}
              tone="neutral"
            />
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-blue-600">
            MONTHLY PERFORMANCE
          </p>
          <h2 className="mt-2 text-2xl font-black">
            今月のAI成績
          </h2>

          <div className="mt-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-700 via-blue-700 to-cyan-500 p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black text-blue-100">
                  {currentMonth.label}
                </p>
                <p className="mt-2 text-5xl font-black">
                  {currentMonth.winRate}
                  <span className="text-xl">%</span>
                </p>
                <p className="mt-1 text-sm font-bold text-blue-100">
                  {currentMonth.wins}勝 {currentMonth.losses}敗
                  {currentMonth.holds > 0
                    ? `・HOLD ${currentMonth.holds}件`
                    : ""}
                </p>
              </div>

              <div className="rounded-3xl bg-white/10 px-4 py-3 text-right backdrop-blur">
                <p className="text-[10px] font-black text-blue-100">
                  100株換算
                </p>
                <p className="mt-1 text-2xl font-black">
                  {yen(currentMonth.totalProfitYen)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">
                  直近3か月の勝率推移
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  月別の判定済み実績
                </p>
              </div>
              <span className="text-2xl">📈</span>
            </div>

            <div className="mt-5 flex h-44 items-end justify-between gap-3 rounded-[2rem] bg-slate-50 p-4">
              {monthlyTrend.map((month) => {
                const barHeight =
                  month.judgedTotal > 0
                    ? Math.max(month.winRate, 10)
                    : 6;

                return (
                  <div
                    key={month.month}
                    className="flex min-w-0 flex-1 flex-col items-center"
                  >
                    <p className="mb-2 text-center text-[11px] font-black leading-4 text-slate-700">
                      {month.judgedTotal > 0
                        ? `${month.winRate}%`
                        : month.holds > 0
                          ? "判定なし"
                          : "データなし"}
                    </p>

                    <div className="flex h-24 w-full items-end justify-center">
                      <div
                        className={`w-full max-w-12 rounded-t-2xl transition-all ${
                          month.winRate >= 70
                            ? "bg-emerald-500"
                            : month.winRate >= 50
                              ? "bg-blue-500"
                              : month.judgedTotal > 0
                                ? "bg-red-400"
                                : "bg-slate-300"
                        }`}
                        style={{
                          height: `${barHeight}%`,
                        }}
                      />
                    </div>

                    <p className="mt-3 text-xs font-black text-slate-600">
                      {month.label}
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-slate-400">
                      {month.judgedTotal}件
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 space-y-2">
              {monthlyTrend.map((month) => (
                <div
                  key={`${month.month}-summary`}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-black text-slate-800">
                      {month.label}
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-slate-500">
                      {month.judgedTotal > 0
                        ? `${month.wins}勝 ${month.losses}敗${
                            month.holds > 0
                              ? `・HOLD ${month.holds}`
                              : ""
                          }`
                        : month.holds > 0
                          ? `判定なし・HOLD ${month.holds}`
                          : "データなし"}
                    </p>
                  </div>

                  <p
                    className={`text-sm font-black ${
                      month.total === 0
                        ? "text-slate-400"
                        : month.totalProfitYen >= 0
                          ? "text-emerald-600"
                          : "text-red-500"
                    }`}
                  >
                    {month.total === 0
                      ? "-"
                      : yen(month.totalProfitYen)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-blue-600">
            AI RELIABILITY
          </p>
          <h2 className="mt-2 text-2xl font-black">
            AI過去実績ダッシュボード
          </h2>

          <div className="mt-5 rounded-[2rem] bg-slate-950 p-5 text-white">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.14em] text-blue-300">
                  PAST PERFORMANCE SCORE
                </p>
                <p className="mt-2 text-lg font-black">
                  {rankLabel(reliability.rank)}
                </p>
              </div>

              <p className="text-6xl font-black">
                {reliability.score}
                <span className="text-xl text-slate-400">
                  /100
                </span>
              </p>
            </div>

            <div className="mt-5">
              <div className="relative h-4 overflow-hidden rounded-full bg-white/15">
                <div
                  className={`h-full rounded-full transition-all ${
                    reliability.score >= 80
                      ? "bg-emerald-400"
                      : reliability.score >= 60
                        ? "bg-yellow-400"
                        : reliability.score >= 40
                          ? "bg-orange-400"
                          : "bg-red-400"
                  }`}
                  style={{
                    width: `${Math.min(
                      Math.max(reliability.score, 0),
                      100,
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-2 flex justify-between text-[10px] font-black text-slate-400">
                <span>0</span>
                <span>C 60</span>
                <span>A 80</span>
                <span>S 90</span>
                <span>100</span>
              </div>
            </div>

            <p className="mt-4 text-xs font-bold leading-6 text-slate-300">
              {scoreComment(
                reliability.score,
                summary30Days.judgedTotal,
              )}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-sm font-black text-slate-700">
              AI実績バッジ
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <BadgeCard
                icon="🏅"
                label="勝率70%突破"
                active={summary30Days.winRate >= 70}
              />
              <BadgeCard
                icon="🔥"
                label="5連勝達成"
                active={reliability.maxWinStreak >= 5}
              />
              <BadgeCard
                icon="💰"
                label="累計損益プラス"
                active={summary30Days.totalProfitYen > 0}
              />
              <BadgeCard
                icon="⭐"
                label="Performance A"
                active={reliability.score >= 80}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <StreakCard
              label="現在"
              value={`${reliability.currentWinStreak}連勝`}
            />
            <StreakCard
              label="最高連勝"
              value={`${reliability.maxWinStreak}連勝`}
            />
            <StreakCard
              label="最大連敗"
              value={`${reliability.maxLoseStreak}連敗`}
            />
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-700">
              判定ルール
            </p>
            <div className="mt-3 space-y-2 text-xs font-bold text-slate-500">
              <p>🟢 WIN：{rules.win}</p>
              <p>🔴 LOSE：{rules.lose}</p>
              <p>🟡 HOLD：{rules.hold}</p>
              <p>💰 損益：{rules.profitYen}</p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">
            ご利用前の注意
          </p>
          <p className="mt-2 text-xs font-bold leading-6 text-amber-900">
            表示される実績は過去データに基づく参考情報です。将来の利益や同様の結果を保証するものではありません。最終的な投資判断はご自身の責任で行ってください。
          </p>
        </section>
      </div>
    </main>
  );
}

function HeroMini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl bg-white/10 p-3 text-center backdrop-blur">
      <p className="text-[10px] font-black text-blue-100">
        {label}
      </p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function ResultMini({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-lg font-black ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "profit" | "loss" | "neutral";
}) {
  const style =
    tone === "profit"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "loss"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-3xl border p-4 ${style}`}>
      <p className="text-xs font-black">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function BadgeCard({
  icon,
  label,
  active,
}: {
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`relative rounded-3xl border p-4 ${
        active
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-slate-50 opacity-75"
      }`}
    >
      <span className="absolute right-3 top-3 text-sm">
        {active ? "✅" : "🔒"}
      </span>

      <p className={`text-2xl ${active ? "" : "grayscale"}`}>
        {icon}
      </p>

      <p
        className={`mt-2 pr-5 text-xs font-black leading-5 ${
          active ? "text-blue-700" : "text-slate-500"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-1 text-[10px] font-bold ${
          active ? "text-blue-500" : "text-slate-400"
        }`}
      >
        {active ? "獲得済み" : "未獲得"}
      </p>
    </div>
  );
}

function StreakCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4 text-center">
      <p className="text-[10px] font-black text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}