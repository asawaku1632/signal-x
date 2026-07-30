"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { chartPatternCatalog } from "@/app/lib/chartPatternCatalog";

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

type TrustRequestStatus = "loading" | "success" | "error";

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

const engineIndicators = [
  ["⌁", "EMA", "トレンド分析"],
  ["⌁", "VWAP", "公正価格分析"],
  ["▥", "MACD", "売買タイミング"],
  ["⌁", "RSI", "買われすぎを分析"],
  ["◇", "チャートパターン図鑑", "AIが検出するチャートの形を学ぶ"],
];

const problems = ["何を買えばいいか分からない", "チャートが難しい", "毎日1000銘柄も見られない", "売買判断に迷う"];
const solutions = [
  ["AIが監視銘柄を分析", "毎日多数の日本株をAIが自動でチェックします。"],
  ["注目銘柄をランキング化", "スコアの高い銘柄を分かりやすく表示します。"],
  ["複数指標を総合判定", "EMA・VWAP・MACD・RSIなどをAIが総合評価します。"],
  ["初心者向けに解説", "難しい指標を、行動しやすい言葉で表示します。"],
];

const features = [
  ["↗", "AI POWER", "銘柄の強さをスコア化"],
  ["☆", "AIランキング", "注目銘柄をランキング表示"],
  ["▥", "テクニカル分析", "複数指標をAIが総合判定"],
  ["◌", "LINE通知", "重要な銘柄情報をリアルタイム通知"],
  ["▯", "スマホ対応", "毎朝スマホで簡単チェック"],
  ["●", "AIコメント", "初心者にも分かりやすく解説"],
  ["⌘", "リアルチャート", "値動きと指標を確認"],
];

const navLinks = [
  ["AIランキング", "/scan-mobile"],
  ["AI分析", "/scan-mobile"],
  ["AI実績・品質", "/trust"],
  ["AI進化", "/admin/evolution"],
  ["使い方", "/dashboard"],
  ["プラン", "#price"],
];



