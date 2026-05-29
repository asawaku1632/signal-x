"use client";

import { useEffect, useState } from "react";

type Signal = {
  name: string;
  score: number;

  patterns?: {
    rapidRise?: boolean;
    rapidDrop?: boolean;

    volumeBreakout?: boolean;
    highBreak?: boolean;

    goldenCross?: boolean;
    deadCross?: boolean;

    trendFollow?: boolean;

    upperWickWarning?: boolean;
  };
};

type DailyData = {
  title: string;
  message: string;

  color: string;
  border: string;

  stats: {
    strongCount: number;
    dangerCount: number;

    riseCount: number;
    dropCount: number;

    breakoutCount: number;
    gcCount: number;
    dcCount: number;

    trendCount: number;

    avgScore: number;
  };
};

export default function DailyPage() {
  const [daily, setDaily] =
    useState<DailyData | null>(null);

  const fetchDaily = async () => {
    try {
      const res = await fetch("/api/scan");

      const json = await res.json();

      const signals: Signal[] =
        json.stocks || [];

      const strongCount =
        signals.filter(
          (s) => s.score >= 70
        ).length;

      const dangerCount =
        signals.filter(
          (s) =>
            s.patterns?.rapidDrop ||
            s.patterns?.deadCross ||
            s.patterns?.upperWickWarning
        ).length;

      const riseCount =
        signals.filter(
          (s) => s.patterns?.rapidRise
        ).length;

      const dropCount =
        signals.filter(
          (s) => s.patterns?.rapidDrop
        ).length;

      const breakoutCount =
        signals.filter(
          (s) =>
            s.patterns?.volumeBreakout ||
            s.patterns?.highBreak
        ).length;

      const gcCount =
        signals.filter(
          (s) => s.patterns?.goldenCross
        ).length;

      const dcCount =
        signals.filter(
          (s) => s.patterns?.deadCross
        ).length;

      const trendCount =
        signals.filter(
          (s) => s.patterns?.trendFollow
        ).length;

      const avgScore =
        signals.length > 0
          ? Number(
              (
                signals.reduce(
                  (sum, item) =>
                    sum + item.score,
                  0
                ) / signals.length
              ).toFixed(1)
            )
          : 0;

      // 🚨 危険日
      if (
        dangerCount >= 4 ||
        dcCount >= 2 ||
        avgScore < 45
      ) {
        setDaily({
          title: "今日は休もう",

          message:
            "危険シグナル多め。無理なエントリー注意。",

          color: "text-red-300",

          border: "border-red-600",

          stats: {
            strongCount,
            dangerCount,

            riseCount,
            dropCount,

            breakoutCount,
            gcCount,
            dcCount,

            trendCount,

            avgScore,
          },
        });

        return;
      }

      // 💥 超強気
      if (
        strongCount >= 2 &&
        breakoutCount >= 2 &&
        gcCount >= 1 &&
        trendCount >= 2
      ) {
        setDaily({
          title: "今日はチャンスあり",

          message:
            "AI強気。大本命候補複数。",

          color: "text-purple-300",

          border: "border-purple-500",

          stats: {
            strongCount,
            dangerCount,

            riseCount,
            dropCount,

            breakoutCount,
            gcCount,
            dcCount,

            trendCount,

            avgScore,
          },
        });

        return;
      }

      // 👀 中立強め
      if (
        strongCount >= 1 ||
        gcCount >= 1 ||
        trendCount >= 1
      ) {
        setDaily({
          title: "本命候補あり",

          message:
            "監視価値あり。慎重監視推奨。",

          color: "text-cyan-300",

          border: "border-cyan-500",

          stats: {
            strongCount,
            dangerCount,

            riseCount,
            dropCount,

            breakoutCount,
            gcCount,
            dcCount,

            trendCount,

            avgScore,
          },
        });

        return;
      }

      // 😴 弱い日
      setDaily({
        title: "静観",

        message:
          "方向感弱め。今日は様子見推奨。",

        color: "text-zinc-300",

        border: "border-zinc-700",

        stats: {
          strongCount,
          dangerCount,

          riseCount,
          dropCount,

          breakoutCount,
          gcCount,
          dcCount,

          trendCount,

          avgScore,
        },
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDaily();

    const timer = setInterval(() => {
      fetchDaily();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  if (!daily) {
    return (
      <main className="min-h-screen bg-black text-white p-4">
        AI解析中...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <h1 className="text-4xl font-black">
        SIGNALX DAILY
      </h1>

      <p className="mt-1 text-sm text-gray-500">
        AI市場総括
      </p>

      <section
        className={`mt-6 rounded-3xl border bg-zinc-950 p-6 ${daily.border}`}
      >
        <p className="text-xs text-gray-500">
          AI FINAL JUDGE
        </p>

        <h2
          className={`mt-3 text-5xl font-black ${daily.color}`}
        >
          {daily.title}
        </h2>

        <p className="mt-4 text-lg text-white">
          {daily.message}
        </p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-zinc-900 p-4">
          <p className="text-xs text-gray-500">
            平均AI
          </p>

          <p className="mt-2 text-4xl font-black text-cyan-400">
            {daily.stats.avgScore}
          </p>
        </div>

        <div className="rounded-3xl bg-zinc-900 p-4">
          <p className="text-xs text-gray-500">
            本命数
          </p>

          <p className="mt-2 text-4xl font-black text-orange-400">
            {daily.stats.strongCount}
          </p>
        </div>

        <div className="rounded-3xl bg-zinc-900 p-4">
          <p className="text-xs text-gray-500">
            ブレイク
          </p>

          <p className="mt-2 text-4xl font-black text-purple-400">
            {daily.stats.breakoutCount}
          </p>
        </div>

        <div className="rounded-3xl bg-zinc-900 p-4">
          <p className="text-xs text-gray-500">
            DC警戒
          </p>

          <p className="mt-2 text-4xl font-black text-red-400">
            {daily.stats.dcCount}
          </p>
        </div>
      </section>

      <section className="mt-5 rounded-3xl bg-zinc-900 p-5">
        <p className="text-xs text-gray-500">
          AI COMMENT
        </p>

        <div className="mt-3 space-y-2 text-sm">
          <p>
            ・急騰検知 {daily.stats.riseCount} 件
          </p>

          <p>
            ・急落警戒 {daily.stats.dropCount} 件
          </p>

          <p>
            ・GC接近 {daily.stats.gcCount} 件
          </p>

          <p>
            ・トレンド継続 {daily.stats.trendCount} 件
          </p>
        </div>
      </section>
    </main>
  );
}