"use client";

import { useEffect, useState } from "react";

type RankItem = {
  code: string;
  name: string;
  total: number;
  win: number;
  winRate: number;
};

export default function ResultRankingPage() {
  const [ranking, setRanking] = useState<RankItem[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/result/ranking");
    const json = await res.json();

    setRanking(json.ranking || []);
  }

  return (
    <main className="min-h-screen bg-black text-white p-4">
      <h1 className="text-3xl font-bold text-yellow-400 mb-6">
        🏆 AI勝率ランキング
      </h1>

      <div className="space-y-4">
        {ranking.map((item, index) => (
          <div
            key={item.code}
            className="bg-zinc-900 rounded-xl p-4 border border-zinc-700"
          >
            <div className="text-xl font-bold">
              {index === 0 && "🥇"}
              {index === 1 && "🥈"}
              {index === 2 && "🥉"}
              {" "}
              {item.code}
            </div>

            <div className="text-lg">
              {item.name}
            </div>

            <div className="text-green-400 text-2xl font-bold">
              勝率 {item.winRate}%
            </div>

            <div className="text-zinc-400">
              検証回数 {item.total}回
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}