function trustNumber(
  value: number | null,
  status: TrustRequestStatus,
  suffix = "",
) {
  if (status === "loading") return "確認中";
  if (status === "error" || value === null || Number.isNaN(value)) {
    return "取得できませんでした";
  }
  return `${Math.round(value).toLocaleString("ja-JP")}${suffix}`;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function HomePage() {
  const [topStocks, setTopStocks] = useState<TopStock[]>([]);
  const [topStocksLoading, setTopStocksLoading] = useState(true);
  const [topStocksError, setTopStocksError] = useState(false);
  const [marketData, setMarketData] = useState<HomeMarketData>(initialMarketData);
  const [trustData, setTrustData] = useState<HomeTrustData>(initialTrustData);
  const [trustStatus, setTrustStatus] = useState<TrustRequestStatus>("loading");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    function closeMenu(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", closeMenu);
    return () => window.removeEventListener("keydown", closeMenu);
  }, [menuOpen]);

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
    const controller = new AbortController();

    async function loadTrustData() {
      let settled = false;

      try {
        let latest: Record<string, unknown> | null = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const response = await fetch("/api/evolution/summary?limit=30", {
              cache: "no-store",
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error(`Evolution summary request failed: ${response.status}`);
            }

            const json = await response.json();
            const candidate = json?.latest ?? json?.history?.[0] ?? null;
            if (!json?.success || !candidate || typeof candidate !== "object") {
              throw new Error("Evolution summary response has no latest data");
            }

            latest = candidate as Record<string, unknown>;
            break;
          } catch (error) {
            if (controller.signal.aborted || attempt === 1) throw error;
          }
        }

        if (!active || !latest) return;

        setTrustData({
          qualityScore: nullableNumber(latest.qualityScore),
          judgedRecords: nullableNumber(latest.judgedRecords),
          overallWinRate: nullableNumber(latest.overallWinRate),
          activeWeightRules: nullableNumber(latest.activeWeightRules),
          changedCount: nullableNumber(latest.changedCount),
          patternCount: nullableNumber(latest.patternCount),
          cronStatus: String(latest.cronStatus ?? "UNKNOWN"),
        });
        setTrustStatus("success");
        settled = true;
      } catch {
        if (active && !controller.signal.aborted) {
          setTrustStatus("error");
          settled = true;
        }
      } finally {
        if (active && !controller.signal.aborted && !settled) setTrustStatus("error");
      }
    }

    loadTrustData();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const marketView = getMarketView(marketData.marketPattern);
  const todayStats = [
    [
      "◆",
      topStocksLoading ? null : marketData.scannedCount,
      "銘柄分析済み",
      "本日のAIスキャン結果",
      "text-blue-600 bg-blue-50",
    ],
    [
      "↗",
      topStocksLoading ? null : marketData.hotCount,
      "激熱銘柄",
      "AI判定の最上位候補",
      "text-orange-600 bg-orange-50",
    ],
    [
      "★",
      topStocksLoading ? null : marketData.strongCount,
      "本命銘柄",
      "強いシグナルを検出",
      "text-amber-600 bg-amber-50",
    ],
    [
      "◕",
      topStocksLoading || topStocksError ? null : marketView.badge.replace(/^[^\s]+\s/, ""),
      "AI市場",
      marketView.comment,
      "text-indigo-600 bg-indigo-50",
    ],
    [
      "✓",
      topStocksLoading || topStocksError ? null : marketData.aiPowerVersion,
      "AIエンジン",
      "スキャンAPI稼働中",
      "text-emerald-600 bg-emerald-50",
    ],
  ];

  return (
    <main className="lp-page min-h-screen overflow-x-clip bg-[#f7f9fc] text-slate-950">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-blue-100 bg-white text-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_36%,rgba(37,99,235,0.18),transparent_31%),linear-gradient(105deg,#ffffff_0%,#ffffff_44%,#edf5ff_75%,#dbeafe_100%)]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[78%] w-[58%] opacity-45 [background-image:linear-gradient(rgba(59,130,246,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.12)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_top,black,transparent)]" />
        <div className="pointer-events-none absolute bottom-0 left-[38%] right-0 h-52 opacity-50 [background:linear-gradient(153deg,transparent_0_42%,rgba(37,99,235,.24)_42.3%_42.8%,transparent_43.1%_100%),linear-gradient(165deg,transparent_0_55%,rgba(14,165,233,.2)_55.3%_55.8%,transparent_56.1%_100%)]" />

        <header className="relative z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[64px] max-w-[1180px] items-center justify-between gap-2 px-4 sm:px-5">
            <Link href="/" aria-label="SIGNALX ホーム" className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg">
              <span className="relative block h-8 w-8" aria-hidden="true">
                <span className="absolute left-[13px] top-0 h-8 w-2 -rotate-45 rounded-sm bg-gradient-to-b from-cyan-400 to-blue-700" />
                <span className="absolute left-[13px] top-0 h-8 w-2 rotate-45 rounded-sm bg-gradient-to-b from-blue-700 to-cyan-400" />
              </span>
              <span className="text-lg font-black tracking-[0.04em] text-[#071a3d] sm:text-[22px]">SIGNALX</span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex" aria-label="メインナビゲーション">
              {navLinks.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-[13px] font-bold text-[#0b1c3b] transition hover:bg-blue-50 hover:text-blue-600"
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#10203f] shadow-sm transition hover:border-blue-400 hover:bg-blue-50 sm:px-5 sm:text-sm"
              >
                <span className="text-base font-black text-[#4285f4]" aria-hidden="true">G</span>
                <span className="hidden sm:inline">Googleでログイン</span>
                <span className="sm:hidden">無料ではじめる</span>
              </Link>
              <button
                type="button"
                aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
                aria-controls="mobile-navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="relative grid h-11 w-11 place-items-center rounded-xl text-[#071a3d] transition hover:bg-blue-50 lg:hidden"
              >
                <span className="relative h-5 w-5" aria-hidden="true">
                  <span className={`absolute left-0 top-0.5 h-0.5 w-5 rounded bg-current transition duration-300 ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
                  <span className={`absolute left-0 top-2.5 h-0.5 w-5 rounded bg-current transition duration-300 ${menuOpen ? "opacity-0" : ""}`} />
                  <span className={`absolute left-0 top-[18px] h-0.5 w-5 rounded bg-current transition duration-300 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
                </span>
              </button>
            </div>
          </div>
          <nav
            id="mobile-navigation"
            aria-label="スマートフォン用メインナビゲーション"
            className={`mobile-menu absolute inset-x-0 top-full border-b border-slate-200 bg-white/98 px-4 shadow-xl lg:hidden ${menuOpen ? "mobile-menu-open" : ""}`}
          >
            <div className="mx-auto grid max-w-[1180px] py-2">
              {navLinks.map(([label, href]) => (
                <Link key={label} href={href} onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-bold text-[#0b1c3b] hover:bg-blue-50 hover:text-blue-700">
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </header>

        <div className="relative mx-auto grid max-w-[1180px] items-center gap-7 px-4 pb-8 pt-7 sm:px-5 sm:pb-12 sm:pt-8 lg:min-h-[470px] lg:grid-cols-[1.03fr_0.9fr_0.62fr] lg:gap-5 lg:pb-0 lg:pt-7">
          <div className="hero-fade-up relative z-20 text-center lg:self-start lg:pt-3 lg:text-left">
              <p className="mb-5 inline-flex items-center rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-lg shadow-blue-200">
                SIGNALX Ver1.0 公開準備中
              </p>

              <h1 className="text-[clamp(2.15rem,10.2vw,2.75rem)] font-black leading-[1.12] tracking-[-0.04em] text-[#071a3d] sm:text-6xl lg:text-[55px]">
                <span className="whitespace-nowrap">約{marketData.totalStockList.toLocaleString("ja-JP")}銘柄を</span>
                <span className="mt-1 block text-blue-600">
                  AIが毎営業日分析
                </span>
              </h1>

              <p className="mx-auto mt-5 max-w-lg text-base font-bold leading-7 text-[#172640] lg:mx-0">
                ランキングを見るだけで注目銘柄が分かる。
                <br />
                AIの予測だけじゃない。過去の実績まで、すべて公開。
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
                {["AI POWER", "過去実績", "AI品質"].map((label, index) => (
                  <span key={label} className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white/90 px-3 py-2 text-xs font-extrabold text-[#172640] shadow-sm">
                    <span className="text-blue-600" aria-hidden="true">{index === 0 ? "◆" : index === 1 ? "▥" : "♢"}</span>
                    {label}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href="/scan-mobile"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-7 py-3 text-sm font-black text-white shadow-xl shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 sm:w-auto"
                >
                  AIランキングを見る <span aria-hidden="true">→</span>
                </Link>

                <Link
                  href="/login"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-blue-500 bg-white px-7 py-3 text-sm font-black text-blue-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50 active:translate-y-0 sm:w-auto"
                >
                  無料ではじめる
                </Link>
              </div>

              <p className="mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-500 lg:justify-start">
                <span className="text-blue-600" aria-hidden="true">♢</span>
                投資判断をサポートする情報提供サービスです
              </p>
          </div>

          {/* PHONE MOCKUP */}
          <div className="hero-fade-up hero-delay-1 relative z-10 mx-auto h-[390px] w-full max-w-[300px] sm:h-[430px] sm:max-w-[330px] lg:-mb-20 lg:ml-[-12px] lg:rotate-[5deg]">
            <div className="absolute inset-x-3 top-0 rounded-[44px] border-[7px] border-[#101216] bg-[#101216] p-1.5 shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
              <div className="h-[410px] overflow-hidden rounded-[34px] bg-[#f8fafc] sm:h-[456px]">
                <div className="relative flex h-8 items-center justify-between px-5 text-[9px] font-black text-slate-950">
                  <span>9:31</span>
                  <span className="absolute left-1/2 top-1 h-5 w-[78px] -translate-x-1/2 rounded-full bg-black" />
                  <span>▮ ●</span>
                </div>
                <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4">
                  <span className="font-black text-blue-600">X <span className="ml-1 text-xs tracking-wide text-slate-950">SIGNALX</span></span>
                  <span className="text-sm">⌕　♧</span>
                </div>
                <div className="p-3.5">
                  <h2 className="text-sm font-black text-[#071a3d]">AIランキング</h2>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-500">今日の注目銘柄 TOP3</p>
                  <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {topStocksLoading && [0, 1, 2].map((item) => (
                      <div key={item} className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-3 last:border-0">
                        <span className="h-7 w-7 animate-pulse rounded-full bg-slate-200" />
                        <span className="h-3 flex-1 animate-pulse rounded bg-slate-200" />
                      </div>
                    ))}
                    {!topStocksLoading && topStocks.map((stock, index) => (
                      <Link key={stock.code} href={`/analysis/${stock.code}`} className="flex h-[76px] items-center gap-2.5 border-b border-slate-100 px-3 transition hover:bg-blue-50 last:border-0">
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-white ${index === 0 ? "bg-amber-400" : index === 1 ? "bg-slate-400" : "bg-amber-700"}`}>{index + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-black text-slate-500">{stock.code}</span>
                          <span className="block truncate text-[11px] font-black text-slate-950">{stock.name}</span>
                          <span className="text-[8px] font-bold text-slate-400">AI POWER</span>
                        </span>
                        <span className="text-right">
                          <span className="block text-lg font-black text-[#071a3d]">{stock.score}</span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-black text-emerald-600">{stock.label}</span>
                        </span>
                      </Link>
                    ))}
                    {!topStocksLoading && topStocksError && (
                      <div className="p-8 text-center text-xs font-bold text-slate-500">ランキングを取得できませんでした</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI QUALITY */}
          <aside className="hero-fade-up hero-delay-2 relative z-20 mx-auto w-full max-w-[330px] lg:max-w-[250px] lg:self-center lg:pb-10">
            <div className="text-center">
              <div className="mx-auto flex h-[164px] w-[164px] flex-col items-center justify-center rounded-full border border-white/80 bg-white/70 shadow-[0_20px_50px_rgba(37,99,235,0.16)] backdrop-blur-sm sm:h-[190px] sm:w-[190px]">
                <p className="text-lg font-black text-[#172640]">AI品質</p>
                <p className="mt-1 text-[52px] font-black leading-none text-[#071a3d]">
                  {trustStatus === "success" && trustData.qualityScore !== null ? (
                    <>{Math.round(trustData.qualityScore)}<span className="text-lg">点</span></>
                  ) : (
                    <span className="block max-w-36 text-base leading-6">
                      {trustStatus === "loading" ? "確認中" : "取得できませんでした"}
                    </span>
                  )}
                </p>
                <p className="mt-2 tracking-[0.12em] text-amber-400" aria-label="最高評価">★★★★★</p>
              </div>
            </div>
            <Link href="/trust" className="mt-3 block rounded-2xl border border-white/90 bg-white/80 p-4 shadow-[0_16px_40px_rgba(30,64,175,0.13)] backdrop-blur-xl transition hover:-translate-y-0.5">
              <dl className="space-y-3 text-xs font-bold text-[#172640]">
                <div className="flex items-center justify-between gap-2 border-b border-blue-100 pb-2"><dt>学習件数</dt><dd className="text-right text-sm font-black">{trustNumber(trustData.judgedRecords, trustStatus, "件")}</dd></div>
                <div className="flex items-center justify-between gap-2 border-b border-blue-100 pb-2"><dt>累計勝率</dt><dd className="text-right text-sm font-black">{trustNumber(trustData.overallWinRate, trustStatus, "%")}</dd></div>
                <div className="flex items-center justify-between gap-2"><dt>改善候補数</dt><dd className="text-right text-sm font-black">{trustNumber(trustData.changedCount, trustStatus, "件")}</dd></div>
              </dl>
              <p className="mt-3 text-center text-xs font-black text-emerald-600">♢ 品質保証済</p>
            </Link>
          </aside>
        </div>
      </section>

      {/* PHASE 2: TODAY / TRUST / PICKUP */}
      <section className="px-4 py-4 sm:px-5 md:py-6">
        <div className="mx-auto max-w-[1180px] space-y-4">
          <section aria-labelledby="today-summary-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <h2 id="today-summary-title" className="mb-3 text-sm font-black text-[#0b1c3b]">本日のAI分析サマリー</h2>
            {topStocksError && !topStocksLoading ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">本日の分析データを取得できませんでした。</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
                {todayStats.map(([icon, value, label, caption, colorClass], index) => (
                  <article key={String(label)} className={`flex min-h-32 min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md ${index === todayStats.length - 1 ? "col-span-2 md:col-span-1" : ""}`}>
                    <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base font-black sm:h-10 sm:w-10 sm:text-lg ${colorClass}`} aria-hidden="true">{icon}</span>
                      <div className="min-w-0">
                        <p className="min-h-6 whitespace-nowrap text-xl font-black leading-tight text-[#071a3d]">
                          {value === null ? <span className="inline-block h-5 w-14 animate-pulse rounded bg-slate-200" /> : typeof value === "number" ? value.toLocaleString("ja-JP") : value}
                        </p>
                        <p className="mt-0.5 text-xs font-black text-slate-700">{label}</p>
                      </div>
                    </div>
                    <p className="mt-auto line-clamp-3 pt-2 text-[11px] font-semibold leading-4 text-slate-500">{caption}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <section aria-labelledby="trust-center-title" className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-sm font-black text-white" aria-hidden="true">✓</span>
                  <h2 id="trust-center-title" className="text-sm font-black tracking-wide text-[#0b1c3b]">AI TRUST CENTER</h2>
                </div>
                <span className="text-[11px] font-black text-blue-700">AI品質を実データで公開</span>
              </div>

              <dl className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 sm:grid-cols-5">
                {[
                  ["AI品質", trustData.qualityScore, "点"],
                  ["学習件数", trustData.judgedRecords, "件"],
                  ["累計勝率", trustData.overallWinRate, "%"],
                  ["勝ちパターン", trustData.activeWeightRules, "種類"],
                  ["改善候補数", trustData.changedCount, "件"],
                ].map(([label, value, suffix], index) => (
                  <div key={String(label)} className={`min-w-0 border-b border-r border-slate-200 p-3 last:border-r-0 sm:border-b-0 ${index === 4 ? "col-span-2 sm:col-span-1" : ""} ${index < 3 ? "bg-blue-50/40" : ""}`}>
                    <dt className="text-[11px] font-black text-slate-600">{label}</dt>
                    <dd className="mt-2 whitespace-nowrap text-xl font-black text-[#071a3d]">
                      {trustStatus === "loading" ? "確認中" : trustStatus === "error" || value === null ? <span className="whitespace-normal text-xs leading-4">取得できませんでした</span> : `${Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}${suffix}`}
                    </dd>
                  </div>
                ))}
              </dl>

              {trustStatus === "loading" && <p className="mt-3 text-[10px] font-black text-slate-500">自動学習 確認中</p>}
              {trustStatus === "error" && <p className="mt-3 text-[10px] font-black text-amber-700">自動学習 確認できませんでした</p>}
              {trustStatus === "success" && [trustData.cronStatus, trustData.patternCount].some((value) => value !== null) && (
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black">
                  {trustData.cronStatus !== "UNKNOWN" && (
                    <span className={`inline-flex min-h-11 items-center rounded-lg px-3 py-2 ${trustData.cronStatus === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      自動学習 {trustData.cronStatus === "SUCCESS" ? "正常" : trustData.cronStatus}
                    </span>
                  )}
                  {trustData.patternCount !== null && <span className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg bg-slate-100 px-3 py-2 text-slate-700">判定済みパターン {trustData.patternCount.toLocaleString("ja-JP")}件</span>}
                </div>
              )}

              <Link href="/trust" className="mt-auto flex min-h-11 items-center justify-center pt-3 text-center text-xs font-black text-blue-700 transition hover:text-blue-900">AI品質を詳しく見る　→</Link>
            </section>

            <section aria-labelledby="ai-pickup-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-sm font-black text-white" aria-hidden="true">◆</span>
                  <h2 id="ai-pickup-title" className="text-sm font-black tracking-wide text-[#0b1c3b]">AI PICKUP</h2>
                  <span className="hidden text-[11px] font-black text-blue-600 sm:inline">今日のAI注目銘柄 TOP3</span>
                </div>
                <Link href="/scan-mobile?budget=all" className="flex min-h-11 shrink-0 items-center text-[11px] font-black text-blue-700 transition hover:text-blue-900">ランキング一覧へ　→</Link>
              </div>

              <div className="mt-3 grid gap-2.5 md:grid-cols-3">
                {topStocksLoading && Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
                ))}
                {!topStocksLoading && topStocks.map((stock, index) => (
                  <Link key={stock.code} href={`/analysis/${stock.code}`} className="group flex min-h-44 min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:translate-y-0 md:p-3">
                    <div className="flex items-start gap-2">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-white ${index === 0 ? "bg-amber-400" : index === 1 ? "bg-slate-400" : "bg-amber-700"}`}>{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-500">{stock.code}</p>
                        <h3 className="truncate text-sm font-black text-[#071a3d] md:text-xs">{stock.name}</h3>
                      </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3">
                      <span className="text-[9px] font-black text-slate-500">AI POWER</span>
                      <span className="text-3xl font-black leading-none text-emerald-600">{stock.score}</span>
                    </div>
                    <div className="mt-2 min-h-0">
                      <p className="ai-pickup-comment text-xs font-semibold leading-4 text-slate-600 md:text-[10px]">{stock.comment}</p>
                    </div>
                    <span className={`rounded-md px-2 py-1 text-center text-[10px] font-black ${stock.labelClass}`}>{stock.label}</span>
                    <span className="mt-auto flex min-h-11 items-end text-xs font-black text-blue-700 group-hover:text-blue-900 md:min-h-0 md:text-[10px]">詳細を見る　→</span>
                  </Link>
                ))}
                {!topStocksLoading && topStocksError && (
                  <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800 sm:col-span-3">本日のランキングデータを取得できませんでした。</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>

      {/* PHASE 3: AI ENGINE / FEATURES */}
      <section className="px-4 pb-4 pt-0 sm:px-5 md:pb-5">
        <div className="mx-auto grid max-w-[1180px] gap-4 lg:grid-cols-[0.78fr_1.22fr]">
          <section aria-labelledby="ai-engine-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1"><h2 id="ai-engine-title" className="text-sm font-black tracking-wide text-[#0b1c3b]">AI ENGINE</h2><p className="text-[11px] font-black text-blue-600">AIが複数指標を総合判定</p></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {engineIndicators.map(([icon, title, text], index) => {
                const isPatternCatalog = index === engineIndicators.length - 1;
                const cardClassName = `flex min-h-32 min-w-0 flex-col items-center justify-center rounded-xl border bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md ${
                  isPatternCatalog
                    ? "col-span-2 border-blue-300 bg-blue-50/60 sm:col-span-1"
                    : "border-slate-200"
                }`;
                const content = (
                  <>
                    <span aria-hidden="true" className="grid h-9 w-9 place-items-center text-2xl font-black text-blue-600">
                      {icon}
                    </span>
                    <h3 className="mt-1 break-words text-xs font-black leading-tight text-[#071a3d]">
                      {title}
                    </h3>
                    <p className="mt-2 break-words text-[11px] font-semibold leading-4 text-slate-600">
                      {text}
                    </p>
                  </>
                );

                if (isPatternCatalog) {
                  return (
                    <Link
                      key={title}
                      href="/learning/patterns"
                      aria-label={`チャートパターン図鑑を見る・${chartPatternCatalog.length}パターン対応`}
                      className={cardClassName}
                    >
                      {content}
                      <span className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-2 text-[10px] font-black text-blue-700 shadow-sm">
                        {chartPatternCatalog.length}パターン対応&nbsp;→
                      </span>
                    </Link>
                  );
                }

                return (
                  <article key={title} className={cardClassName}>
                    {content}
                  </article>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] font-semibold leading-4 text-slate-600">複数のテクニカル指標とチャートパターンをAIが総合的に分析します。</p>
          </section>
          <section aria-labelledby="features-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1"><h2 id="features-title" className="text-sm font-black tracking-wide text-[#0b1c3b]">FEATURES</h2><p className="text-[11px] font-black text-blue-600">SIGNALXの主な機能</p></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{features.map(([icon, title, text], index) => <article key={title} className="flex min-h-36 flex-col items-center rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><span aria-hidden="true" className={`grid h-10 w-10 place-items-center text-2xl font-black ${index === 1 ? "text-amber-500" : index === 3 ? "text-emerald-600" : "text-blue-600"}`}>{icon}</span><h3 className="mt-1 text-xs font-black leading-tight text-[#071a3d]">{title}</h3><p className="mt-2 text-[11px] font-semibold leading-4 text-slate-600">{text}</p></article>)}</div>
          </section>
        </div>
      </section>

      {/* PHASE 3: APP PREVIEW / START SIGNALX */}
      <section className="px-4 pb-5 sm:px-5">
        <div className="mx-auto grid max-w-[1180px] gap-4 lg:grid-cols-[1.18fr_1fr_0.8fr]">
          <section aria-labelledby="app-preview-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1"><h2 id="app-preview-title" className="text-sm font-black tracking-wide text-[#0b1c3b]">APP PREVIEW</h2><p className="text-[11px] font-black text-blue-600">実際の画面イメージ</p></div>
            <div className="app-preview-track mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">{screens.map((screen, index) => <article key={screen.title} className="w-[78%] shrink-0 snap-center text-center first:snap-start last:snap-end sm:w-auto sm:min-w-0"><div className="overflow-hidden rounded-t-[1.35rem] border border-b-0 border-slate-200 bg-slate-50"><Image src={screen.image} alt={screen.alt} width={420} height={820} sizes="(max-width: 639px) 78vw, (max-width: 1024px) 30vw, 140px" className="h-auto max-h-[28rem] w-full object-cover object-top sm:h-56" /></div><h3 className="mt-2 text-xs font-black text-[#071a3d]">{index + 1} / {screens.length}　{screen.title.replace(/^\S+\s/, "")}</h3><p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-slate-600">{screen.text}</p></article>)}</div>
          </section>
          <section aria-labelledby="release-title" className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50 via-white to-white p-5 text-center shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="absolute inset-x-16 top-0 h-24 rounded-full bg-blue-200/30 blur-3xl" aria-hidden="true" /><p className="relative mx-auto w-fit bg-gradient-to-r from-amber-400 to-yellow-300 px-6 py-1.5 text-[11px] font-black text-[#3f2c00] shadow-md">Google Play公開記念　★</p><h2 id="release-title" className="relative mt-3 text-xl font-black text-[#071a3d]">Ver1.0</h2><p className="relative mt-1 text-4xl font-black tracking-tight text-blue-600">完全無料</p><p className="relative mt-2 text-sm font-black text-[#071a3d]">すべての機能を無料開放</p>
            <div className="relative mt-5 grid grid-cols-5 gap-2">{features.slice(0, 5).map(([icon, title]) => <div key={title} className="min-w-0"><span aria-hidden="true" className="mx-auto grid h-10 w-10 max-w-full place-items-center rounded-xl border border-blue-100 bg-white text-lg font-black text-blue-600 shadow-sm">{icon}</span><p className="mt-2 truncate text-[9px] font-black text-slate-600">{title}</p></div>)}</div><p className="relative mt-5 text-[11px] font-bold text-slate-600">※ 将来プレミアム機能追加予定</p>
          </section>
          <section aria-labelledby="start-signalx-title" className="flex flex-col rounded-2xl border border-blue-300 bg-gradient-to-b from-blue-50 to-white p-5 shadow-[0_12px_36px_rgba(37,99,235,0.12)]">
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-black text-blue-700">START SIGNALX</p><span className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-black text-white">無料・Ver1.0</span></div><h2 id="start-signalx-title" className="mt-3 text-xl font-black leading-8 text-[#071a3d]">まずは無料で、<br />今日のAIランキングを確認。</h2><p className="mt-2 text-xs font-semibold leading-5 text-slate-600">約{marketData.totalStockList.toLocaleString("ja-JP")}銘柄をAIがスキャン。<br />迷ったら、まずは上位ランキングから見るだけでOKです。</p>
            <div className="mt-5 space-y-3"><Link href="/scan-mobile" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">AIランキングを見る　→</Link><Link href="/login" className="flex min-h-12 w-full items-center justify-center rounded-xl border border-blue-500 bg-white px-4 text-sm font-black text-[#071a3d] transition hover:-translate-y-0.5 hover:bg-blue-50 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><span aria-hidden="true" className="mr-2 text-base text-blue-600">G</span>Googleでログイン</Link></div>
            <div className="mt-5 border-t border-slate-200 pt-4"><p className="text-[11px] font-black text-slate-700">▣ ご利用前の注意</p><p className="mt-1 text-[10px] font-medium leading-4 text-slate-600">SIGNALXは、投資判断をサポートするための情報提供サービスです。ランキング・スコアは将来の成果を保証するものではありません。最終的な投資判断はご自身の責任で行ってください。</p></div>
          </section>
        </div>
      </section>

      <div className="hidden" aria-hidden="true">
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

      </div>
      {/* FOOTER */}
      <footer className="mt-3 border-t border-slate-300 bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-black">
            SIGNAL<span className="text-blue-600">X</span>
          </h2>

          <p className="mt-3 text-sm font-bold text-slate-500">
            AIが{marketData.totalStockList.toLocaleString()}銘柄を毎営業日分析する日本株AI分析サービス
          </p>

          <nav aria-label="フッターナビゲーション" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold">
            <Link
              href="/terms"
              className="inline-flex min-h-11 items-center px-1 text-slate-600 transition hover:text-blue-700"
            >
              利用規約
            </Link>

            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center px-1 text-slate-600 transition hover:text-blue-700"
            >
              プライバシーポリシー
            </Link>

            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center px-1 text-slate-600 transition hover:text-blue-700"
            >
              お問い合わせ
            </Link>
          </nav>

          <p className="mt-8 text-xs text-slate-400">
            © 2026 SIGNALX. All Rights Reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
