"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Stock = {
  code: string;
  name: string;
  score: number;
  price: number;
  changePercent?: number;
  rsi?: number;
  volumeRatio?: number;
  reason?: string;
  takeProfit?: number;
  stopLoss?: number;
};

function yen(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function judge(score = 0) {
  if (score >= 95) return "👑 大本命";
  if (score >= 85) return "🔥 激熱";
  if (score >= 70) return "🟢 強い";
  if (score >= 50) return "🟡 静観";
  return "🔴 見送り";
}

function judgeColor(score = 0) {
  if (score >= 95) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  if (score >= 85) return "bg-red-100 text-red-600 border-red-200";
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 50) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function rankBg(index: number) {
  if (index === 0) return "bg-yellow-400";
  if (index === 1) return "bg-slate-400";
  if (index === 2) return "bg-orange-500";
  return "bg-blue-600";
}

function rankLabel(index: number) {
  if (index === 0) return "🥇 1位";
  if (index === 1) return "🥈 2位";
  if (index === 2) return "🥉 3位";
  return `${index + 1}位`;
}

export default function RankingPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [sortMode, setSortMode] = useState<"score" | "change" | "price">(
    "score"
  );

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(
          () => controller.abort(),
          30_000
        );

        try {
          const res = await fetch("/api/scan?limit=100&top=100", {
            cache: "no-store",
            signal: controller.signal,
          });

          if (!res.ok) {
            throw new Error(`scan api error: ${res.status}`);
          }

          const json = await res.json();

          const list: Stock[] = Array.isArray(json)
            ? json
            : Array.isArray(json?.stocks)
              ? json.stocks
              : [];

          setStocks(list);
        } finally {
          window.clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error("ranking fetch error:", error);
        setStocks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, []);

  const filteredStocks = useMemo(() => {
    const filtered = stocks.filter((stock) => {
      const text = `${stock.code} ${stock.name}`.toLowerCase();
      return text.includes(keyword.toLowerCase());
    });

    return [...filtered]
      .sort((a, b) => {
        if (sortMode === "change") {
          return (b.changePercent ?? 0) - (a.changePercent ?? 0);
        }

        if (sortMode === "price") {
          return (a.price ?? 0) - (b.price ?? 0);
        }

        return (b.score ?? 0) - (a.score ?? 0);
      })
      .slice(0, 100);
  }, [stocks, keyword, sortMode]);

  const topStock = filteredStocks[0];

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="flex items-center justify-between mb-4">
          <Link
            href="/"
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-2xl"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.22em] text-slate-500">
              AI RANKING
            </div>
          </div>

          <Link
            href="/today-market"
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-lg"
          >
            🤖
          </Link>
        </header>

        <section className="rounded-[24px] bg-gradient-to-br from-white to-purple-50 border border-purple-200 p-4 mb-4 shadow-sm">
          <p className="text-sm font-black text-purple-600">
            🏆 AIランキング TOP100
          </p>

          <div className="flex items-end justify-between mt-2">
            <div>
              <h1 className="text-5xl font-black">
                {loading ? "-" : filteredStocks.length}
              </h1>
              <p className="text-sm font-bold text-slate-500">
                表示中の銘柄
              </p>
            </div>

            {topStock && (
              <div className="text-right">
                <p className="text-xs font-black text-slate-500">現在1位</p>
                <p className="text-xl font-black text-purple-600">
                  {topStock.code}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="銘柄コード・名前で検索"
            className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 font-bold outline-none"
          />

          <div className="grid grid-cols-3 gap-2 mt-3">
            <SortButton
              label="AI順"
              active={sortMode === "score"}
              onClick={() => setSortMode("score")}
            />
            <SortButton
              label="上昇率"
              active={sortMode === "change"}
              onClick={() => setSortMode("change")}
            />
            <SortButton
              label="低価格"
              active={sortMode === "price"}
              onClick={() => setSortMode("price")}
            />
          </div>
        </section>

        {loading && (
          <section className="rounded-[24px] bg-white border border-slate-200 p-5 shadow-sm">
            <p className="font-bold text-slate-500">
              AIランキングを読み込み中...
            </p>
          </section>
        )}

        {!loading && filteredStocks.length === 0 && (
          <section className="rounded-[24px] bg-white border border-slate-200 p-5 shadow-sm text-center">
            <p className="text-4xl mb-3">🔍</p>
            <h2 className="text-xl font-black">該当銘柄なし</h2>
          </section>
        )}

        {topStock && (
          <section className="rounded-[24px] bg-white border border-yellow-200 p-4 mb-4 shadow-sm">
            <p className="text-sm font-black text-yellow-600">
              👑 本日の最有力
            </p>

            <div className="flex items-start justify-between gap-3 mt-3">
              <div>
                <p className="text-4xl font-black">{topStock.code}</p>
                <p className="text-2xl font-black text-yellow-600">
                  {topStock.name}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs font-black text-slate-500">AI POWER</p>
                <p className="text-5xl font-black text-blue-600">
                  {topStock.score}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <Mini label="判定" value={judge(topStock.score)} />
              <Mini label="現在値" value={yen(topStock.price)} />
              <Mini label="必要資金" value={yen(topStock.price * 100)} />
              <Mini
                label="変化率"
                value={`${topStock.changePercent ?? "-"}%`}
              />
            </div>

            <Link
              href={`/analysis/${topStock.code}`}
              className="block mt-4 rounded-2xl bg-blue-600 text-white py-3 text-center font-black"
            >
              個別AI解析を見る
            </Link>
          </section>
        )}

        <section className="space-y-3">
          {filteredStocks.map((stock, index) => (
            <Link
              key={`${stock.code}-${index}`}
              href={`/analysis/${stock.code}`}
              className="block rounded-[24px] bg-white border border-slate-200 p-4 shadow-sm active:scale-[0.98] transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white ${rankBg(
                      index
                    )}`}
                  >
                    {index + 1}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-black text-purple-600">
                      {rankLabel(index)}
                    </p>

                    <div className="flex items-center gap-2 mt-1">
                      <h2 className="text-2xl font-black">{stock.code}</h2>
                      <span
                        className={`rounded-xl border px-2 py-1 text-xs font-black ${judgeColor(
                          stock.score
                        )}`}
                      >
                        {judge(stock.score)}
                      </span>
                    </div>

                    <p className="text-lg font-black truncate">
                      {stock.name}
                    </p>

                    <p className="text-xs text-slate-500 font-bold truncate mt-1">
                      {stock.reason || "AI理由なし"}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-black text-slate-500">AI</p>
                  <p className="text-3xl font-black text-blue-600">
                    {stock.score}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <Mini label="現在値" value={yen(stock.price)} />
                <Mini label="100株" value={yen(stock.price * 100)} />
                <Mini
                  label="変化率"
                  value={`${stock.changePercent ?? "-"}%`}
                />
              </div>
            </Link>
          ))}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

function SortButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl py-3 text-sm font-black ${
        active
          ? "bg-purple-600 text-white"
          : "bg-slate-50 text-slate-500 border border-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className="text-lg font-black mt-1">{value}</p>
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200">
      <div className="mx-auto max-w-md grid grid-cols-5 py-2">
        <Nav href="/" icon="🏠" label="ホーム" />
        <Nav href="/today-market" icon="🤖" label="市場" />
        <Nav href="/ranking" icon="🏆" label="ランキング" active />
        <Nav href="/alerts" icon="🔔" label="通知" />
        <Nav href="/learning" icon="🧠" label="学習" />
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
      className={`text-center text-xs font-bold ${
        active ? "text-purple-600" : "text-slate-500"
      }`}
    >
      <div className="text-2xl">{icon}</div>
      {label}
    </Link>
  );
}