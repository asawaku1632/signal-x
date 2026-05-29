"use client";

import { useEffect, useState } from "react";

type TimeItem = {
  hour: string;
  label: string;
  total: number;
  win: number;
  lose: number;
  winRate: number;
  avgProfitRate: number;
  maxProfitRate: number;
  minProfitRate: number;
  learningPower: number;
};

export default function TimeRankingPage() {
  const [data, setData] = useState<TimeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history/time-stats")
      .then((res) => res.json())
      .then((json) => {
        const sorted = (json.data || []).sort(
          (a: TimeItem, b: TimeItem) => b.learningPower - a.learningPower
        );

        setData(sorted);
      })
      .catch((error) => {
        console.error("時間帯分析取得失敗", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const bestTime = data[0];

  const dangerTime = [...data]
    .filter((item) => item.total > 0)
    .sort(
      (a, b) =>
        a.winRate + a.avgProfitRate - (b.winRate + b.avgProfitRate)
    )[0];

  const totalLearning = data.reduce((sum, item) => sum + item.total, 0);

  const aiLevel = Math.min(99, Math.floor(totalLearning / 5) + 1);

  const aiRank =
    aiLevel >= 80
      ? "ULTIMATE"
      : aiLevel >= 50
      ? "ADVANCED"
      : aiLevel >= 20
      ? "GROWING"
      : "LEARNING";

  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <h1 className="text-3xl font-black">時間帯AI分析</h1>

      <p className="text-xs text-gray-400 mt-1">
        AIが強い時間帯と危険時間帯を学習
      </p>

      {loading && (
        <p className="text-sm text-gray-500 mt-6">読み込み中...</p>
      )}

      {!loading && data.length === 0 && (
        <p className="text-sm text-gray-500 mt-6">
          まだ時間帯データがありません
        </p>
      )}

      {!loading && data.length > 0 && (
        <>
          <section className="mt-6 rounded-3xl border border-cyan-500 bg-gradient-to-br from-cyan-500/20 to-purple-500/10 p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-cyan-300 font-bold">
                  SIGNALX EVOLUTION
                </p>

                <h2 className="mt-2 text-4xl font-black">Lv.{aiLevel}</h2>

                <p className="mt-2 text-sm text-zinc-300">
                  AIが市場データを継続学習中
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-zinc-400">AI RANK</p>

                <p className="text-2xl font-black text-cyan-300">
                  {aiRank}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="rounded-2xl bg-black/40 p-3">
                <p className="text-[10px] text-zinc-500">学習件数</p>

                <p className="text-2xl font-black text-pink-400">
                  {totalLearning}
                </p>
              </div>

              <div className="rounded-2xl bg-black/40 p-3">
                <p className="text-[10px] text-zinc-500">学習時間帯</p>

                <p className="text-2xl font-black text-green-400">
                  {data.length}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="h-4 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500"
                  style={{
                    width: `${Math.min(aiLevel, 100)}%`,
                  }}
                />
              </div>
            </div>
          </section>

          {bestTime && (
            <section className="mt-6 rounded-3xl border border-yellow-500 bg-gradient-to-br from-yellow-500/20 to-orange-500/10 p-5 shadow-2xl">
              <p className="text-xs text-yellow-300 font-bold">
                🔥 最強時間帯
              </p>

              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-4xl font-black">{bestTime.label}</p>
                  <p className="text-sm text-zinc-300 mt-2">
                    AIが最も強いと判断
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-zinc-400">AI POWER</p>
                  <p className="text-5xl font-black text-yellow-300">
                    {Math.round(bestTime.learningPower)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-5">
                <div className="bg-black/40 rounded-2xl p-3">
                  <p className="text-[10px] text-gray-500">勝率</p>
                  <p className="text-2xl font-black text-green-400">
                    {bestTime.winRate}%
                  </p>
                </div>

                <div className="bg-black/40 rounded-2xl p-3">
                  <p className="text-[10px] text-gray-500">平均利益</p>
                  <p className="text-2xl font-black text-cyan-400">
                    {bestTime.avgProfitRate}%
                  </p>
                </div>

                <div className="bg-black/40 rounded-2xl p-3">
                  <p className="text-[10px] text-gray-500">成功</p>
                  <p className="text-2xl font-black text-pink-400">
                    {bestTime.win}
                  </p>
                </div>
              </div>
            </section>
          )}

          {dangerTime && (
            <section className="mt-4 rounded-3xl border border-red-600 bg-gradient-to-br from-red-600/20 to-black p-5 shadow-2xl">
              <p className="text-xs text-red-300 font-bold">
                ⚠ 危険時間帯
              </p>

              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-4xl font-black">{dangerTime.label}</p>
                  <p className="text-sm text-zinc-300 mt-2">
                    AIが注意すべきと判断
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-zinc-400">RISK</p>
                  <p className="text-5xl font-black text-red-400">
                    {Math.round(100 - dangerTime.learningPower)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-5">
                <div className="bg-black/40 rounded-2xl p-3">
                  <p className="text-[10px] text-gray-500">勝率</p>
                  <p className="text-2xl font-black text-red-400">
                    {dangerTime.winRate}%
                  </p>
                </div>

                <div className="bg-black/40 rounded-2xl p-3">
                  <p className="text-[10px] text-gray-500">平均利益</p>
                  <p
                    className={`text-2xl font-black ${
                      dangerTime.avgProfitRate >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {dangerTime.avgProfitRate}%
                  </p>
                </div>

                <div className="bg-black/40 rounded-2xl p-3">
                  <p className="text-[10px] text-gray-500">失敗</p>
                  <p className="text-2xl font-black text-blue-400">
                    {dangerTime.lose}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="mt-6 space-y-4">
            {data.map((item, index) => (
              <div
                key={`${item.hour}-${index}`}
                className="rounded-2xl border border-purple-800 bg-zinc-900 p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-yellow-300 text-2xl font-black">
                      #{index + 1}
                    </p>

                    <h2 className="text-2xl font-black mt-2">
                      {item.label}
                    </h2>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] text-gray-500">AI POWER</p>
                    <p className="text-4xl font-black text-purple-400">
                      {Math.round(item.learningPower)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="bg-black/40 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">勝率</p>
                    <p className="text-2xl font-black text-green-400">
                      {item.winRate}%
                    </p>
                  </div>

                  <div className="bg-black/40 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">平均利益</p>
                    <p
                      className={`text-2xl font-black ${
                        item.avgProfitRate >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {item.avgProfitRate}%
                    </p>
                  </div>

                  <div className="bg-black/40 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">成功</p>
                    <p className="text-xl font-black text-red-400">
                      {item.win}
                    </p>
                  </div>

                  <div className="bg-black/40 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">失敗</p>
                    <p className="text-xl font-black text-blue-400">
                      {item.lose}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      style={{
                        width: `${Math.min(item.learningPower, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}