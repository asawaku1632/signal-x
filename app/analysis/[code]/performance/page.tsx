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
  result: "WIN" | "LOSE" | "HOLD";
  entryPrice: number;
  exitPrice: number;
  changePercent: number | null;
  profitYen: number;
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
    judgedTotal: number;
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
  return "HOLD";
}

function resultIcon(result: PerformanceItem["result"]) {
  if (result === "WIN") return "🟢";
  if (result === "LOSE") return "🔴";
  return "🟡";
}

function resultStyle(result: PerformanceItem["result"]) {
  if (result === "WIN") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (result === "LOSE") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
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
  } = data.summary30Days;

  if (judgedTotal === 0) {
    return "まだ判定済みデータがありません。結果が蓄積されると、ここにAI実績コメントが表示されます。";
  }

  if (judgedTotal < 5) {
    return `現在は判定数が${judgedTotal}件と少ないため、過去実績スコアは参考値です。過去30日では${wins}勝${losses}敗、HOLDは${holds}件、勝率は${winRate}%、100株換算の累計損益は${yen(
      totalProfitYen,
    )}です。今後のデータ蓄積により、評価精度が高まります。`;
  }

  const balanceComment =
    averageProfitRate > averageLossRate
      ? "平均利益が平均損失を上回っており、損益バランスは良好です。"
      : "平均損失が平均利益を上回っているため、慎重な確認が必要です。";

  return `過去30日では${wins}勝${losses}敗、HOLDは${holds}件、勝率は${winRate}%です。100株換算の累計損益は${yen(
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
  if (judgedTotal < 5) return "参考評価";
  if (score >= 90 && winRate >= 75) return "非常に良好";
  if (score >= 80 && winRate >= 65) return "良好";
  if (score >= 65) return "標準";
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

  return (
    <main className="min-h-screen bg-[#f6f8fc] pb-12 text-slate-900">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="sticky top-0 z-30 -mx-4 border-b border-slate-200/70 bg-[#f6f8fc]/90 px-4 pb-3 pt-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <Link href={`/analysis/${code}`} className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-2xl font-black shadow-sm" aria-label="個別解析へ戻る">‹</Link>
            <div className="text-center">
              <div className="text-3xl font-black tracking-tight">SIGNAL<span className="text-blue-600">X</span></div>
              <div className="text-[10px] font-black tracking-[0.22em] text-slate-500">AI PERFORMANCE</div>
            </div>
            <Link href="/performance" className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-xl shadow-sm" aria-label="AI PERFORMANCE CENTER">🏆</Link>
          </div>
        </header>

        <section className="mt-4 overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-lg">
          <p className="text-[10px] font-black tracking-[0.18em] text-blue-300">30 DAY PERFORMANCE</p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-300">{stock.code} {stock.name || "銘柄名"}</p>
              <div className="mt-3 flex items-end gap-2">
                <p className="text-6xl font-black leading-none">{summary30Days.winRate}<span className="text-2xl">%</span></p>
                <p className="pb-1 text-xs font-bold text-slate-300">30日勝率</p>
              </div>
            </div>
            <div className={`rounded-2xl px-3 py-2 text-right ${summary30Days.totalProfitYen >= 0 ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
              <p className="text-[10px] font-bold text-slate-300">100株換算</p>
              <p className={`mt-1 text-xl font-black ${summary30Days.totalProfitYen >= 0 ? "text-emerald-300" : "text-red-300"}`}>{yen(summary30Days.totalProfitYen)}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/5 py-3">
            <SummaryStat label="勝敗" value={`${summary30Days.wins}勝 ${summary30Days.losses}敗`} />
            <SummaryStat label="HOLD" value={`${summary30Days.holds}件`} />
            <SummaryStat label="判定済み" value={`${summary30Days.judgedTotal}件`} />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-300">
            <span>平均利益 <b className="text-emerald-300">+{summary30Days.averageProfitRate}%</b></span>
            <span>平均損失 <b className="text-red-300">-{summary30Days.averageLossRate}%</b></span>
          </div>
        </section>

        <section className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black tracking-[0.18em] text-blue-600">RECENT RESULTS</p>
              <h2 className="mt-1 text-xl font-black">最近の判定</h2>
            </div>
            <span className="text-[10px] font-bold text-slate-400">100株換算</span>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {recent3Days.length > 0 ? recent3Days.map((item) => {
              const change = typeof item.changePercent === "number" && Number.isFinite(item.changePercent) ? item.changePercent : null;
              return (
                <div key={`${item.date}-${item.code}`} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.result === "WIN" ? "bg-emerald-500" : item.result === "LOSE" ? "bg-red-500" : "bg-amber-400"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black">{formatDate(item.date)}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${resultStyle(item.result)}`}>{resultLabel(item.result)}</span>
                      </div>
                      <p className="mt-1 truncate text-[11px] font-bold text-slate-500">AI POWER {item.aiPower}・{item.judge}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-base font-black ${item.profitYen > 0 ? "text-emerald-600" : item.profitYen < 0 ? "text-red-500" : "text-slate-700"}`}>{yen(item.profitYen)}</p>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">{change === null ? "騰落率 --" : `${change >= 0 ? "+" : ""}${change}%`}</p>
                    </div>
                  </div>
                  <div className="mt-2 pl-5 text-[10px] font-bold text-slate-400">{priceYen(item.entryPrice)} → {priceYen(item.exitPrice)}</div>
                </div>
              );
            }) : <p className="py-5 text-center text-sm font-bold text-slate-500">直近の判定データはありません</p>}
          </div>
        </section>

        <section className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black tracking-[0.18em] text-blue-600">MONTHLY TREND</p>
          <h2 className="mt-1 text-xl font-black">月別実績</h2>
          <div className="mt-4 space-y-1">
            {monthlyTrend.map((month) => (
              <div key={month.month} className="flex items-center gap-3 rounded-2xl px-3 py-3 odd:bg-slate-50">
                <p className="w-10 text-sm font-black">{month.label}</p>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">{month.judgedTotal > 0 ? `${month.winRate}%` : "判定なし"}</p>
                  <p className="text-[10px] font-bold text-slate-400">{month.wins}勝 {month.losses}敗・HOLD {month.holds}</p>
                </div>
                <p className={`text-sm font-black ${month.totalProfitYen > 0 ? "text-emerald-600" : month.totalProfitYen < 0 ? "text-red-500" : "text-slate-500"}`}>{month.total === 0 ? "-" : yen(month.totalProfitYen)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3">
            <p className="text-xs font-black text-blue-700">AIコメント</p>
            <p className="mt-1 text-xs font-bold leading-6 text-slate-600">{aiComment}</p>
          </div>
        </section>

        <details className="mt-4 rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none p-5 font-black text-slate-800">
            <span className="flex items-center justify-between">AI実績の詳しい評価を見る <span className="text-blue-600">＋</span></span>
          </summary>
          <div className="border-t border-slate-100 px-5 pb-5 pt-4">
            <div className="grid grid-cols-3 gap-2">
              <DetailStat label="実績スコア" value={`${reliability.score}/100`} />
              <DetailStat label="現在" value={`${reliability.currentWinStreak}連勝`} />
              <DetailStat label="最高" value={`${reliability.maxWinStreak}連勝`} />
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs font-bold leading-6 text-slate-500">
              <p className="font-black text-slate-700">判定ルール</p>
              <p className="mt-2">🟢 WIN：{rules.win}</p>
              <p>🔴 LOSE：{rules.lose}</p>
              <p>🟡 HOLD：{rules.hold}</p>
              <p>💰 損益：{rules.profitYen}</p>
            </div>
          </div>
        </details>

        <p className="px-3 py-6 text-center text-[10px] font-bold leading-5 text-slate-400">
          表示実績は過去データに基づく参考情報で、将来の利益を保証するものではありません。最終的な投資判断はご自身で行ってください。
        </p>
      </div>
    </main>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return <div className="px-2 text-center"><p className="text-[9px] font-bold text-slate-400">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>;
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3 text-center"><p className="text-[9px] font-bold text-slate-400">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>;
}
