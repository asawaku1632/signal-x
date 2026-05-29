"use client";

import { useEffect, useState } from "react";

type RankItem = {
  reason: string;
  total: number;
  win: number;
  lose: number;
  winRate: number;
  avgProfitRate: number;
  maxProfitRate: number;
  minProfitRate: number;
  learningPower: number;
};

export default function RankingPage() {
  const [data, setData] = useState<RankItem[]>([]);

  useEffect(() => {
    fetch("/api/history/stats")
      .then((res) => res.json())
      .then((json) => {
        const sorted = (json.data || []).sort(
          (a: RankItem, b: RankItem) =>
            b.learningPower - a.learningPower
        );

        setData(sorted);
      });
  }, []);

  const getRankColor = (index: number) => {
    if (index === 0) return "text-yellow-300";
    if (index === 1) return "text-gray-300";
    if (index === 2) return "text-orange-400";

    return "text-purple-300";
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <h1 className="text-3xl font-black">
        SIGNALX AIランキング
      </h1>

      <p className="text-xs text-gray-400 mt-1">
        AIが実績ベースで最強戦法を分析
      </p>

      <section className="mt-6 space-y-4">
        {data.map((item, index) => (
          <div
            key={index}
            className="rounded-2xl border border-purple-800 bg-zinc-900 p-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <p
                  className={`text-2xl font-black ${getRankColor(
                    index
                  )}`}
                >
                  #{index + 1}
                </p>

                <h2 className="text-lg font-black mt-2">
                  {item.reason}
                </h2>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-gray-500">
                  AI POWER
                </p>

                <p className="text-4xl font-black text-purple-400">
                  {Math.round(item.learningPower)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="bg-black/40 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">
                  勝率
                </p>

                <p className="text-2xl font-black text-green-400">
                  {item.winRate}%
                </p>
              </div>

              <div className="bg-black/40 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">
                  平均利益
                </p>

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
                <p className="text-[10px] text-gray-500">
                  成功
                </p>

                <p className="text-xl font-black text-red-400">
                  {item.win}
                </p>
              </div>

              <div className="bg-black/40 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">
                  失敗
                </p>

                <p className="text-xl font-black text-blue-400">
                  {item.lose}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  style={{
                    width: `${Math.min(
                      item.learningPower,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}