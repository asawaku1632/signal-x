"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BottomNav from "@/app/components/BottomNav";

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
  latestBarTimestamp?: number;
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
  updatedAt?: string | null;
  status?: string;
};

function yen(value?: number) {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${Math.round(value).toLocaleString()}円`;
}

function quoteAsOf(timestamp?: number) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return "時刻不明";
  return new Date(timestamp * 1000).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function quoteIsFromEarlierDay(timestamp?: number | null) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return false;
  const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" };
  return new Date(timestamp * 1000).toLocaleDateString("ja-JP", options) !== new Date().toLocaleDateString("ja-JP", options);
}

function getPower(stock: Stock) {
  return Number(stock.score ?? stock.aiPower ?? 0);
}

function getJudge(power: number) {
  if (power >= 95) return "大本命";
  if (power >= 85) return "買い候補";
  if (power >= 75) return "押し目待ち";
  if (power >= 65) return "様子見";
  return "見送り";
}

function getJudgeColor(power: number) {
  if (power >= 95) return "bg-yellow-100 text-yellow-800";
  if (power >= 85) return "bg-green-100 text-green-700";
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
  const [scanUpdatedAt, setScanUpdatedAt] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

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
      setScanUpdatedAt(scanJson.updatedAt ?? null);
      setScanStatus(scanJson.status ?? null);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回表示時に既存のお気に入り取得を開始するため。
    void loadFavorites();
  }, [loadFavorites]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 text-slate-900">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-5 text-sm font-bold text-slate-500">
          お気に入りを読み込み中…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-2xl px-3 pb-7 pt-3 sm:px-5">
        <header className="flex items-center justify-between gap-3">
          <Link href="/dashboard" aria-label="SIGNALXホーム" className="flex items-center gap-2">
            <span className="text-3xl font-black italic text-blue-600 dark:text-blue-400">X</span>
            <span className="text-base font-black tracking-tight">SIGNAL<span className="text-blue-600 dark:text-blue-400">X</span></span>
          </Link>
          <button type="button" onClick={() => void loadFavorites(true)} disabled={refreshing}
            aria-label="お気に入りを再読み込み"
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900">
            {refreshing ? "更新中…" : "更新 ↻"}
          </button>
        </header>

        <section className="mb-3 mt-3" aria-label="お気に入りの概要">
          <div className="flex items-end justify-between gap-3">
            <h1 className="text-xl font-black leading-tight sm:text-2xl">⭐ お気に入り</h1>
            <span className="shrink-0 text-sm font-bold text-slate-600 dark:text-slate-300">
              {favorites.length}銘柄
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            保存スキャンのAI評価・参考株価で比較
          </p>
          {scanStatus === "stale" && (
            <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              前回の保存データを表示中
            </p>
          )}
        </section>

        {errorMessage && (
          <section role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-bold">{errorMessage}</p>
            <button type="button" onClick={() => void loadFavorites()}
              className="mt-2 min-h-10 rounded-xl bg-red-600 px-4 font-bold text-white">
              再読み込み
            </button>
          </section>
        )}

        {loginRequired ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-black">ログインが必要です</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">ログインするとお気に入りを同期できます。</p>
            <Link href="/login" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-black text-white">
              ログインする
            </Link>
          </section>
        ) : favorites.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-black">お気に入りはまだありません</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">銘柄の個別解析から☆で追加できます。</p>
            <Link href="/scan-mobile" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-black text-white">
              注目株を探す
            </Link>
          </section>
        ) : (
          <section aria-label="お気に入り銘柄一覧" className="space-y-2">
            {favorites.map((stock) => {
              const hasQuote = Number.isFinite(stock.price) && stock.price > 0;
              const rawPower = getPower(stock);
              const power = hasQuote && Number.isFinite(rawPower) ? rawPower : null;
              const judge = power === null ? "未取得" : getJudge(power);
              const judgeColor = power === null
                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                : getJudgeColor(power);
              const isRemoving = removingCode === stock.code;
              const change = hasQuote && typeof stock.changePercent === "number" &&
                Number.isFinite(stock.changePercent) ? stock.changePercent : null;
              const changeTone = change === null ? "text-slate-500"
                : change > 0 ? "text-emerald-700 dark:text-emerald-400"
                : change < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300";
              const quoteOld = quoteIsFromEarlierDay(stock.latestBarTimestamp);
              const href = "/analysis/" + encodeURIComponent(stock.code);

              return (
                <article key={stock.code} data-testid="favorite-compact-stock-card"
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center gap-2 px-3.5 pt-3">
                    <Link href={href} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{stock.code}</span>
                        <span className={"rounded-md px-2 py-0.5 text-[11px] font-bold " + judgeColor}>{judge}</span>
                      </div>
                      <h2 className="mt-0.5 truncate text-base font-black leading-6">{stock.name}</h2>
                    </Link>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">AI評価</p>
                      <p className="text-xl font-black leading-6 tabular-nums text-blue-600 dark:text-blue-400">
                        {power === null ? "—" : power.toFixed(Number.isInteger(power) ? 0 : 1)}
                      </p>
                    </div>
                    <button type="button"
                      onClick={() => {
                        if (window.confirm(stock.name + " をお気に入りから削除しますか？")) {
                          void removeFavorite(stock.code);
                        }
                      }}
                      disabled={removingCode !== null}
                      aria-label={stock.name + "をお気に入りから削除"}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-yellow-400 text-xl font-black text-white disabled:opacity-50">
                      {isRemoving ? "…" : "★"}
                    </button>
                  </div>

                  <Link href={href} aria-label={stock.code + " " + stock.name + "の個別解析を見る"}
                    className="block px-3.5 pb-3 pt-2">
                    <dl className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 px-1 py-2.5 dark:bg-slate-800">
                      <div className="min-w-0 text-center">
                        <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">参考株価</dt>
                        <dd className="mt-0.5 truncate text-[13px] font-black tabular-nums">
                          {hasQuote ? yen(stock.price) : "—"}
                        </dd>
                      </div>
                      <div className="min-w-0 border-x border-slate-200 text-center dark:border-slate-700">
                        <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">100株必要額</dt>
                        <dd className="mt-0.5 truncate text-[13px] font-black tabular-nums">
                          {hasQuote ? yen(stock.price * 100) : "—"}
                        </dd>
                      </div>
                      <div className="min-w-0 text-center">
                        <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">変化率</dt>
                        <dd className={"mt-0.5 truncate text-[13px] font-black tabular-nums " + changeTone}>
                          {change === null ? "—" : (change > 0 ? "+" : "") + change.toFixed(2) + "%"}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">
                        {stock.reason || "AI理由なし"}
                      </p>
                      <span className="shrink-0 text-xs font-bold text-blue-700 dark:text-blue-300">詳しく ›</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      株価時刻 {quoteAsOf(stock.latestBarTimestamp)}
                      {quoteOld ? " ・過去日データ" : null}
                    </p>
                  </Link>
                </article>
              );
            })}
          </section>
        )}

        <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          <summary className="cursor-pointer font-bold text-slate-700 dark:text-slate-200">
            データの日時・参考株価について
          </summary>
          <div className="mt-2 space-y-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
            <p>株価はYahoo Financeを元にした保存済みスキャンの参考価格です。証券会社のリアルタイム株価とは異なる場合があります。</p>
            <p>スキャン保存：{scanUpdatedAt ? new Date(scanUpdatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "不明"}（日本時間）</p>
            <p>AI評価は実測の勝率ではありません。売買前に最新株価とチャートを確認してください。</p>
          </div>
        </details>

        <BottomNav />
      </div>
    </main>
  );
}
