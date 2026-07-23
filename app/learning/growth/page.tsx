"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
        index === 0 ? null : Math.max(0, item.total - items[index - 1].total),
    }));
  }, [data]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-bold text-slate-500">
              AI成長履歴を読み込み中...
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
              AI成長履歴を取得できませんでした
            </p>
          </div>
        </div>
      </main>
    );
  }

  const firstTotal = history[0]?.total ?? 0;
  const latestTotal = history.at(-1)?.total ?? data.total;
  const totalIncrease = Math.max(0, latestTotal - firstTotal);
  const averageIncrease =
    history.length > 1
      ? Math.round(totalIncrease / (history.length - 1))
      : 0;

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
            <div className="text-3xl font-black">AI成長履歴</div>
            <div className="text-xs font-black tracking-[0.18em] text-green-600">
              GROWTH HISTORY
            </div>
          </div>

          <div className="h-11 w-11" />
        </header>

        <section className="mb-4 rounded-[24px] border border-green-200 bg-gradient-to-br from-white to-green-50 p-4 shadow-sm">
          <p className="text-sm font-black text-green-700">
            現在の累計学習件数
          </p>

          <p className="mt-1 text-5xl font-black tracking-tight text-green-600">
            {latestTotal.toLocaleString()}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Summary
              label="記録日数"
              value={`${history.length}日`}
              color="text-green-600"
            />
            <Summary
              label="期間内成長"
              value={`+${totalIncrease.toLocaleString()}`}
              color="text-green-600"
            />
            <Summary
              label="平均増加"
              value={`+${averageIncrease.toLocaleString()}`}
              color="text-blue-600"
            />
          </div>

          <p className="mt-3 text-right text-[11px] font-bold text-slate-400">
            更新 {data.updatedAt}
          </p>
        </section>

        <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">📋 日別履歴</h2>
            <span className="text-xs font-black text-slate-500">
              {history.length}件
            </span>
          </div>

          <div className="space-y-3">
            {[...history].reverse().map((item, index) => (
              <article
                key={`${item.date}-${item.total}`}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-slate-700">
                      {item.date.replaceAll("-", "/")}
                    </p>

                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {index === 0 ? "最新記録" : "学習履歴"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-black text-green-600">
                      {item.total.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-black text-slate-400">
                      累計学習件数
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-xl border border-blue-100 bg-white px-3 py-2">
                  <span className="text-xs font-black text-slate-500">
                    前回からの増加
                  </span>

                  <span
                    className={`text-sm font-black ${
                      item.increase === null
                        ? "text-slate-400"
                        : item.increase > 0
                          ? "text-blue-600"
                          : "text-slate-500"
                    }`}
                  >
                    {item.increase === null
                      ? "初回記録"
                      : item.increase > 0
                        ? `+${item.increase.toLocaleString()}件`
                        : "増減なし"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <Link
          href="/learning"
          className="mb-4 block rounded-2xl border border-blue-200 bg-blue-50 py-3 text-center text-sm font-black text-blue-700"
        >
          AI学習ページへ戻る
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}

function Summary({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-green-100 bg-white p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-black ${color}`}>{value}</p>
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