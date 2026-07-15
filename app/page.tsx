"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type HomeMarketData = {
  totalStockList: number;
  scannedCount: number;
  hotCount: number;
  strongCount: number;
  watchCount: number;
  aiPowerVersion: string;
  marketPattern: string;
};


type HomeTrustData = {
  qualityScore: number | null;
  judgedRecords: number | null;
  overallWinRate: number | null;
  activeWeightRules: number | null;
  changedCount: number | null;
  patternCount: number | null;
  cronStatus: string;
};

const initialTrustData: HomeTrustData = {
  qualityScore: null,
  judgedRecords: null,
  overallWinRate: null,
  activeWeightRules: null,
  changedCount: null,
  patternCount: null,
  cronStatus: "CHECKING",
};

const initialMarketData: HomeMarketData = {
  totalStockList: 1006,
  scannedCount: 0,
  hotCount: 0,
  strongCount: 0,
  watchCount: 0,
  aiPowerVersion: "最新",
  marketPattern: "NEUTRAL",
};

function getMarketView(pattern: string) {
  const normalized = pattern.toUpperCase();

  if (normalized.includes("BULL")) {
    return {
      badge: "🟢 強気",
      badgeClass: "bg-emerald-50 text-emerald-700",
      phoneBadgeClass: "bg-emerald-400/15 text-emerald-300",
      comment: "強気寄りの市場です。AIが優先順位を付けた今日のTOP30から確認しましょう。",
    };
  }

  if (normalized.includes("BEAR")) {
    return {
      badge: "🔴 弱気",
      badgeClass: "bg-red-50 text-red-700",
      phoneBadgeClass: "bg-red-400/15 text-red-300",
      comment: "慎重さが必要な市場です。今日のTOP30も条件を確認し、無理な追いかけは避けましょう。",
    };
  }

  return {
    badge: "🟡 中立",
    badgeClass: "bg-amber-50 text-amber-700",
    phoneBadgeClass: "bg-amber-400/15 text-amber-300",
    comment: "方向感を見極める市場です。AIが選んだ今日のTOP30から順番に確認しましょう。",
  };
}

type ApiStock = {
  code?: string | number;
  name?: string;
  score?: number;
  aiPower?: number;
  comment?: string;
  reason?: string;
  reasons?: string[];
  patternReasons?: string[];
  trend?: string;
  changePercent?: number;
  volumeRatio?: number;
};

type TopStock = {
  rank: string;
  code: string;
  name: string;
  score: number;
  label: string;
  labelClass: string;
  comment: string;
};

const rankIcons = ["🥇", "🥈", "🥉"];

