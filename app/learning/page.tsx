"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import WinRateRing from "@/components/Learning/WinRateRing";
import SummaryMini from "@/components/Learning/SummaryMini";
import Mini from "@/components/Learning/Mini";
import LineChart from "@/components/Learning/LineChart";
import DonutChart from "@/components/Learning/DonutChart";
import RankingCard, {
  type StockRanking,
} from "@/components/Learning/RankingCard";

type TrendItem = {
  date: string;
  total: number;
  win: number;
  lose: number;
  hold: number;
  winRate: number;
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
  winRate: number;
  previousWinRate: number;
  diff: number;
  growth: number;
  dateCount: number;
  bestStocks: StockRanking[];
  worstStocks: StockRanking[];
  winRateTrend: TrendItem[];
  growthTrend: GrowthItem[];
  comment: string;
  updatedAt: string;
};

const DASHBOARD_TREND_LIMIT = 5;

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

  const judgedTotal = useMemo(() => {
    if (!data) return 0;
    return data.win + data.lose;
  }, [data]);

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

  const winRateTrend = data.winRateTrend
    .slice(-DASHBOARD_TREND_LIMIT)
    .map((item) => ({
      label: item.date.slice(5).replace("-", "/"),
      value: item.winRate,
    }));

  const growthTrend = data.growthTrend
    .slice(-DASHBOARD_TREND_LIMIT)
    .map((item) => ({
      label: item.date.slice(5).replace("-", "/"),
      value: item.total,
    }));

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

        <section className="mb-4 rounded-[24px] border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div>
              <WinRateRing winRate={data.winRate} />

              <div className="mt-3 rounded-2xl border border-blue-100 bg-white p-3 text-center shadow-sm">
                <p className="text-[10px] font-black text-slate-500">
                  前営業日比
                </p>
                <p
                  className={`mt-1 text-2xl font-black ${
                    data.diff > 0
                      ? "text-green-600"
                      : data.diff < 0
                        ? "text-red-500"
                        : "text-slate-600"
                  }`}
                >
                  {data.diff > 0 ? "+" : ""}
                  {data.diff}%
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">
                  前回 {data.previousWinRate}%
                </p>
              </div>
            </div>

            <div className="flex-1">
              <p className="text-sm font-black text-blue-600">
                🧠 AI学習ダッシュボード
              </p>

              <div className="mt-3 rounded-2xl border border-blue-100 bg-white/80 px-3 py-2">
                <p className="text-xs font-black text-slate-500">更新</p>
                <p className="text-sm font-black text-slate-700">
                  {data.updatedAt}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <SummaryMini
                  label="AI成長"
                  value={data.growth.toLocaleString()}
                  sub="累計学習件数"
                  color="text-green-600"
                />

                <SummaryMini
                  label="判定済み"
                  value={judgedTotal.toLocaleString()}
                  sub="WIN / LOSE"
                  color="text-blue-600"
                />
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
                  累計学習件数
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

        <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">📈 勝率推移</h2>
            <span className="text-xs font-black text-blue-600">直近5日</span>
          </div>

          <LineChart data={winRateTrend} suffix="%" colorClass="bg-blue-600" />
        </section>

        <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">🌱 AI成長グラフ</h2>
            <span className="text-xs font-black text-green-600">直近5日</span>
          </div>

          <LineChart data={growthTrend} colorClass="bg-green-600" />

          <Link
            href="/learning/growth"
            className="mt-4 block rounded-2xl border border-green-200 bg-green-50 py-3 text-center text-sm font-black text-green-700 transition active:scale-[0.98]"
          >
            AI成長履歴を詳しく見る →
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

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-md grid-cols-5 py-2">
        <Nav href="/dashboard" icon="🏠" label="ホーム" />
        <Nav href="/today-market" icon="🤖" label="市場" />
        <Nav href="/ranking" icon="🏆" label="ランキング" />
        <Nav href="/learning" icon="🧠" label="学習" active />
        <Nav href="/favorites" icon="⭐" label="お気に入り" />
      </div>
    </nav>
  );
}

function Nav({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "text-center text-xs font-bold text-blue-600"
          : "text-center text-xs font-bold text-slate-500"
      }
    >
      <div className="text-2xl">{icon}</div>
      {label}
    </Link>
  );
}