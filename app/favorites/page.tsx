"use client";

import { useEffect, useState } from "react";

type FavoriteStock = {
  code: string;
  name: string;
  addedAt: string;
  score?: number;
};

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteStock[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchFavorites() {
    try {
      const [favoritesRes, scanRes] = await Promise.all([
        fetch("/api/favorites", {
          cache: "no-store",
        }),
        fetch("/api/scan?limit=1000", {
          cache: "no-store",
        }),
      ]);

      const favoritesJson = await favoritesRes.json();
      const scanJson = await scanRes.json();

      const scanStocks = scanJson.stocks || [];

      const merged = (favoritesJson.favorites || []).map(
        (favorite: FavoriteStock) => {
          const stock = scanStocks.find(
            (s: any) => s.code === favorite.code
          );

          return {
            ...favorite,
            score: stock?.score ?? 0,
          };
        }
      );

      setFavorites(merged);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function removeFavorite(code: string) {
    try {
      await fetch(`/api/favorites?code=${code}`, {
        method: "DELETE",
      });

      fetchFavorites();
    } catch (error) {
      console.error(error);
    }
  }

  function scoreColor(score = 0) {
    if (score >= 85) return "text-red-400";
    if (score >= 70) return "text-cyan-300";
    if (score >= 50) return "text-yellow-300";
    return "text-zinc-500";
  }

  useEffect(() => {
    fetchFavorites();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-4">
      <div className="mx-auto max-w-md">
        <div className="mb-4 border-b border-zinc-800 pb-3">
          <h1 className="text-lg font-black text-yellow-300">
            ⭐ お気に入り（{favorites.length}）
          </h1>
        </div>

        {loading && (
          <p className="mt-8 text-center text-zinc-500">
            読み込み中...
          </p>
        )}

        {!loading && favorites.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-center">
            <p className="text-sm font-bold text-zinc-400">
              まだお気に入りはありません
            </p>
          </div>
        )}

        <section className="space-y-2">
          {favorites.map((stock) => (
            <div
              key={stock.code}
              className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3"
            >
              <a
                href={`/analysis/${stock.code}`}
                className="flex-1 font-black"
              >
                <span className="text-yellow-300">
                  {stock.code}
                </span>

                <span className="ml-2 text-white">
                  {stock.name}
                </span>

                <span
                  className={`ml-3 text-sm font-black ${scoreColor(
                    stock.score
                  )}`}
                >
                信頼度  {stock.score ?? 0}%
                </span>
              </a>

              <button
                onClick={() => removeFavorite(stock.code)}
                className="ml-3 rounded-full border border-red-700 px-3 py-1 text-xs font-bold text-red-300 hover:bg-red-950/50"
              >
                ✕
              </button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}