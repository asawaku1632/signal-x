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
  winRate?: number;
  judgedCount?: number;
  wins?: number;
  losses?: number;
  expectedProfitRate?: number;
  expectedProfitAmount?: number;
  reliabilityScore?: number;
};

type SortMode =
  | "score"
  | "winRate"
  | "expectedProfit"
  | "capital"
  | "change"
  | "reliability";

type BudgetMode = "all" | "10000" | "50000" | "100000" | "300000" | "500000";

const BUDGET_OPTIONS: { value: BudgetMode; label: string }[] = [
  { value: "all", label: "制限なし" },
  { value: "10000", label: "1万円" },
  { value: "50000", label: "5万円" },
  { value: "100000", label: "10万円" },
  { value: "300000", label: "30万円" },
  { value: "500000", label: "50万円" },
];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "score", label: "AI POWER" },
  { value: "winRate", label: "勝率" },
  { value: "expectedProfit", label: "期待利益" },
  { value: "capital", label: "必要資金" },
  { value: "change", label: "上昇率" },
  { value: "reliability", label: "信頼度" },
];

function yen(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function percent(value?: number, digits = 1) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
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

function reliabilityStars(score = 0, winRate = 0, judgedCount = 0) {
  const base =
    score * 0.45 +
    Math.min(100, winRate) * 0.35 +
    Math.min(100, judgedCount * 5) * 0.2;

  const stars = Math.max(1, Math.min(5, Math.round(base / 20)));
  return `${"★".repeat(stars)}${"☆".repeat(5 - stars)}`;
}

function normalizeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[%円,+,\s]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeStock(raw: Record<string, unknown>): Stock {
  const score = normalizeNumber(raw.score ?? raw.aiPower ?? raw.power);
  const price = normalizeNumber(raw.price ?? raw.currentPrice ?? raw.current_price);
  const changePercent = normalizeNumber(
    raw.changePercent ?? raw.change_rate ?? raw.changeRate,
  );

  const wins = normalizeNumber(raw.wins ?? raw.winCount ?? raw.win_count);
  const losses = normalizeNumber(raw.losses ?? raw.lossCount ?? raw.loss_count);
  const judgedCount = normalizeNumber(
    raw.judgedCount ??
      raw.judgementCount ??
      raw.totalJudged ??
      raw.judged_count ??
      wins + losses,
  );

  const winRate =
    normalizeNumber(raw.winRate ?? raw.winningRate ?? raw.win_rate) ||
    (judgedCount > 0 ? (wins / judgedCount) * 100 : 0);

  const takeProfit = normalizeNumber(
    raw.takeProfit ?? raw.targetPrice ?? raw.take_profit,
  );

  const expectedProfitRate =
    normalizeNumber(
      raw.expectedProfitRate ??
        raw.expectedReturn ??
        raw.expected_profit_rate,
    ) ||
    (price > 0 && takeProfit > 0 ? ((takeProfit - price) / price) * 100 : 0);

  const expectedProfitAmount =
    normalizeNumber(
      raw.expectedProfitAmount ??
        raw.expectedProfit ??
        raw.expected_profit_amount,
    ) ||
    (price > 0 && takeProfit > 0 ? (takeProfit - price) * 100 : 0);

  const reliabilityScore =
    normalizeNumber(
      raw.reliabilityScore ??
        raw.confidenceScore ??
        raw.reliability_score,
    ) ||
    Math.round(
      score * 0.45 +
        Math.min(100, winRate) * 0.35 +
        Math.min(100, judgedCount * 5) * 0.2,
    );

  return {
    code: String(raw.code ?? raw.stockCode ?? raw.symbol ?? ""),
    name: String(raw.name ?? raw.stockName ?? raw.companyName ?? "銘柄名未取得"),
    score,
    price,
    changePercent,
    rsi: normalizeNumber(raw.rsi),
    volumeRatio: normalizeNumber(raw.volumeRatio ?? raw.volume_ratio),
    reason: String(raw.reason ?? raw.comment ?? raw.aiReason ?? ""),
    takeProfit: takeProfit || undefined,
    stopLoss: normalizeNumber(raw.stopLoss ?? raw.stop_loss) || undefined,
    winRate,
    judgedCount,
    wins,
    losses,
    expectedProfitRate,
    expectedProfitAmount,
    reliabilityScore,
  };
}

export default function RankingPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [budgetMode, setBudgetMode] = useState<BudgetMode>("all");

  async function fetchRanking() {
    setLoading(true);
    setError("");

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 30_000);

      try {
        const res = await fetch("/api/scan?limit=100&top=100", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`scan api error: ${res.status}`);
        }

        const json = await res.json();

        const list = Array.isArray(json)
          ? json
          : Array.isArray(json?.stocks)
            ? json.stocks
            : Array.isArray(json?.data)
              ? json.data
              : [];

        setStocks(list.map((item: Record<string, unknown>) => normalizeStock(item)));
      } finally {
        window.clearTimeout(timeoutId);
      }
    } catch (fetchError) {
      console.error("ranking fetch error:", fetchError);
      setStocks([]);
      setError("ランキングデータを取得できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRanking();
  }, []);

  const filteredStocks = useMemo(() => {
    const budget = budgetMode === "all" ? Number.POSITIVE_INFINITY : Number(budgetMode);

    const filtered = stocks.filter((stock) => {
      const text = `${stock.code} ${stock.name}`.toLowerCase();
      const matchesKeyword = text.includes(keyword.toLowerCase());
      const capital = stock.price * 100;
      const matchesBudget = capital <= budget;

      return matchesKeyword && matchesBudget;
    });

    return [...filtered]
      .sort((a, b) => {
        if (sortMode === "winRate") {
          if ((b.winRate ?? 0) !== (a.winRate ?? 0)) {
            return (b.winRate ?? 0) - (a.winRate ?? 0);
          }
          return (b.judgedCount ?? 0) - (a.judgedCount ?? 0);
        }

        if (sortMode === "expectedProfit") {
          return (b.expectedProfitAmount ?? 0) - (a.expectedProfitAmount ?? 0);
        }

        if (sortMode === "capital") {
          return (a.price ?? 0) - (b.price ?? 0);
        }

        if (sortMode === "change") {
          return (b.changePercent ?? 0) - (a.changePercent ?? 0);
        }

        if (sortMode === "reliability") {
          return (b.reliabilityScore ?? 0) - (a.reliabilityScore ?? 0);
        }

        return (b.score ?? 0) - (a.score ?? 0);
      })
      .slice(0, 100);
  }, [stocks, keyword, sortMode, budgetMode]);

  const topStock = filteredStocks[0];

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="mb-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-2xl shadow"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.22em] text-slate-500">
              AI RANKING FINAL
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchRanking()}
            disabled={loading}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg shadow disabled:opacity-50"
          >
            ↻
          </button>
        </header>

        <section className="mb-4 rounded-[24px] border border-purple-200 bg-gradient-to-br from-white to-purple-50 p-4 shadow-sm">
          <p className="text-sm font-black text-purple-600">
            🏆 AIランキング TOP100
          </p>

          <div className="mt-2 flex items-end justify-between">
            <div>
              <h1 className="text-5xl font-black">
                {loading ? "-" : filteredStocks.length}
              </h1>
              <p className="text-sm font-bold text-slate-500">表示中の銘柄</p>
            </div>

            {topStock && (
              <div className="text-right">
                <p className="text-xs font-black text-slate-500">現在1位</p>
                <p className="text-xl font-black text-purple-600">
                  {topStock.code}
                </p>
                <p className="text-xs font-bold text-slate-500">
                  AI POWER {topStock.score}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="銘柄コード・名前で検索"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none"
          />

          <div className="mt-4">
            <p className="mb-2 text-xs font-black tracking-[0.12em] text-slate-500">
              並び替え
            </p>
            <div className="grid grid-cols-3 gap-2">
              {SORT_OPTIONS.map((option) => (
                <SortButton
                  key={option.value}
                  label={option.label}
                  active={sortMode === option.value}
                  onClick={() => setSortMode(option.value)}
                />
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-black tracking-[0.12em] text-slate-500">
              100株の予算
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {BUDGET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBudgetMode(option.value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${
                    budgetMode === option.value
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading && (
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-bold text-slate-500">
              AIランキングを読み込み中...
            </p>
          </section>
        )}

        {!loading && error && (
          <section className="mb-4 rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-center shadow-sm">
            <p className="text-3xl">⚠️</p>
            <h2 className="mt-2 text-lg font-black text-rose-700">{error}</h2>
          </section>
        )}

        {!loading && !error && filteredStocks.length === 0 && (
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="mb-3 text-4xl">🔍</p>
            <h2 className="text-xl font-black">該当銘柄なし</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">
              検索条件または予算を変更してください。
            </p>
          </section>
        )}

        {topStock && (
          <section className="mb-4 rounded-[24px] border border-yellow-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-black text-yellow-600">
              👑 本日の最有力
            </p>

            <div className="mt-3 flex items-start justify-between gap-3">
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

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Mini label="判定" value={judge(topStock.score)} />
              <Mini label="勝率" value={percent(topStock.winRate, 1)} />
              <Mini label="必要資金" value={yen(topStock.price * 100)} />
              <Mini
                label="期待利益"
                value={
                  topStock.expectedProfitAmount
                    ? yen(topStock.expectedProfitAmount)
                    : percent(topStock.expectedProfitRate, 1)
                }
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href={`/analysis/${topStock.code}`}
                className="rounded-2xl bg-blue-600 py-3 text-center font-black text-white"
              >
                AI解析
              </Link>
              <Link
                href={`/analysis/${topStock.code}/performance`}
                className="rounded-2xl border border-blue-200 bg-blue-50 py-3 text-center font-black text-blue-700"
              >
                AI実績
              </Link>
            </div>
          </section>
        )}

        <section className="space-y-3">
          {filteredStocks.map((stock, index) => (
            <article
              key={`${stock.code}-${index}`}
              className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              {stock.score >= 95 ? (
                <div className="mb-3 rounded-2xl bg-yellow-50 px-3 py-2 text-xs font-black text-yellow-700">
                  👑 TODAY BEST
                </div>
              ) : stock.score >= 85 ? (
                <div className="mb-3 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black text-red-600">
                  🔥 HOT
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-black text-white ${rankBg(
                      index,
                    )}`}
                  >
                    {index + 1}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-black text-purple-600">
                      {rankLabel(index)}
                    </p>

                    <div className="mt-1 flex items-center gap-2">
                      <h2 className="text-2xl font-black">{stock.code}</h2>
                      <span
                        className={`rounded-xl border px-2 py-1 text-xs font-black ${judgeColor(
                          stock.score,
                        )}`}
                      >
                        {judge(stock.score)}
                      </span>
                    </div>

                    <p className="truncate text-lg font-black">{stock.name}</p>

                    <p className="mt-1 truncate text-xs font-bold text-slate-500">
                      {stock.reason || "AI理由なし"}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs font-black text-slate-500">AI POWER</p>
                  <p className="text-3xl font-black text-blue-600">
                    {stock.score}
                  </p>
                  <p className="mt-1 text-xs font-black text-amber-500">
                    {reliabilityStars(
                      stock.score,
                      stock.winRate,
                      stock.judgedCount,
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Mini label="勝率" value={percent(stock.winRate, 1)} />
                <Mini
                  label="判定"
                  value={`${stock.judgedCount ?? 0}件`}
                />
                <Mini label="100株" value={yen(stock.price * 100)} />
                <Mini
                  label="期待利益"
                  value={
                    stock.expectedProfitAmount
                      ? yen(stock.expectedProfitAmount)
                      : percent(stock.expectedProfitRate, 1)
                  }
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Mini label="現在値" value={yen(stock.price)} />
                <Mini
                  label="上昇率"
                  value={percent(stock.changePercent, 1)}
                />
                <Mini
                  label="信頼度"
                  value={`${Math.round(stock.reliabilityScore ?? 0)}`}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href={`/analysis/${stock.code}`}
                  className="rounded-2xl bg-blue-600 py-3 text-center text-sm font-black text-white"
                >
                  AI解析
                </Link>
                <Link
                  href={`/analysis/${stock.code}/performance`}
                  className="rounded-2xl border border-blue-200 bg-blue-50 py-3 text-center text-sm font-black text-blue-700"
                >
                  AI実績
                </Link>
              </div>
            </article>
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
      type="button"
      onClick={onClick}
      className={`rounded-2xl py-3 text-xs font-black ${
        active
          ? "bg-purple-600 text-white"
          : "border border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className="mt-1 text-base font-black">{value}</p>
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200">
      <div className="mx-auto max-w-md grid grid-cols-5 py-2">
      <Nav href="/dashboard" icon="🏠" label="ホーム" />
      <Nav href="/today-market" icon="🤖" label="市場" />
      <Nav href="/ranking" icon="🏆" label="ランキング" active />
      <Nav href="/learning" icon="🧠" label="学習" />
      <Nav href="/favorites" icon="⭐" label="お気に入り" />
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
      className={active ? "text-center text-xs font-bold text-blue-600" : "text-center text-xs font-bold text-slate-500"}
    >
      <div className="text-2xl">{icon}</div>
      {label}
    </Link>
  );
}

