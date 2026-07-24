"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type RankingRow = {
  code: string;
  name: string;
  total: number;
  win: number;
  lose: number;
  hold: number;
  unknown: number;
  winRate: number;
};

type RankingResponse = {
  success: boolean;
  count: number;
  ranking: RankingRow[];
  updatedAt: string;
  error?: string;
};

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

export default function PerformanceIndexPage() {
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadRanking = async () => {
      try {
        const response = await fetch("/api/result/ranking", {
          cache: "no-store",
        });
        const data = (await response.json()) as RankingResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.error || "AI実績の取得に失敗しました。");
        }

        setRanking(data.ranking);
        setUpdatedAt(data.updatedAt);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "AI実績の取得に失敗しました。",
        );
      } finally {
        setLoading(false);
      }
    };

    loadRanking();
  }, []);

  const summary = useMemo(() => {
    const wins = ranking.reduce((sum, item) => sum + item.win, 0);
    const losses = ranking.reduce((sum, item) => sum + item.lose, 0);
    const holds = ranking.reduce((sum, item) => sum + item.hold, 0);
    const pending = ranking.reduce((sum, item) => sum + item.unknown, 0);
    const decisive = wins + losses;

    return {
      stocks: ranking.length,
      judged: decisive + holds,
      pending,
      winRate: decisive > 0 ? (wins / decisive) * 100 : 0,
    };
  }, [ranking]);

  const filteredRanking = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return ranking;

    return ranking.filter(
      (item) =>
        item.code.toLowerCase().includes(normalized) ||
        item.name.toLowerCase().includes(normalized),
    );
  }, [query, ranking]);

  const top20 = filteredRanking.slice(0, 20);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const exact = ranking.find(
      (item) => item.code === query.trim(),
    );

    if (exact) {
      window.location.href = `/performance/${exact.code}`;
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black tracking-[0.24em] text-cyan-300">
            SIGNALX TRANSPARENCY
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            AI PERFORMANCE CENTER
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-blue-100 sm:text-base">
            AIの予測を翌営業日の実データで検証し、WIN・LOSE・HOLDと損益を公開しています。
          </p>

          <form onSubmit={handleSearch} className="mt-6 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              inputMode="numeric"
              placeholder="銘柄コード・銘柄名で検索"
              className="min-w-0 flex-1 rounded-2xl border border-white/20 bg-white px-4 py-3 font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-cyan-300/30"
            />
            <button
              type="submit"
              className="rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
            >
              検索
            </button>
          </form>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="対象銘柄" value={`${summary.stocks}銘柄`} />
          <SummaryCard label="全体勝率" value={formatPercent(summary.winRate)} />
          <SummaryCard label="判定済み" value={`${summary.judged}件`} />
          <SummaryCard label="判定待ち" value={`${summary.pending}件`} />
        </section>

        <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                WIN RATE RANKING
              </p>
              <h2 className="mt-2 text-2xl font-black">AI勝率ランキング TOP20</h2>
              <p className="mt-2 text-xs font-bold text-slate-500">
                勝率は WIN ÷（WIN + LOSE）で計算。HOLDは判定済み件数に含まれます。
              </p>
            </div>
            {updatedAt ? (
              <p className="text-xs font-bold text-slate-400">更新 {updatedAt}</p>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-6 rounded-3xl bg-slate-50 p-8 text-center font-black text-slate-500">
              AI実績を集計中...
            </div>
          ) : errorMessage ? (
            <div className="mt-6 rounded-3xl bg-red-50 p-5 text-sm font-bold text-red-700">
              {errorMessage}
            </div>
          ) : top20.length === 0 ? (
            <div className="mt-6 rounded-3xl bg-slate-50 p-8 text-center font-black text-slate-500">
              該当する銘柄はありません。
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {top20.map((stock, index) => {
                const judged = stock.win + stock.lose + stock.hold;
                return (
                  <Link
                    key={stock.code}
                    href={`/performance/${stock.code}`}
                    className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-900 text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black">{stock.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {stock.code}・判定済み {judged}件（WIN {stock.win} / LOSE {stock.lose} / HOLD {stock.hold}）
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-blue-700">
                        {formatPercent(stock.winRate)}
                      </p>
                      <p className="text-[10px] font-black text-slate-400">
                        詳細を見る →
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-[2rem] bg-blue-600 p-6 text-white shadow-sm sm:p-8">
          <h2 className="text-2xl font-black">AI PERFORMANCEとは？</h2>
          <p className="mt-4 text-sm font-bold leading-7 text-blue-100">
            SIGNALXは予測を表示して終わりではありません。保存時価格と翌営業日価格を比較し、結果と損益を自動判定します。実績を隠さず公開することで、AIの信頼性を数字で確認できます。
          </p>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}