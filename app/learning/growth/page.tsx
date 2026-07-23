"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import LineChart from "@/components/Learning/LineChart";

type GrowthItem = {
  date: string;
  total: number;
};

type LearningDashboard = {
  success: boolean;
  total: number;
  growth: number;
  dateCount: number;
  growthTrend: GrowthItem[];
  updatedAt: string;
};

export default function LearningGrowthPage() {
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
        console.error("learning growth error:", error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchLearning();
  }, []);

  const history = useMemo(() => {
    if (!data) return [];

    return data.growthTrend.map((item, index, items) => ({
      ...item,
      increase:
        index === 0 ? 0 : Math.max(0, item.total - items[index - 1].total),
    }));
  }, [data]);

  const fullTrend = history.map((item) => ({
    label: item.date.slice(5).replace("-", "/"),
    value: item.total,
  }));

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="font-bold text-slate-500">成長履歴を読み込み中...</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="font-bold text-red-500">
            AI成長履歴を取得できませんでした
          </p>
        </div>
      </main>
    );
  }

  const firstTotal = history[0]?.total ?? 0;
  const latestTotal = history.at(-1)?.total ?? data.total;
  const totalIncrease = Math.max(0, latestTotal - firstTotal);
  const graphMinWidth = Math.max(640, fullTrend.length * 76);

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="mb-4 flex items-center justify-between">
          <Link
            href="/learning"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-2xl shadow"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-2xl font-black">
              AI成長履歴
            </div>
            <div className="text-xs font-black tracking-[0.18em] text-green-600">
              GROWTH HISTORY
            </div>
          </div>

          <div className="h-11 w-11" />
        </header>

        <section className="mb-4 rounded-[24px] border border-green-200 bg-gradient-to-br from-white to-green-50 p-4 shadow-sm">
          <p className="text-xs font-black text-green-700">現在の累計学習件数</p>
          <p className="mt-1 text-4xl font-black text-green-600">
            {latestTotal.toLocaleString()}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Summary
              label="記録日数"
              value={`${data.dateCount}日`}
            />
            <Summary
              label="期間内の成長"
              value={`+${totalIncrease.toLocaleString()}`}
            />
          </div>

          <p className="mt-3 text-right text-[11px] font-bold text-slate-400">
            更新 {data.updatedAt}
          </p>
        </section>

        <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">🌱 全期間グラフ</h2>
            <span className="text-xs font-black text-green-600">
              横にスクロール
            </span>
          </div>

          <div className="overflow-x-auto pb-2">
            <div style={{ minWidth: `${graphMinWidth}px` }}>
              <LineChart data={fullTrend} colorClass="bg-green-600" />
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">📋 日別履歴</h2>
            <span className="text-xs font-black text-slate-500">
              {history.length}件
            </span>
          </div>

          <div className="space-y-2">
            {[...history].reverse().map((item) => (
              <div
                key={`${item.date}-${item.total}`}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-black text-slate-700">
                    {item.date.replaceAll("-", "/")}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    前回比
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-black text-green-600">
                    {item.total.toLocaleString()}
                  </p>
                  <p className="text-xs font-black text-blue-600">
                    {item.increase > 0
                      ? `+${item.increase.toLocaleString()}`
                      : "初回記録"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-green-100 bg-white p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-green-600">{value}</p>
    </div>
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