function getStockLabel(score: number) {
  if (score >= 95) {
    return {
      label: "🔥 激熱候補",
      labelClass: "bg-red-50 text-red-600",
    };
  }

  if (score >= 85) {
    return {
      label: "⭐ 本命候補",
      labelClass: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "👀 注目候補",
    labelClass: "bg-blue-50 text-blue-700",
  };
}

function buildStockComment(stock: ApiStock, score: number) {
  const directComment = stock.comment?.trim() || stock.reason?.trim();
  if (directComment) return directComment;

  const reasons = [
    ...(Array.isArray(stock.reasons) ? stock.reasons : []),
    ...(Array.isArray(stock.patternReasons) ? stock.patternReasons : []),
  ].filter(Boolean);

  if (reasons.length > 0) return reasons.slice(0, 2).join("・");

  const notes: string[] = [];
  if (typeof stock.changePercent === "number") {
    notes.push(`本日変化率 ${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`);
  }
  if (typeof stock.volumeRatio === "number") {
    notes.push(`出来高 ${stock.volumeRatio.toFixed(2)}倍`);
  }
  if (stock.trend) notes.push(`トレンド ${stock.trend}`);

  if (notes.length > 0) return notes.slice(0, 2).join("・");
  return `AI POWER ${score}。詳細画面で判定理由を確認できます。`;
}

function normalizeTopStocks(stocks: ApiStock[]): TopStock[] {
  return stocks.slice(0, 3).map((stock, index) => {
    const score = Math.max(0, Math.min(100, Number(stock.score ?? stock.aiPower ?? 0)));
    const status = getStockLabel(score);

    return {
      rank: rankIcons[index] ?? `${index + 1}位`,
      code: String(stock.code ?? ""),
      name: stock.name?.trim() || "銘柄名取得中",
      score: Math.round(score),
      label: status.label,
      labelClass: status.labelClass,
      comment: buildStockComment(stock, score),
    };
  });
}


const screens = [
  {
    title: "📱 AIランキング",
    text: "AIが注目銘柄を抽出",
    image: "/images/ranking.png",
    alt: "AIランキング画面",
  },
  {
    title: "📊 AI分析",
    text: "EMA・VWAP・MACDをAIが解説",
    image: "/images/analysis.png",
    alt: "AI分析画面",
  },
  {
    title: "📈 リアルチャート",
    text: "チャートとテクニカル指標を確認",
    image: "/images/chart.png",
    alt: "リアルチャート画面",
  },
];

const problems = [
  "何を買えばいいか分からない",
  "チャートが難しい",
  "毎日1000銘柄も見られない",
  "売買判断に迷う",
];

const solutions = [
  ["🤖 AIが監視銘柄を分析","毎日多数の日本株をAIが自動でチェックします。"],
  ["📈 注目銘柄をランキング化", "スコアの高い銘柄を分かりやすく表示します。"],
  ["📊 複数指標を総合判定", "EMA・VWAP・MACD・RSIなどをAIが総合評価します。"],
  ["💬 初心者向けに解説", "難しい指標を、行動しやすい言葉で表示します。"],
];

const features = [
  ["🤖", "AI POWER", "AIが銘柄の強さをスコア化"],
  ["📈", "AIランキング", "注目銘柄をランキング表示"],
  ["📊", "テクニカル分析", "EMA・VWAP・MACD・RSIに対応"],
  ["🔔", "LINE通知", "重要な銘柄情報を通知"],
  ["📱", "スマホ対応", "毎朝スマホで確認しやすい画面"],
  ["💬", "AIコメント", "初心者向けに分かりやすく解説"],
];

const navLinks = [
  ["AIランキング", "/scan-mobile"],
  ["AI分析", "/scan-mobile"],
  ["AI実績・品質", "/trust"],
  ["AI進化", "/admin/evolution"],
];



function trustNumber(value: number | null, suffix = "") {
  if (value === null || Number.isNaN(value)) return "確認中";
  return `${Math.round(value).toLocaleString("ja-JP")}${suffix}`;
}

export default function HomePage() {
  const [topStocks, setTopStocks] = useState<TopStock[]>([]);
  const [topStocksLoading, setTopStocksLoading] = useState(true);
  const [topStocksError, setTopStocksError] = useState(false);
  const [marketData, setMarketData] = useState<HomeMarketData>(initialMarketData);
  const [trustData, setTrustData] = useState<HomeTrustData>(initialTrustData);
  const [trustLoading, setTrustLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadTopStocks() {
      try {
        const res = await fetch("/api/scan?limit=1200&top=3", { cache: "no-store" });
        if (!res.ok) throw new Error(`scan api error: ${res.status}`);

        const data = await res.json();
        const stocks = Array.isArray(data?.stocks) ? data.stocks : [];
        const normalized = normalizeTopStocks(stocks);

        if (!active) return;

        const summary = data?.notificationSummary ?? {};
        setMarketData({
          totalStockList: Number(data?.totalStockList ?? 1006),
          scannedCount: Number(data?.scannedCount ?? 0),
          hotCount: Number(summary?.hotCount ?? 0),
          strongCount: Number(summary?.strongCount ?? 0),
          watchCount: Number(summary?.watchCount ?? 0),
          aiPowerVersion: String(data?.aiPowerVersion ?? "最新"),
          marketPattern: String(data?.marketPattern ?? "NEUTRAL"),
        });
        setTopStocks(normalized);
        setTopStocksError(normalized.length === 0);
      } catch (error) {
        console.error("Home top stocks fetch failed", error);
        if (!active) return;
        setTopStocks([]);
        setTopStocksError(true);
      } finally {
        if (active) setTopStocksLoading(false);
      }
    }

    loadTopStocks();
    const timer = window.setInterval(loadTopStocks, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadTrustData() {
      try {
        const response = await fetch("/api/evolution/summary?limit=30", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Evolution summary request failed: ${response.status}`
          );
        }

        const json = await response.json();
        const latest = json?.latest ?? json?.history?.[0] ?? null;

        if (!active) return;

        setTrustData({
          qualityScore:
            typeof latest?.qualityScore === "number"
              ? latest.qualityScore
              : null,
          judgedRecords:
            typeof latest?.judgedRecords === "number"
              ? latest.judgedRecords
              : null,
          overallWinRate:
            typeof latest?.overallWinRate === "number"
              ? latest.overallWinRate
              : null,
          activeWeightRules:
            typeof latest?.activeWeightRules === "number"
              ? latest.activeWeightRules
              : null,
          changedCount:
            typeof latest?.changedCount === "number"
              ? latest.changedCount
              : null,
          patternCount:
            typeof latest?.patternCount === "number"
              ? latest.patternCount
              : null,
          cronStatus: String(latest?.cronStatus ?? "UNKNOWN"),
        });
      } catch (error) {
        console.error("home trust summary fetch error:", error);
      } finally {
        if (active) setTrustLoading(false);
      }
    }

    loadTrustData();

    return () => {
      active = false;
    };
  }, []);

  const marketView = getMarketView(marketData.marketPattern);
  const todayStats = [
    [
      marketData.totalStockList.toLocaleString(),
      "監視銘柄",
      "AIが毎日チェックする日本株",
    ],
    [
      marketData.scannedCount.toLocaleString(),
      "取得済み",
      "本日の分析完了銘柄",
    ],
    [
      "TOP30",
      "今日の激熱",
      "AIおすすめ順の上位30銘柄",
    ],
    [
      "TOP100",
      "本命候補",
      "次に確認したい上位100銘柄",
    ],
    [
      marketData.aiPowerVersion,
      "AI ENGINE",
      "最新AIエンジン",
    ],
  ];

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-950 md:pb-0">
      {/* HERO */}
      <section className="relative overflow-hidden px-5 pb-14 pt-5 text-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_36%),radial-gradient(circle_at_top_right,#dcfce7,transparent_32%),linear-gradient(180deg,#ffffff_0%,#f7f9fc_72%)]" />

        <div className="relative mx-auto max-w-6xl">
          <header className="mb-8 flex items-center justify-between rounded-full border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl">
            <Link href="/" aria-label="SIGNALX Home" className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-200">
                X
              </span>
              <span className="text-xl font-black tracking-tight">
                SIGNAL<span className="text-blue-600">X</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              {navLinks.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="rounded-full px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-100 hover:text-blue-600"
                >
                  {label}
                </Link>
              ))}
            </nav>

            <Link
              href="/login"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-300 transition hover:bg-blue-600"
            >
              Googleログイン
            </Link>
          </header>

          <div className="grid items-center gap-10 lg:grid-cols-[1.06fr_0.94fr]">
            <div className="text-center lg:text-left">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm font-black text-blue-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                SIGNALX Ver1.0 公開準備中
              </p>

              <h1 className="text-5xl font-black tracking-tight text-slate-950 md:text-7xl">
                AIの予測だけじゃない。
                <span className="mt-2 block bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
                  過去の実績まで、すべて公開。
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-8 text-slate-600 md:text-lg lg:mx-0">
                SIGNALXは、AI POWER・勝率・過去の判定実績を公開する、
                透明性重視の日本株AI分析サービスです。
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start">
                <Link
                  href="/scan-mobile"
                  className="rounded-full bg-blue-600 px-9 py-4 text-sm font-black text-white shadow-xl shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700"
                >
                  AIランキングを見る
                </Link>

                <Link
  href={topStocks.length > 0 ? `/analysis/${topStocks[0].code}` : "/scan-mobile"}
  className="rounded-full border border-slate-200 bg-white px-9 py-4 text-sm font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-600"
>
  AI分析を見る
</Link>

                <Link
                  href="/trust"
                  className="rounded-full border border-blue-200 bg-blue-50 px-9 py-4 text-sm font-black text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-100"
                >
                  🛡 AI品質を見る
                </Link>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3 rounded-[2rem] border border-white bg-white/70 p-3 shadow-sm backdrop-blur-xl">
                {todayStats.slice(0, 3).map(([num, label]) => (
                  <div key={label} className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-2xl font-black text-slate-950">{num}</p>
                    <p className="mt-1 text-xs font-black text-slate-500">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* PHONE MOCKUP */}
            <div className="mx-auto w-full max-w-sm">
              <div className="rounded-[3rem] border border-slate-200 bg-slate-950 p-3 shadow-2xl shadow-blue-200">
                <div className="rounded-[2.45rem] bg-white p-4">
                  <div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-slate-200" />

                  <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-blue-200">
                        今日のSIGNALX
                      </p>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${marketView.phoneBadgeClass}`}>
                        {marketView.badge}
                      </span>
                    </div>

                    <h2 className="mt-5 text-3xl font-black leading-tight">
                      AI市場
                      <br />
                      スキャン
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {marketView.comment}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {todayStats.slice(0, 4).map(([num, label]) => (
                      <div
                        key={label}
                        className="rounded-3xl bg-slate-50 p-4 text-center"
                      >
                        <p className="text-3xl font-black">{num}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-blue-700">
                        AI POWER ENGINE
                      </p>
                      <span className="text-xs font-black text-blue-700">
                        ACTIVE
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                      EMA / VWAP / MACD / RSI を総合判定
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TODAY */}
      <section className="px-5 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2.5rem] border border-white bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black text-blue-600">
                  TODAY'S MARKET
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                  今日のAI市場スキャン状況
                </h2>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-600">
                  {marketView.comment}
                </p>
              </div>

              <span
                className={`w-fit rounded-full px-4 py-2 text-sm font-black ${marketView.badgeClass}`}
              >
                {marketView.badge}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {todayStats.map(([num, label, caption]) => (
                <div
                  key={label}
                  className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5"
                >
                  <p className="text-4xl font-black tracking-tight text-slate-950">
                    {num}
                  </p>
                  <p className="mt-2 text-sm font-black text-slate-700">
                    {label}
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                    {caption}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/trust"
              className="mt-5 block rounded-[2rem] border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white shadow-lg shadow-blue-200">
                      🛡️
                    </div>
                    <div>
                      <p className="text-xs font-black tracking-[0.16em] text-blue-600">
                        AI TRUST CENTER
                      </p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">
                        AI品質を実データで公開
                      </h3>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
                        AI成長センターと同じ最新サマリーを表示しています。
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 text-sm font-black text-blue-600">
                    詳しく見る →
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <p className="text-xs font-black text-slate-500">AI品質</p>
                    <p className="mt-2 text-2xl font-black text-blue-700">
                      {trustLoading
                        ? "確認中"
                        : trustNumber(trustData.qualityScore, "点")}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <p className="text-xs font-black text-slate-500">
                      学習済み
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                      {trustLoading
                        ? "確認中"
                        : trustNumber(trustData.judgedRecords, "件")}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <p className="text-xs font-black text-slate-500">
                      予測的中率
                    </p>
                    <p className="mt-2 text-2xl font-black text-emerald-700">
                      {trustLoading || trustData.overallWinRate === null
                        ? "確認中"
                        : `${trustData.overallWinRate.toFixed(1)}%`}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <p className="text-xs font-black text-slate-500">
                      勝ちパターン
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                      {trustLoading
                        ? "確認中"
                        : trustNumber(trustData.activeWeightRules, "種類")}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <p className="text-xs font-black text-slate-500">
                      改善数
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                      {trustLoading
                        ? "確認中"
                        : trustNumber(trustData.changedCount, "ヶ所")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                  <span
                    className={`rounded-full px-3 py-2 ${
                      trustData.cronStatus === "SUCCESS"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {trustLoading
                      ? "自動学習を確認中"
                      : trustData.cronStatus === "SUCCESS"
                      ? "自動学習 正常"
                      : `自動学習 ${trustData.cronStatus}`}
                  </span>

                  <span className="rounded-full bg-blue-100 px-3 py-2 text-blue-700">
                    判定済みパターン{" "}
                    {trustNumber(trustData.patternCount, "件")}
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* TOP STOCKS */}
      <section className="px-5 py-12 md:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black text-blue-600">AI PICKUP</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight">
                今日のAI注目銘柄
              </h2>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600">
                AIが選んだ今日のTOP30から、上位3銘柄を表示します。
                迷ったら、この3銘柄から確認するだけでOKです。
              </p>
            </div>

            <Link
              href="/scan-mobile"
              className="w-fit rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-blue-600"
            >
              ランキング一覧へ
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {topStocksLoading &&
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`top-stock-loading-${index}`}
                  className="animate-pulse rounded-[2rem] border border-white bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-10 w-10 rounded-full bg-slate-200" />
                    <div className="h-6 w-24 rounded-full bg-slate-200" />
                  </div>
                  <div className="mt-6 h-4 w-16 rounded bg-slate-200" />
                  <div className="mt-3 h-7 w-40 rounded bg-slate-200" />
                  <div className="mt-5 h-28 rounded-[1.5rem] bg-slate-200" />
                  <div className="mt-4 h-16 rounded bg-slate-100" />
                </div>
              ))}

            {!topStocksLoading &&
              topStocks.map((stock) => (
                <div
                  key={stock.code}
                  className="rounded-[2rem] border border-white bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-4xl">{stock.rank}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${stock.labelClass}`}
                    >
                      {stock.label}
                    </span>
                  </div>

                  <p className="mt-6 text-sm font-black text-slate-500">
                    {stock.code}
                  </p>
                  <h3 className="mt-1 text-2xl font-black">{stock.name}</h3>

                  <div className="mt-5 rounded-[1.5rem] bg-slate-950 p-5 text-white">
                    <p className="text-xs font-black text-blue-300">AI POWER</p>
                    <div className="mt-2 flex items-end justify-between">
                      <p className="text-5xl font-black">{stock.score}</p>
                      <p className="pb-1 text-xs font-bold text-slate-400">
                        / 100
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm font-medium leading-7 text-slate-600">
                    {stock.comment}
                  </p>

                  <Link
                    href={`/analysis/${stock.code}`}
                    className="mt-5 inline-flex rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
                  >
                    詳しく見る
                  </Link>
                </div>
              ))}

            {!topStocksLoading && topStocksError && (
              <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-7 md:col-span-3">
                <p className="text-lg font-black text-amber-900">
                  最新ランキングを取得できませんでした
                </p>
                <p className="mt-2 text-sm font-medium leading-7 text-amber-800">
                  固定のサンプル値は表示せず、実際のAIランキングだけを表示しています。
                  ランキング画面で最新結果を確認してください。
                </p>
                <Link
                  href="/scan-mobile"
                  className="mt-5 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-blue-600"
                >
                  AIランキングを開く
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SCREEN */}
      <section className="bg-white px-5 py-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">APP PREVIEW</p>

            <h2 className="mt-2 text-4xl font-black tracking-tight">
              実際の画面イメージ
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600">
              Apple・Google Material 3を意識した、
              シンプルで見やすい画面デザイン。
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {screens.map((screen) => (
              <div
                key={screen.title}
                className="group rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="overflow-hidden rounded-[1.5rem]">
                  <Image
                    src={screen.image}
                    alt={screen.alt}
                    width={420}
                    height={820}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="h-80 w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>

                <h3 className="mt-5 text-xl font-black">
                  {screen.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {screen.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="bg-slate-50 px-5 py-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">
              INVESTOR PROBLEMS
            </p>

            <h2 className="mt-2 text-4xl font-black">
              株式投資でこんな悩みありませんか？
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {problems.map((text) => (
              <div
                key={text}
                className="rounded-[2rem] bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                  ❓
                </div>

                <p className="text-lg font-black leading-8">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="px-5 py-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">
              AI SOLUTION
            </p>

            <h2 className="mt-2 text-4xl font-black">
              SIGNALXが投資判断をサポートします
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              AIが毎営業日、監視対象銘柄を分析。
              注目銘柄を絞り込み、確認の負担を減らします。
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {solutions.map(([title, text]) => (
              <div
                key={title}
                className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <h3 className="text-2xl font-black">
                  {title}
                </h3>

                <p className="mt-4 text-sm leading-8 text-slate-600">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 px-5 py-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">
              FEATURES
            </p>

            <h2 className="mt-2 text-4xl font-black">
              SIGNALXの主な機能
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([icon, title, text]) => (
              <div
                key={title}
                className="rounded-[2rem] bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                  {icon}
                </div>

                <h3 className="mt-5 text-xl font-black">
                  {title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BETA */}
      <section className="px-5 py-12 md:py-16">
        <div className="mx-auto max-w-4xl rounded-[2.5rem] bg-slate-950 p-8 text-center text-white shadow-2xl shadow-slate-300 md:p-10">
          <p className="text-sm font-black text-blue-300">VER1.0 RELEASE</p>

          <h2 className="mt-3 text-4xl font-black tracking-tight">
           SIGNALX Ver1.0 正式リリース
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-8 text-slate-300">
            AIの予測結果だけでなく、過去の判定実績や勝率も透明に公開。
            Ver1.0正式公開に向けて、最終品質確認を進めています。
          </p>

          <Link
            href="/scan-mobile"
            className="mt-8 inline-flex rounded-full bg-white px-9 py-4 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
          >
            AIランキングを見る
          </Link>
        </div>
      </section>

      {/* PRICE */}
      <section className="bg-white px-5 py-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">PRICE</p>

            <h2 className="mt-2 text-4xl font-black">
              料金プラン
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              Ver1.0公開準備中。公開後の提供内容と料金は確定次第お知らせします。
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-black text-blue-600">現在</p>

              <h3 className="mt-3 text-5xl font-black">
                無料
              </h3>

              <p className="mt-5 text-sm leading-7 text-slate-600">
                現在は公開準備期間として無料で利用できます。
                AIランキング・AI分析・AI実績を確認できます。
              </p>

              <Link
                href="/scan-mobile"
                className="mt-7 inline-flex rounded-full bg-blue-600 px-7 py-4 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
              >
                無料ではじめる
              </Link>
            </div>

            <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-8 shadow-sm">
              <p className="text-sm font-black text-blue-700">Ver1.0公開後</p>

              <h3 className="mt-3 text-5xl font-black">
                料金は公開前に確定
              </h3>

              <p className="mt-5 text-sm leading-7 text-slate-600">
                提供機能と料金はGoogle Play公開前に最終決定します。
                公開前に品質保証と実機テストを実施します。
              </p>

              <Link
                href="/trust"
                className="mt-7 inline-flex rounded-full bg-slate-950 px-7 py-4 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-blue-600"
              >
                AI品質を見る
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 py-12 md:py-16">
        <div className="mx-auto max-w-5xl rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-emerald-500 p-8 text-center text-white shadow-2xl shadow-blue-200 md:p-12">
          <p className="text-sm font-black text-blue-100">START SIGNALX</p>

          <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight md:text-5xl">
            まずは無料で、
            <br />
            今日のAIランキングを確認。
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-sm font-bold leading-8 text-white/85">
            約1,000銘柄をAIがスキャン。
            迷ったら、まずは上位ランキングから見るだけでOKです。
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/scan-mobile"
              className="rounded-full bg-white px-10 py-4 text-sm font-black text-blue-700 shadow-lg transition hover:-translate-y-0.5"
            >
              AIランキングを見る
            </Link>

            <Link
              href="/login"
              className="rounded-full border border-white/30 bg-white/10 px-10 py-4 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
            >
              Googleログイン
            </Link>
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="px-5 pb-12">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-black text-amber-800">
            ご利用前の注意
          </h2>

          <p className="mt-3 text-sm font-medium leading-8 text-amber-900">
            SIGNALXは、投資判断をサポートするための情報提供サービスです。
            表示されるAI判定・ランキング・スコアは、将来の株価上昇や利益を保証するものではありません。
            最終的な投資判断はご自身の責任で行ってください。
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-2xl font-black">
            SIGNAL<span className="text-blue-600">X</span>
          </h2>

          <p className="mt-3 text-sm font-bold text-slate-500">
            AIが{marketData.totalStockList.toLocaleString()}銘柄を毎営業日分析する日本株AI分析サービス
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm font-bold">
            <Link
              href="/terms"
              className="text-slate-600 transition hover:text-blue-600"
            >
              利用規約
            </Link>

            <Link
              href="/privacy"
              className="text-slate-600 transition hover:text-blue-600"
            >
              プライバシーポリシー
            </Link>

            <Link
              href="/contact"
              className="text-slate-600 transition hover:text-blue-600"
            >
              お問い合わせ
            </Link>
          </div>

          <p className="mt-8 text-xs text-slate-400">
            © 2026 SIGNALX. All Rights Reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}