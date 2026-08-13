"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import WinRateRing from "@/components/Learning/WinRateRing";
import Mini from "@/components/Learning/Mini";
import LineChart from "@/components/Learning/LineChart";
import DonutChart from "@/components/Learning/DonutChart";
import RankingCard, {
  type StockRanking,
} from "@/components/Learning/RankingCard";
import { chartPatternCatalog } from "@/app/lib/chartPatternCatalog";
import BottomNav from "@/app/components/BottomNav";
import { getWinRateDisplay } from "@/app/lib/winRateDisplay";

type TrendItem = {
  date: string;
  total: number;
  win: number;
  lose: number;
  hold: number;
  pending: number;
  winRate: number | null;
  status: "confirmed" | "processing" | "waiting_for_price";
};

type GrowthItem = {
  date: string;
  total: number;
};

type LearningDashboard = {
  success: boolean;
  total: number;
  win: number;
  lose: number;
  hold: number;
  pending: number;
  winRate: number | null;
  previousWinRate: number | null;
  diff: number | null;
  growth: number;
  dateCount: number;
  bestStocks: StockRanking[];
  worstStocks: StockRanking[];
  winRateTrend: TrendItem[];
  growthTrend: GrowthItem[];
  comment: string;
  updatedAt: string;
  latestSavedDate: string | null;
  latestConfirmedDate: string | null;
};


