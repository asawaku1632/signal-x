"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WinRateChart from "@/components/WinRateChart";

type LearningDashboard = {
  success: boolean;
  total: number;
  win: number;
  lose: number;
  hold: number;
  winRate: number;
  growth: number;
  dateCount: number;
  bestStocks: {
    code: string;
    name: string;
    winRate: number;
    total: number;
  }[];
  worstStocks: {
    code: string;
    name: string;
    winRate: number;
    total: number;
  }[];
  winRateTrend: {
    label: string;
    value: number;
  }[];
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
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-black text-blue-600">
                🧠 AI学習ダッシュボード
              </p>
              <h1 className="text-5xl font-black text-blue-600 mt-2">
                {data.winRate}%
              </h1>
              <p className="text-sm font-bold text-slate-500 mt-1">
                現在のAI勝率
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-black text-slate-500">更新</p>
              <p className="text-sm font-black text-slate-700">
                {data.updatedAt}
              </p>
            </div>
          </div>

          <div className="mt-4 h-4 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${Math.min(data.winRate, 100)}%` }}
            />
          </div>

          <div className="mt-4 rounded-2xl bg-green-50 border border-green-100 p-4 text-center">
            <p className="text-xs font-black text-slate-500">AI成長率</p>
            <p className="text-4xl font-black text-green-600 mt-1">
              +{data.growth}%
            </p>
            <p className="text-xs text-slate-500 font-bold mt-1">
              学習データ増加により精度向上中
            </p>
          </div>
        </section>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">📚 学習件数</h2>

          <div className="grid grid-cols-4 gap-2">
            <Mini label="TOTAL" value={`${data.total}`} color="text-blue-600" />
            <Mini label="WIN" value={`${data.win}`} color="text-green-600" />
            <Mini label="LOSE" value={`${data.lose}`} color="text-red-500" />
            <Mini label="HOLD" value={`${data.hold}`} color="text-slate-700" />
          </div>

          <p className="text-xs text-slate-500 font-bold mt-3">
            学習日数：{data.dateCount}日
          </p>
        </section>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-xl font-black">📈 勝率推移</h2>
    <span className="text-xs font-black text-blue-600">
      AI成長グラフ
    </span>
  </div>
 

  <WinRateChart data={data.winRateTrend} />
</section>

        <section className="rounded-[24px] bg-green-50 border border-green-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">🏆 AIが得意な銘柄</h2>

          <div className="space-y-3">
            {data.bestStocks.map((stock, index) => (
              <Link
                key={stock.code}
                href={`/analysis/${stock.code}`}
                className="block rounded-2xl bg-white border border-green-100 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-green-600">
                      {index + 1}位
                    </p>
                    <p className="text-lg font-black">
                      {stock.code} {stock.name}
                    </p>
                    <p className="text-xs text-slate-500 font-bold">
                      検証 {stock.total}回
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-black text-slate-500">勝率</p>
                    <p className="text-3xl font-black text-green-600">
                      {stock.winRate}%
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] bg-red-50 border border-red-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">⚠ AIが苦手な銘柄</h2>

          <div className="space-y-3">
            {data.worstStocks.map((stock, index) => (
              <Link
                key={stock.code}
                href={`/analysis/${stock.code}`}
                className="block rounded-2xl bg-white border border-red-100 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-red-600">
                      {index + 1}位
                    </p>
                    <p className="text-lg font-black">
                      {stock.code} {stock.name}
                    </p>
                    <p className="text-xs text-slate-500 font-bold">
                      検証 {stock.total}回
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-black text-slate-500">勝率</p>
                    <p className="text-3xl font-black text-red-500">
                      {stock.winRate}%
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] bg-blue-50 border border-blue-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">💬 AIコメント</h2>
          <p className="text-sm leading-7 font-bold">{data.comment}</p>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

function Mini({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className={`text-xl font-black mt-1 ${color}`}>{value}</p>
    </div>
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