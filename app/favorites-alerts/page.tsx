"use client";

import { useEffect, useState } from "react";

type FavoriteAlert = {
  code: string;
  name: string;
  score: number;
  judge: string;
  rank?: number;
  totalRank?: number;
};

export default function FavoritesAlertsPage() {
  const [favorites, setFavorites] = useState<FavoriteAlert[]>([]);
  const [loading, setLoading] = useState(true);

  function judgeColor(score = 0) {
    if (score >= 85) return "text-red-400";
    if (score >= 70) return "text-cyan-300";
    if (score >= 50) return "text-yellow-300";
    return "text-zinc-500";
  }

  async function fetchData() {
    try {
      const res = await fetch("/api/favorites-alerts", {
        cache: "no-store",
      });

      const json = await res.json();
      setFavorites(json.alerts || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-black p-4 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-4 border-b border-zinc-800 pb-3">
          <h1 className="text-lg font-black text-yellow-300">
            ⭐ お気に入り監視
          </h1>
        </div>

        {loading && (
          <p className="text-center text-zinc-500">AI監視中...</p>
        )}

        <div className="space-y-2">
          {favorites.map((stock) => (
            <a
              key={stock.code}
              href={`/analysis/${stock.code}`}
              className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3"
            >
              <div className="font-black">
                <span className="text-yellow-300">{stock.code}</span>
                <span className="ml-2 text-white">{stock.name}</span>
              </div>

              <div className="text-right">
                <p className={`text-sm font-black ${judgeColor(stock.score)}`}>
                  {stock.judge}
                </p>

                <p className="text-xs text-zinc-400">
                  信頼度 {stock.score}%
                </p>

                <p className="text-xs text-yellow-300">
                  {stock.rank ?? "-"}位 / {stock.totalRank ?? "-"}銘柄中
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}