function formatJstDateTime(value?: string) {
  if (!value) return "-";

  const trimmed = value.trim();
  let date: Date;

  const shortUtcMatch = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/,
  );

  if (shortUtcMatch) {
    const [, month, day, hour, minute] = shortUtcMatch;
    const year = new Date().getFullYear();

    date = new Date(
      Date.UTC(
        year,
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
      ),
    );
  } else {
    const hasTimeZone =
      /Z$/i.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed);
    const normalized =
      trimmed.includes("T") && !hasTimeZone ? `${trimmed}Z` : trimmed;

    date = new Date(normalized);
  }

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("month")}/${getPart("day")} ${getPart("hour")}:${getPart(
    "minute",
  )}`;
}

const DASHBOARD_TREND_LIMIT = 5;

function trendStatus(item: TrendItem) {
  if (item.status === "confirmed") {
    return { label: "確定", className: "bg-green-50 text-green-700" };
  }

  if (item.status === "waiting_for_price") {
    return {
      label: "価格データ待ち",
      className: "bg-slate-100 text-slate-600",
    };
  }

  return { label: "判定中", className: "bg-amber-50 text-amber-700" };
}

export default function LearningPage() {
  const [data, setData] = useState<LearningDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLearning = async () => {
      try {
        const res = await fetch("/api/learning/dashboard", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`learning dashboard api error: ${res.status}`);
        }

        const json: LearningDashboard = await res.json();
        setData(json);
      } catch (error) {
        console.error("learning dashboard error:", error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchLearning();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-bold text-slate-500">
              AI学習データを読み込み中...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-bold text-red-500">
              AI学習データを取得できませんでした
            </p>
          </div>
        </div>
      </main>
    );
  }

  const dailyWinRateTrend = data.winRateTrend.slice(-DASHBOARD_TREND_LIMIT);

  const growthTrend = data.growthTrend
    .slice(-DASHBOARD_TREND_LIMIT)
    .map((item) => ({
      label: item.date.slice(5).replace("-", "/"),
      value: item.total,
    }));

  const updatedAtJst = formatJstDateTime(data.updatedAt);

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="mb-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-2xl shadow"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.22em] text-slate-500">
              AI LEARNING
            </div>
          </div>

          <Link
            href="/today-market"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg shadow"
          >
            🤖
          </Link>
        </header>

        <section className="mb-4 rounded-[24px] border border-blue-200 bg-gradient-to-br from-white to-blue-50 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-5">
            <WinRateRing winRate={data.winRate} />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-blue-600">
                🧠 AI学習状況
              </p>

              <div className="mt-3 rounded-2xl border border-blue-100 bg-white/80 px-3 py-2">
                <p className="text-xs font-black text-slate-500">
                  データ最終更新
                </p>
                <p className="text-sm font-black text-slate-700">
                  {updatedAtJst}
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-500">
                  最新保存取引日 {data.latestSavedDate ?? "-"}
                </p>
                <p className="text-[10px] font-bold text-slate-500">
                  最新完全判定日 {data.latestConfirmedDate ?? "-"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">📚 学習件数</h2>
            <p className="text-xs font-black text-slate-500">
              学習日数：{data.dateCount}日
            </p>
          </div>

          <div className="mb-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-500">TOTAL</p>
                <p className="text-[10px] font-bold text-slate-400">
                  累計銘柄観測
                </p>
              </div>

              <p className="min-w-0 text-right text-3xl font-black tracking-tight text-blue-600">
                {data.total.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Mini label="WIN" value={`${data.win}`} color="text-green-600" />
            <Mini label="LOSE" value={`${data.lose}`} color="text-red-500" />
            <Mini
              label="観察中"
              value={`${data.hold}`}
              color="text-orange-500"
            />
            <Mini
              label="判定予定"
              value={`${data.pending}`}
              color="text-slate-500"
            />
          </div>
        </section>

        <Link
          href="/learning/patterns"
          className="mb-4 flex min-w-0 items-center gap-3 rounded-[24px] border border-violet-200 bg-gradient-to-br from-white to-violet-50 p-4 shadow-sm transition active:scale-[0.99]"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-2xl text-white">
            ▰
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-lg font-black leading-tight">
              チャートパターン図鑑
            </span>
            <span className="mt-1 block break-words text-xs font-bold leading-5 text-slate-500">
              AIが検出する形を学ぶ
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-sm font-black text-violet-700">
              {chartPatternCatalog.length}パターン
            </span>
            <span className="text-xl text-slate-400">›</span>
          </span>
        </Link>

        <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">📈 日別勝率</h2>
            <span className="shrink-0 text-xs font-black text-blue-600">
              {dailyWinRateTrend.length > 0
                ? `直近${dailyWinRateTrend.length}営業日`
                : "判定データなし"}
            </span>
          </div>

          <p className="mb-5 text-xs font-bold text-slate-500">
            AIの学習成果と、その日の判定件数を日別で確認できます
          </p>

          {dailyWinRateTrend.length > 0 ? (
            <>
              <div className="grid h-[19rem] grid-cols-5 gap-1 sm:gap-2">
                {dailyWinRateTrend.map((item) => {
                  const judged = item.win + item.lose;
                  const status = trendStatus(item);
                  const display = getWinRateDisplay({
                    ...item,
                    unknown: item.pending,
                  });
                  const tone =
                    (item.winRate ?? 0) >= 70
                      ? "bg-green-500"
                      : (item.winRate ?? 0) >= 40
                        ? "bg-amber-400"
                        : "bg-red-500";

                  return (
                    <div
                      key={item.date}
                      className="grid h-full min-w-0 grid-rows-[1.25rem_2.5rem_minmax(6rem,1fr)_1.5rem_2.5rem_1.25rem_1.25rem] items-center justify-items-center"
                    >
                      <span className="text-sm font-black text-slate-900">
                        {display.label}
                      </span>
                      <span
                        className={`flex max-h-9 min-h-7 w-[calc(100%-2px)] max-w-[4.5rem] items-center justify-center rounded-xl px-0.5 py-1 text-center text-[8px] font-black leading-[1.05] sm:text-[9px] ${status.className}`}
                      >
                        {status.label}
                      </span>

                      <div className="flex h-full w-full min-w-0 items-end justify-center border-b border-slate-200">
                        {display.showBar ? (
                          <div
                            className={`w-full max-w-10 rounded-t-xl ${
                              display.state === "provisional"
                                ? "bg-amber-400"
                                : tone
                            } transition-all`}
                            style={{
                              height: `${Math.max(item.winRate ?? 0, 6)}%`,
                            }}
                            title={display.detail}
                          />
                        ) : (
                          <div className="mb-2 h-2 w-full max-w-10 rounded-full border border-dashed border-slate-300 bg-slate-50" />
                        )}
                      </div>

                      <span className="text-[11px] font-black text-slate-700">
                        {item.date.slice(5).replace("-", "/")}
                      </span>
                      <span className="flex w-full min-w-0 flex-col items-center justify-center whitespace-nowrap text-center text-[10px] font-black leading-4 text-slate-600 sm:text-[11px]">
                        <span>{item.win}勝</span>
                        <span>{item.lose}敗</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        ({judged}件)
                      </span>
                      <span className="w-full min-w-0 whitespace-nowrap text-center text-[9px] font-bold text-amber-600 sm:text-[10px]">
                        残り{item.pending}件
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-2 rounded-2xl bg-slate-50 p-3 text-[11px] font-bold text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500" />
                  <span>70%以上：非常に良い</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span>40%以上70%未満：標準的</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500" />
                  <span>40%未満：改善の余地あり</span>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3 text-xs font-bold leading-5 text-blue-700">
                💡 勝率だけでなく母数も表示することで、判定数が少ない日のブレも正しく確認できます。
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
              まだ日別のWIN / LOSE判定がありません。
            </div>
          )}
        </section>

        <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">📊 日別観測件数</h2>
            <span className="text-xs font-black text-green-600">
              直近5営業日
            </span>
          </div>

          <LineChart data={growthTrend} colorClass="bg-green-600" />

          <Link
            href="/learning/growth"
            className="mt-4 block rounded-2xl border border-green-200 bg-green-50 py-3 text-center text-sm font-black text-green-700 transition active:scale-[0.98]"
          >
            日別観測履歴を詳しく見る →
          </Link>
        </section>

        <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-black">🥧 判定内訳</h2>

          <DonutChart
            win={data.win}
            lose={data.lose}
            hold={data.hold}
            pending={data.pending}
            total={data.total}
          />
        </section>

        <RankingCard
          title="🏆 AIが得意な銘柄 TOP5"
          stocks={data.bestStocks}
          emptyText="まだWIN/LOSE判定済みの銘柄がありません。"
          type="best"
        />

        <RankingCard
          title="⚠️ AIが苦手な銘柄 TOP5"
          stocks={data.worstStocks}
          emptyText="まだ苦手銘柄の判定データがありません。"
          type="worst"
        />

        <section className="mb-4 rounded-[24px] border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-black">💬 AIコメント</h2>
          <p className="whitespace-pre-line text-sm font-bold leading-7">
            {data.comment}
          </p>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
