"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stock = {
  code: string;
  name: string;
  score: number;
  price: number;
  changePercent: number;
  rsi: number;
  volumeRatio: number;
  reason: string;
};

type ScanResponse = {
  stocks?: Stock[];
  totalStockList?: number;
};

const INITIAL_RANKING_COUNT = 10;
const MAX_RANKING_COUNT = 30;

function judgeLabel(score: number) {
  if (score >= 85) return "激熱";
  if (score >= 70) return "本命";
  if (score >= 50) return "静観";
  return "見送り";
}

function judgeStyle(score: number) {
  if (score >= 85) {
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300";
  }
  if (score >= 70) {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300";
  }
  return "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function rankStyle(index: number) {
  if (index === 0) {
    return "border-amber-300 bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 shadow-amber-200/70 dark:border-amber-600 dark:shadow-none";
  }
  if (index === 1) {
    return "border-slate-300 bg-gradient-to-br from-slate-100 to-slate-300 text-slate-700 dark:border-slate-500 dark:from-slate-500 dark:to-slate-700 dark:text-white";
  }
  if (index === 2) {
    return "border-orange-300 bg-gradient-to-br from-orange-200 to-orange-400 text-orange-950 dark:border-orange-700 dark:from-orange-700 dark:to-orange-900 dark:text-orange-100";
  }
  return "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function changeStyle(changePercent: number) {
  if (Math.abs(changePercent) < 0.01) return "text-slate-500 dark:text-slate-400";
  return changePercent > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}

function formatChange(changePercent: number) {
  return `${changePercent > 0 ? "+" : ""}${changePercent}%`;
}

