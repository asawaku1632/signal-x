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
  growth: number;
  dateCount: number;
  bestStocks: StockRanking[];
  worstStocks: StockRanking[];
  winRateTrend: TrendItem[];
  growthTrend: GrowthItem[];
  comment: string;
  updatedAt: string;
};

export default function LearningPage() {
  const [data, setData] = useState<LearningDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLearning = async () => {
      try {
        const res = await fetch("/api/learning/dashboard", {
          cache: "no-store",
        });

        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("learning dashboard error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLearning();
  }, []);

  const judgedTotal = useMemo(() => {
    if (!data) return 0;
    return data.win + data.lose;
  }, [data]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-slate-900 p-4">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
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
      <main className="min-h-screen bg-[#f7f9fc] text-slate-900 p-4">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="font-bold text-red-500">
              AI学習データを取得できませんでした
            </p>
          </div>
        </div>
      </main>
    );
  }

  const winRateTrend = data.winRateTrend
    .filter((item) => item.win + item.lose > 0)
    .map((item) => ({
      label: item.date.slice(5).replace("-", "/"),
      value: item.winRate,
    }));

  const growthTrend = data.growthTrend.map((item) => ({
    label: item.date.slice(5).replace("-", "/"),
    value: item.total,
  }));

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="flex items-center justify-between mb-4">
          <Link
            href="/"
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-2xl"
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
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-lg"
          >
            🤖
          </Link>
        </header>

        <section className="rounded-[24px] bg-gradient-to-br from-white to-blue-50 border border-blue-200 p-4 mb-4 shadow-sm">
          <div className="flex gap-4 items-center">
            <WinRateRing winRate={data.winRate} />

            <div className="flex-1">
              <p className="text-sm font-black text-blue-600">
                🧠 AI学習ダッシュボード
              </p>

              <div className="mt-3 rounded-2xl bg-white/80 border border-blue-100 px-3 py-2">
                <p className="text-xs font-black text-slate-500">更新</p>
                <p className="text-sm font-black text-slate-700">
                  {data.updatedAt}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
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

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black">📚 学習件数</h2>
            <p className="text-xs font-black text-slate-500">
              学習日数：{data.dateCount}日
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <Mini label="TOTAL" value={`${data.total}`} color="text-blue-600" />
            <Mini label="WIN" value={`${data.win}`} color="text-green-600" />
            <Mini label="LOSE" value={`${data.lose}`} color="text-red-500" />
            <Mini label="HOLD" value={`${data.hold}`} color="text-orange-500" />
            <Mini
              label="WAIT"
              value={`${data.pending}`}
              color="text-slate-500"
            />
          </div>
        </section>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black">📈 勝率推移</h2>
            <span className="text-xs font-black text-blue-600">WIN RATE</span>
          </div>

          <LineChart data={winRateTrend} suffix="%" colorClass="bg-blue-600" />
        </section>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black">🌱 AI成長グラフ</h2>
            <span className="text-xs font-black text-green-600">GROWTH</span>
          </div>

          <LineChart data={growthTrend} colorClass="bg-green-600" />
        </section>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">🥧 判定内訳</h2>

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

        <section className="rounded-[24px] bg-blue-50 border border-blue-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">💬 AIコメント</h2>
          <p className="text-sm leading-7 font-bold">{data.comment}</p>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200">
      <div className="mx-auto max-w-md grid grid-cols-5 py-2">
        <Nav href="/" icon="🏠" label="ホーム" />
        <Nav href="/today-market" icon="🤖" label="市場" />
        <Nav href="/favorites" icon="⭐" label="お気に入り" />
        <Nav href="/alerts" icon="🔔" label="通知" />
        <Nav href="/learning" icon="🧠" label="学習" active />
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
      className={`text-center text-xs font-bold ${
        active ? "text-blue-600" : "text-slate-500"
      }`}
    >
      <div className="text-2xl">{icon}</div>
      {label}
    </Link>
  );
}