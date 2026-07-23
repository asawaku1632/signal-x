"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type FavoriteRecord = {
  code: string;
  name: string;
  addedAt: string;
};

type Stock = {
  code: string;
  name: string;
  price: number;
  score?: number;
  aiPower?: number;
  changePercent?: number;
  reason?: string;
  takeProfit?: number;
  stopLoss?: number;
};

type FavoritesApiResponse = {
  success: boolean;
  count?: number;
  favorites?: FavoriteRecord[];
  error?: string;
};

type ScanApiResponse = {
  stocks?: Stock[];
};

function yen(value?: number) {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${Math.round(value).toLocaleString()}円`;
}

function getPower(stock: Stock) {
  return Number(stock.score ?? stock.aiPower ?? 0);
}

function getJudge(power: number) {
  if (power >= 80) return "買い候補";
  if (power >= 75) return "押し目待ち";
  if (power >= 65) return "様子見";
  return "見送り";
}

function getJudgeColor(power: number) {
  if (power >= 80) return "bg-green-100 text-green-700";
  if (power >= 75) return "bg-blue-100 text-blue-700";
  if (power >= 65) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);

  const loadFavorites = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");
    setLoginRequired(false);

    try {
      const favoritesRes = await fetch("/api/favorites", {
        cache: "no-store",
      });

      const favoritesJson =
        (await favoritesRes.json()) as FavoritesApiResponse;

      if (favoritesRes.status === 401) {
        setFavorites([]);
        setLoginRequired(true);
        return;
      }

      if (!favoritesRes.ok || !favoritesJson.success) {
        throw new Error(
          favoritesJson.error || "お気に入りの取得に失敗しました"
        );
      }

      const savedFavorites = favoritesJson.favorites ?? [];

      if (savedFavorites.length === 0) {
        setFavorites([]);
        return;
      }

      const scanRes = await fetch("/api/scan?limit=1000", {
        cache: "no-store",
      });

      if (!scanRes.ok) {
        throw new Error("銘柄データの取得に失敗しました");
      }

      const scanJson = (await scanRes.json()) as ScanApiResponse;
      const stocks = Array.isArray(scanJson.stocks)
        ? scanJson.stocks
        : [];

      const stockMap = new Map(
        stocks.map((stock) => [String(stock.code), stock])
      );

      const selected = savedFavorites.map((favorite) => {
        const stock = stockMap.get(String(favorite.code));

        if (stock) {
          return stock;
        }

        return {
          code: String(favorite.code),
          name: favorite.name,
          price: 0,
          score: 0,
          aiPower: 0,
          changePercent: 0,
          reason: "最新データを取得できませんでした",
        } satisfies Stock;
      });

      setFavorites(selected);
    } catch (error) {
      console.error("favorites load error:", error);
      setFavorites([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "お気に入りの読み込みに失敗しました"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const removeFavorite = async (code: string) => {
    if (removingCode) return;

    setRemovingCode(code);
    setErrorMessage("");

    try {
      const res = await fetch(
        `/api/favorites?code=${encodeURIComponent(code)}`,
        {
          method: "DELETE",
          cache: "no-store",
        }
      );

      const data = (await res.json()) as FavoritesApiResponse;

      if (res.status === 401) {
        setLoginRequired(true);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "お気に入りの削除に失敗しました");
      }

      setFavorites((prev) =>
        prev.filter((stock) => stock.code !== code)
      );
    } catch (error) {
      console.error("favorite remove error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "お気に入りの削除に失敗しました"
      );
    } finally {
      setRemovingCode(null);
    }
  };

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-bold text-slate-500">
              お気に入りを読み込み中...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="mb-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            aria-label="ホームへ戻る"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-2xl shadow"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.22em] text-slate-500">
              FAVORITES
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadFavorites(true)}
            disabled={refreshing}
            aria-label="お気に入りを再読み込み"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg shadow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? "…" : "↻"}
          </button>
        </header>

        <section className="mb-4 rounded-[24px] border border-yellow-200 bg-gradient-to-br from-white to-yellow-50 p-4 shadow-sm">
          <p className="text-sm font-black text-yellow-600">
            ⭐ お気に入り
          </p>

          <div className="mt-2 flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-black">{favorites.length}</h1>
              <p className="text-sm font-bold text-slate-500">
                登録銘柄をAIが監視
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-black text-slate-500">
                監視状態
              </p>
              <p className="text-xl font-black text-green-600">
                {loginRequired ? "OFF" : "ON"}
              </p>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-black text-red-700">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => void loadFavorites()}
              className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white"
            >
              もう一度読み込む
            </button>
          </section>
        ) : null}

        {loginRequired ? (
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="mb-3 text-4xl">🔐</p>
            <h2 className="text-xl font-black">ログインが必要です</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
              Googleアカウントでログインすると、スマホとパソコンで
              お気に入りが同期されます。
            </p>

            <Link
              href="/login"
              className="mt-4 block rounded-2xl bg-blue-600 py-3 font-black text-white"
            >
              ログインする
            </Link>
          </section>
        ) : favorites.length === 0 ? (
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="mb-3 text-4xl">☆</p>
            <h2 className="text-xl font-black">
              お気に入りはまだありません
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
              分析ページ右上の☆を押すと、ここに登録されます。
            </p>

            <Link
              href="/today-market"
              className="mt-4 block rounded-2xl bg-blue-600 py-3 font-black text-white"
            >
              今日の市場から探す
            </Link>
          </section>
        ) : (
          <section className="space-y-3">
            {favorites.map((stock) => {
              const power = getPower(stock);
              const judge = getJudge(power);
              const isRemoving = removingCode === stock.code;

              return (
                <div
                  key={stock.code}
                  className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/analysis/${stock.code}`}
                      className="min-w-0 flex-1"
                    >
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black">
                          {stock.code}
                        </h2>

                        <span
                          className={`rounded-lg px-2 py-1 text-xs font-black ${getJudgeColor(
                            power
                          )}`}
                        >
                          {judge}
                        </span>
                      </div>

                      <p className="truncate text-lg font-black">
                        {stock.name}
                      </p>

                      <p className="mt-1 truncate text-xs font-bold text-slate-500">
                        {stock.reason || "AI理由なし"}
                      </p>
                    </Link>

                    <button
                      type="button"
                      onClick={() => void removeFavorite(stock.code)}
                      disabled={isRemoving || removingCode !== null}
                      aria-label={`${stock.name}をお気に入りから削除`}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-400 text-xl font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRemoving ? "…" : "★"}
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Mini label="AI" value={String(power)} />
                    <Mini label="現在値" value={yen(stock.price)} />
                    <Mini
                      label="変化率"
                      value={`${stock.changePercent ?? 0}%`}
                    />
                  </div>

                  <Link
                    href={`/chart/${stock.code}`}
                    className="mt-3 block rounded-2xl bg-slate-900 py-3 text-center font-black text-white"
                  >
                    📈 チャートを見る
                  </Link>
                </div>
              );
            })}
          </section>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function Mini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-1 break-words text-base font-black">{value}</p>
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
        <Nav href="/learning" icon="🧠" label="学習" />
        <Nav
          href="/favorites"
          icon="⭐"
          label="お気に入り"
          active
        />
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