"use client";

import { useEffect, useState } from "react";

type RankItem = {
  code: string;
  name: string;
  total: number;
  win: number;
  lose: number;
  winRate: number;
};

export default function ResultRankingPage() {
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const favoriteStocks = ranking.filter(
  (item) => item.total >= 10 && item.winRate >= 70
);

const weakStocks = ranking.filter(
  (item) => item.total >= 10 && item.winRate < 50
);

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
          <a
  key={item.code}
  href={`/analysis/${item.code}`}
  className="block bg-zinc-900 rounded-xl p-4 border border-zinc-700 hover:border-yellow-400 transition"
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
            <div className="text-zinc-400">
  勝ち {item.win} / 負け {item.lose}
</div>

<div className="mt-2 font-bold">
  {item.total >= 10 && item.winRate >= 70 ? (
    <span className="text-yellow-300">
      🔥 得意銘柄
    </span>
  ) : item.total >= 10 && item.winRate < 50 ? (
    <span className="text-red-400">
      ⚠️ 苦手銘柄
    </span>
  ) : (
    <span className="text-cyan-400">
      📚 学習中
    </span>
  )}
</div>
         </a>
        ))}
        <section className="mt-10">
  <h2 className="text-2xl font-black text-green-400 mb-4">
    🔥 得意銘柄ランキング
  </h2>

  <div className="space-y-3">
    {favoriteStocks.map((item) => (
      <div
        key={item.code}
        className="bg-green-950 border border-green-500 rounded-xl p-4"
      >
        <p className="font-black">
          {item.code} {item.name}
        </p>

        <p className="text-green-400">
          勝率 {item.winRate}%
        </p>
      </div>
    ))}
  </div>
</section>

<section className="mt-10">
  <h2 className="text-2xl font-black text-red-400 mb-4">
    ⚠️ 苦手銘柄ランキング
  </h2>

  <div className="space-y-3">
    {weakStocks.map((item) => (
      <div
        key={item.code}
        className="bg-red-950 border border-red-500 rounded-xl p-4"
      >
        <p className="font-black">
          {item.code} {item.name}
        </p>

        <p className="text-red-400">
          勝率 {item.winRate}%
        </p>
      </div>
    ))}
  </div>
</section>
      </div>
    </main>
  );
}