function splitReasons(reason: string) {
  return reason
    .split(/[・\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function TopSignalsPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [totalStockList, setTotalStockList] = useState<number | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  const [showAllRanks, setShowAllRanks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchRanking() {
      try {
        const res = await fetch("/api/scan?limit=1000", { cache: "no-store" });
        if (!res.ok) throw new Error(`Ranking request failed: ${res.status}`);

        const json = (await res.json()) as ScanResponse;
        if (!active) return;
        setStocks((json.stocks ?? []).slice(0, MAX_RANKING_COUNT));
        setTotalStockList(
          typeof json.totalStockList === "number" ? json.totalStockList : null,
        );
      } catch (fetchError) {
        console.error(fetchError);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchRanking();
    return () => {
      active = false;
    };
  }, []);

  function toggleReasons(cardKey: string) {
    setExpandedReasons((current) => {
      const next = new Set(current);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  }

  const visibleStocks = showAllRanks
    ? stocks
    : stocks.slice(0, INITIAL_RANKING_COUNT);

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 px-3 py-5 text-slate-950 dark:bg-slate-950 dark:text-slate-100 sm:px-5 sm:py-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-5 border-b border-slate-200 px-1 pb-5 dark:border-slate-800 sm:mb-6 sm:pb-6">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <span aria-hidden className="text-xl">★</span>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              今日の注目銘柄
            </h1>
          </div>
          <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200 sm:text-base">
            AIが本日の市場から選んだ注目候補
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {totalStockList
              ? `約${totalStockList.toLocaleString("ja-JP")}銘柄からAI評価順に表示`
              : "市場の銘柄からAI評価順に表示"}
          </p>
        </header>

        {loading && (
          <div className="space-y-3" aria-label="ランキングを読み込み中" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="rounded-2xl border border-red-200 bg-white p-5 text-center text-sm font-bold text-red-600 shadow-sm dark:border-red-900 dark:bg-slate-900 dark:text-red-400">
            ランキングを取得できませんでした。時間をおいて再度お試しください。
          </p>
        )}

        {!loading && !error && stocks.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            現在表示できるランキングはありません。
          </p>
        )}

        {!loading && !error && stocks.length > 0 && (
          <section className="space-y-3" aria-label="AI注目銘柄ランキング">
            {visibleStocks.map((stock, index) => {
              const cardKey = `${stock.code}-${index}`;
              const reasons = splitReasons(stock.reason ?? "");
              const reasonsExpanded = expandedReasons.has(cardKey);
              const shownReasons = reasonsExpanded ? reasons : reasons.slice(0, 3);

              return (
                <article
                  key={cardKey}
                  className={`group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:bg-slate-900 dark:hover:border-blue-700 sm:p-5 ${
                    index < 3
                      ? "border-amber-200 dark:border-slate-700"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <Link
                    href={`/analysis/${stock.code}`}
                    aria-label={`${index + 1}位 ${stock.code} ${stock.name}の個別解析を見る`}
                    className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-blue-500"
                  />

                  <div className="relative z-10 pointer-events-none">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-xl border px-1 text-sm font-black shadow-sm ${rankStyle(index)}`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span className="shrink-0 text-sm font-black text-slate-700 dark:text-slate-200">
                            {stock.code}
                          </span>
                          <h2 className="min-w-0 truncate text-base font-black sm:text-lg">
                            {stock.name}
                          </h2>
                        </div>
                        {index === 0 && (
                          <p className="mt-1 text-[10px] font-black tracking-wide text-amber-700 dark:text-amber-400">
                            本日の最注目
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${judgeStyle(stock.score)}`}>
                        {judgeLabel(stock.score)}
                      </span>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/70">
                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                        <dt className="text-[10px] font-bold tracking-wide text-slate-500 dark:text-slate-400">AI POWER</dt>
                        <dd className="text-xl font-black tabular-nums text-blue-600 dark:text-blue-400">{stock.score}</dd>
                      </div>
                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                        <dt className="text-[10px] font-bold text-slate-500 dark:text-slate-400">変化率</dt>
                        <dd className={`text-sm font-black tabular-nums ${changeStyle(stock.changePercent)}`}>{formatChange(stock.changePercent)}</dd>
                      </div>
                      <div className="flex min-w-0 items-baseline justify-between gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                        <dt className="text-[10px] font-bold text-slate-500 dark:text-slate-400">RSI</dt>
                        <dd className="text-sm font-black tabular-nums">{stock.rsi}</dd>
                      </div>
                      <div className="flex min-w-0 items-baseline justify-between gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                        <dt className="text-[10px] font-bold text-slate-500 dark:text-slate-400">出来高</dt>
                        <dd className="text-sm font-black tabular-nums text-orange-600 dark:text-orange-400">{stock.volumeRatio}倍</dd>
                      </div>
                    </dl>

                    {reasons.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">主な注目理由</p>
                        <ul className="mt-1.5 space-y-1">
                          {shownReasons.map((reason, reasonIndex) => (
                            <li key={`${reason}-${reasonIndex}`} className="flex min-w-0 gap-2 text-xs font-medium leading-5 text-slate-700 dark:text-slate-200 sm:text-sm">
                              <span aria-hidden className="shrink-0 font-black text-emerald-600 dark:text-emerald-400">✓</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                        {reasons.length > 3 && (
                          <button
                            type="button"
                            aria-expanded={reasonsExpanded}
                            onClick={() => toggleReasons(cardKey)}
                            className="pointer-events-auto relative z-20 mt-1.5 rounded-md py-1 text-xs font-black text-blue-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {reasonsExpanded ? "理由を閉じる" : `＋ほか${reasons.length - 3}件`}
                          </button>
                        )}
                      </div>
                    )}

                    <p className="mt-3 text-right text-xs font-black text-blue-600 transition group-hover:text-blue-800 dark:text-blue-400 dark:group-hover:text-blue-300">
                      個別解析を見る <span aria-hidden>→</span>
                    </p>
                  </div>
                </article>
              );
            })}

            {!showAllRanks && stocks.length > INITIAL_RANKING_COUNT && (
              <button
                type="button"
                onClick={() => setShowAllRanks(true)}
                className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3.5 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                11位以降を見る（残り{stocks.length - INITIAL_RANKING_COUNT}件）
              </button>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
