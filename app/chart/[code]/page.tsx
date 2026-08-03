"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import TradingChart from "./components/TradingChart";
import ActionCard from "./components/ActionCard";
import ChartHeader from "./components/ChartHeader";
import SupportResistanceCard from "./components/SupportResistanceCard";
import AnalysisCard from "./components/AnalysisCard";
import AIAdviceCard from "./components/AIAdviceCard";
import AICommentCard from "./components/AICommentCard";
import AIPredictionCard from "./components/AIPredictionCard";
import { buildAIAdvice, getAIAdviceImportance } from "./aiAdvice";

type SupportResistanceStatus =
  | "BREAKOUT"
  | "NEAR_RESISTANCE"
  | "NEAR_SUPPORT"
  | "BETWEEN_LEVELS"
  | "BREAKDOWN_RISK"
  | "NO_DATA";

type CommentTone = "green" | "red" | "blue" | "amber" | "slate";

type Timeframe = "5m" | "15m" | "1H" | "1D" | "1W" | "1M";

const TIMEFRAMES: Array<{ value: Timeframe; label: string }> = [
  { value: "5m", label: "5分" },
  { value: "15m", label: "15分" },
  { value: "1H", label: "1時間" },
  { value: "1D", label: "日足" },
  { value: "1W", label: "週足" },
  { value: "1M", label: "月足" },
];

type Stock = {
  code: string;
  name: string;
  price: number;
  score?: number;
  aiPower?: number;
  changePercent?: number;
  rsi?: number;
  volumeRatio?: number;
  takeProfit?: number;
  stopLoss?: number;
  reason?: string;
  supportPrice?: number | null;
  resistancePrice?: number | null;
  supportDistancePercent?: number | null;
  resistanceDistancePercent?: number | null;
  supportResistanceStatus?: SupportResistanceStatus;
  breakoutExpectation?: number;
};

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type ChartApi = {
  success: boolean;
  currentPrice: number | null;
  ma20: number | null;
  ema20: number | null;
  ema75: number | null;
  vwap: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  trend: string;
  candleSignal: string;
  patternSignal: string;
  patternScore: number;
  patternReasons: string[];
  supportPrice: number | null;
  resistancePrice: number | null;
  supportDistancePercent: number | null;
  resistanceDistancePercent: number | null;
  supportResistanceStatus: SupportResistanceStatus;
  breakoutExpectation: number;
  candles: Candle[];
};

function yen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function signedYen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString()}円`;
}

function getPower(stock: Stock | null) {
  return stock?.score ?? stock?.aiPower ?? 0;
}

function getJudge(power: number, trend: string) {
  if (power >= 95) return "大本命";
  if (power >= 85) return trend === "DOWNTREND" ? "押し目候補" : "買い候補";
  if (power >= 75) return "押し目待ち";
  if (power >= 65) return "様子見";
  return "見送り";
}

function getJudgeClass(power: number) {
  if (power >= 95) return "border-yellow-300 bg-yellow-100 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300";
  if (power >= 85) {
    return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (power >= 75) return "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (power >= 65) return "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
}

function getTrendText(trend: string) {
  if (trend === "UPTREND") return "上昇トレンド";
  if (trend === "DOWNTREND") return "下降トレンド";
  return "横ばい";
}

function getTrendIcon(trend: string) {
  if (trend === "UPTREND") return "↗";
  if (trend === "DOWNTREND") return "↘";
  return "→";
}

function getTrendClass(trend: string) {
  if (trend === "UPTREND") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (trend === "DOWNTREND") {
    return "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300";
  }
  return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

function getPatternText(pattern: string) {
  if (pattern === "W_BOTTOM_BREAK") return "Wボトム突破";
  if (pattern === "W_BOTTOM") return "Wボトム候補";
  if (pattern === "NONE") return "通常";
  return pattern;
}

function getSupportResistanceLabel(status: SupportResistanceStatus) {
  if (status === "BREAKOUT") return "抵抗線を突破";
  if (status === "NEAR_RESISTANCE") return "抵抗線付近";
  if (status === "NEAR_SUPPORT") return "支持線付近";
  if (status === "BREAKDOWN_RISK") return "支持線割れ注意";
  if (status === "BETWEEN_LEVELS") return "支持線と抵抗線の間";
  return "判定データなし";
}

function getSupportResistanceComment(
  status: SupportResistanceStatus,
  breakoutExpectation: number,
) {
  if (status === "BREAKOUT") {
    return `抵抗線を上抜けています。ブレイク期待度は${breakoutExpectation}%です。出来高を伴って上昇が続くか確認しましょう。`;
  }
  if (status === "NEAR_RESISTANCE") {
    return `抵抗線が近いため、高値追いには注意が必要です。ブレイク期待度は${breakoutExpectation}%です。`;
  }
  if (status === "NEAR_SUPPORT") {
    return `支持線付近です。反発を確認してから判断しましょう。ブレイク期待度は${breakoutExpectation}%です。`;
  }
  if (status === "BREAKDOWN_RISK") {
    return `支持線割れに注意が必要です。損切ラインを意識しましょう。ブレイク期待度は${breakoutExpectation}%です。`;
  }
  if (status === "NO_DATA") {
    return "支持線・抵抗線を判定できるだけの価格データがありません。";
  }
  return `現在値は支持線と抵抗線の間です。ブレイク期待度は${breakoutExpectation}%です。`;
}

function buildCommentItems({
  chart,
  takeProfitMoney,
  stopLossMoney,
  requiredMoney,
}: {
  chart: ChartApi;
  takeProfitMoney: number;
  stopLossMoney: number;
  requiredMoney: number;
}) {
  const items: Array<{ icon: string; text: string; tone: CommentTone }> = [];

  items.push({
    icon:
      chart.trend === "UPTREND"
        ? "🟢"
        : chart.trend === "DOWNTREND"
          ? "🔴"
          : "🟡",
    text: `現在は${getTrendText(chart.trend)}です。`,
    tone:
      chart.trend === "UPTREND"
        ? "green"
        : chart.trend === "DOWNTREND"
          ? "red"
          : "amber",
  });

  for (const reason of chart.patternReasons) {
    items.push({
      icon: reason.includes("MA20") ? "🔵" : "📊",
      text: reason,
      tone: reason.includes("MA20") ? "blue" : "slate",
    });
  }

  items.push({
    icon: "🟡",
    text: `ブレイク期待度は${chart.breakoutExpectation}%です。`,
    tone: "amber",
  });

  items.push({
    icon: "🎯",
    text: `100株の利益目安は${signedYen(takeProfitMoney)}です。`,
    tone: "green",
  });

  items.push({
    icon: "💸",
    text: `100株の損失目安は${signedYen(stopLossMoney)}です。`,
    tone: "red",
  });

  items.push({
    icon: "💰",
    text: `必要資金は${yen(requiredMoney)}です。`,
    tone: "blue",
  });

  return items;
}

export default function ChartPage() {
  const params = useParams();
  const code = String(params.code);

  const [stock, setStock] = useState<Stock | null>(null);
  const [chart, setChart] = useState<ChartApi | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [stockLoading, setStockLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [showScrollCue, setShowScrollCue] = useState(true);

  useEffect(() => {
    const updateScrollCue = () => setShowScrollCue(window.scrollY <= 12);

    updateScrollCue();
    window.addEventListener("scroll", updateScrollCue, { passive: true });

    return () => window.removeEventListener("scroll", updateScrollCue);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadStock = async () => {
      setStockLoading(true);

      try {
        const scanRes = await fetch("/api/scan?limit=1000", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!scanRes.ok) {
          throw new Error(`scan api error: ${scanRes.status}`);
        }

        const scanData = await scanRes.json();
        const stocks: Stock[] = Array.isArray(scanData)
          ? scanData
          : Array.isArray(scanData.stocks)
            ? scanData.stocks
            : [];

        const found = stocks.find((item) => String(item.code) === code);

        setStock(found ?? null);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("stock data error:", error);
      } finally {
        if (!controller.signal.aborted) {
          setStockLoading(false);
        }
      }
    };

    loadStock();

    return () => controller.abort();
  }, [code]);

  useEffect(() => {
    const controller = new AbortController();

    const loadChart = async () => {
      setChartLoading(true);

      try {
        const chartRes = await fetch(`/api/chart/${code}?tf=${timeframe}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!chartRes.ok) {
          throw new Error(`chart api error: ${chartRes.status}`);
        }

        const chartData: ChartApi = await chartRes.json();
        setChart(chartData);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("chart data error:", error);
      } finally {
        if (!controller.signal.aborted) {
          setChartLoading(false);
        }
      }
    };

    loadChart();

    return () => controller.abort();
  }, [code, timeframe]);

  if (stockLoading || (chartLoading && !chart)) {
    return (
      <main className="min-h-screen bg-[#f6f8fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xl font-black">チャートを読み込み中...</p>
          <p className="mt-2 text-sm font-bold text-slate-500">
            株価・AI分析・支持線を取得しています。
          </p>
        </div>
      </main>
    );
  }

  if (!stock || !chart?.success) {
    return (
      <main className="min-h-screen bg-[#f6f8fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md">
          <Link href={`/analysis/${code}`} className="font-black text-blue-600">
            ← 分析へ戻る
          </Link>
          <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xl font-black">
              チャートデータを取得できませんでした
            </p>
          </div>
        </div>
      </main>
    );
  }

  const power = getPower(stock);
  const judge = getJudge(power, chart.trend);
  const currentPrice = chart.currentPrice ?? stock.price;

  const takeProfit = stock.takeProfit ?? Math.round(currentPrice * 1.03);
  const stopLoss = stock.stopLoss ?? Math.round(currentPrice * 0.98);

  const supportPrice = chart.supportPrice ?? stock.supportPrice ?? null;
  const resistancePrice = chart.resistancePrice ?? stock.resistancePrice ?? null;

  const supportResistanceStatus =
    chart.supportResistanceStatus ??
    stock.supportResistanceStatus ??
    "NO_DATA";

  const breakoutExpectation =
    chart.breakoutExpectation ?? stock.breakoutExpectation ?? 0;

  const lotSize = 100;
  const requiredMoney = currentPrice * lotSize;
  const takeProfitMoney = (takeProfit - currentPrice) * lotSize;
  const stopLossMoney = (stopLoss - currentPrice) * lotSize;

  const supportDiff =
    supportPrice !== null ? supportPrice - currentPrice : null;
  const resistanceDiff =
    resistancePrice !== null ? resistancePrice - currentPrice : null;

  const supportResistanceComment = getSupportResistanceComment(
    supportResistanceStatus,
    breakoutExpectation,
  );

  const aiCommentItems = buildCommentItems({
    chart: {
      ...chart,
      breakoutExpectation,
      supportResistanceStatus,
    },
    takeProfitMoney,
    stopLossMoney,
    requiredMoney,
  });
  const aiAdviceItems = buildAIAdvice({
    currentPrice,
    trend: chart.trend,
    status: supportResistanceStatus,
    supportPrice,
    resistancePrice,
    breakoutExpectation,
    volumeRatio: stock.volumeRatio,
    aiPower: power,
    ma20: chart.ma20,
    ema20: chart.ema20,
    stopLoss,
  });
  const aiAdviceImportance = getAIAdviceImportance({
    trend: chart.trend,
    status: supportResistanceStatus,
    breakoutExpectation,
    volumeRatio: stock.volumeRatio,
    aiPower: power,
  });

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f8fc] pb-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-md px-2.5 pt-1.5 md:max-w-7xl md:px-6 md:pt-2">
        <header className="sticky top-0 z-30 -mx-2.5 border-b border-slate-200/80 bg-[#f6f8fc]/95 px-2.5 py-1.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:-mx-6 md:px-6">
          <div className="flex items-center justify-between">
            <Link
              href={`/analysis/${code}`}
              className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-2xl font-black shadow-sm transition active:scale-95 dark:border-slate-700 dark:bg-slate-900"
              aria-label="分析へ戻る"
            >
              ‹
            </Link>

            <div className="text-center">
              <div className="text-2xl font-black tracking-tight sm:text-3xl">
                SIGNAL<span className="text-blue-600">X</span>
              </div>
            </div>

            <div className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-xl shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-hidden>
              📈
            </div>
          </div>
        </header>

        <div className="mt-2 space-y-2">
          <ChartHeader
            code={stock.code}
            name={stock.name}
            power={power}
            judge={judge}
            judgeClass={getJudgeClass(power)}
            trend={getTrendText(chart.trend)}
            trendIcon={getTrendIcon(chart.trend)}
            trendClass={getTrendClass(chart.trend)}
            currentPrice={currentPrice}
            ma20={chart.ma20}
            ema20={chart.ema20}
            vwap={chart.vwap}
            macd={chart.macd}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-2">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="grid min-w-0 flex-1 grid-cols-6 rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800" role="tablist" aria-label="チャート時間足">
              {TIMEFRAMES.map((item) => {
                const active = timeframe === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`${item.label}に切り替え`}
                    onClick={() => setTimeframe(item.value)}
                    disabled={chartLoading && active}
                    className={`min-h-10 min-w-0 rounded-[10px] px-0.5 py-2 text-xs font-black transition-all duration-200 md:px-3 md:text-sm ${
                      active
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                    } disabled:cursor-wait`}
                  >
                    <span className="md:hidden">{item.value}</span>
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                );
              })}
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-2 text-xs font-black text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <span className="mr-1 text-[9px]">●</span>実データ
              </span>
            </div>

            <div className="relative mt-1 min-h-[320px]">
              <div
                className={`transition-opacity duration-200 ${
                  chartLoading ? "opacity-40" : "opacity-100"
                }`}
              >
                <TradingChart
                  candles={chart.candles}
                  ma20={chart.ma20}
                  currentPrice={currentPrice}
                  takeProfit={takeProfit}
                  stopLoss={stopLoss}
                  supportPrice={supportPrice}
                  resistancePrice={resistancePrice}
                  ema20={chart.ema20}
                  vwap={chart.vwap}
                  macd={chart.macd}
                  macdSignal={chart.macdSignal}
                />
              </div>

              {chartLoading && (
                <div className="absolute inset-0 z-10 grid place-items-center rounded-[18px] bg-white/45 backdrop-blur-[1px] dark:bg-slate-950/45">
                  <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                    <span className="text-sm font-black text-slate-700">
                      {timeframe}を読み込み中
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {showScrollCue && (
            <a
              href="#ai-future-prediction"
              onClick={(event) => {
                event.preventDefault();
                const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                document.getElementById("ai-future-prediction")?.scrollIntoView({
                  behavior: reduceMotion ? "auto" : "smooth",
                  block: "start",
                });
              }}
              className="group fixed bottom-3 left-1/2 z-20 flex min-h-9 w-[calc(100%-1rem)] max-w-sm -translate-x-1/2 items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 px-2 py-1.5 text-center text-[11px] font-bold text-slate-500 shadow-sm backdrop-blur transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 sm:gap-2 sm:px-3 sm:text-xs"
              aria-label="この下にあるAI未来予測とAIアドバイスへ移動"
            >
              <span className="scroll-cue-arrow shrink-0 text-sm leading-none" aria-hidden>↓</span>
              <span className="whitespace-nowrap sm:hidden">続きを見る（AI未来予測・AI分析）</span>
              <span className="hidden whitespace-nowrap sm:inline">この下にAI未来予測・AIアドバイスがあります</span>
            </a>
          )}

          <div id="ai-future-prediction" className="scroll-mt-16">
            <AIPredictionCard
  currentPrice={currentPrice}
  aiPower={power}
  trend={chart.trend}
  ma20={chart.ma20}
  ema20={chart.ema20}
  vwap={chart.vwap}
  macdHistogram={chart.macdHistogram}
  rsi={stock.rsi}
  volumeRatio={stock.volumeRatio}
  breakoutExpectation={breakoutExpectation}
  resistancePrice={resistancePrice}
  supportPrice={supportPrice}
  candles={chart.candles}

  takeProfit={takeProfit}
  stopLoss={stopLoss}

  takeProfitMoney={takeProfitMoney}
  stopLossMoney={stopLossMoney}

  requiredMoney={requiredMoney}
/>
          </div>

          <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ActionCard
              title="🎯 利確目標"
              targetPrice={takeProfit}
              resultLabel="💴 利益"
              resultValue={takeProfitMoney}
              requiredMoney={requiredMoney}
              tone="profit"
            />

            <ActionCard
              title="🛡 損切ライン"
              targetPrice={stopLoss}
              resultLabel="💸 損失"
              resultValue={stopLossMoney}
              requiredMoney={requiredMoney}
              tone="loss"
            />
          </section>

          <section className="grid grid-cols-1 gap-2 lg:grid-cols-[1.05fr_0.95fr]">
            <SupportResistanceCard
              supportPrice={supportPrice}
              currentPrice={currentPrice}
              resistancePrice={resistancePrice}
              supportDiff={supportDiff}
              resistanceDiff={resistanceDiff}
              statusLabel={getSupportResistanceLabel(supportResistanceStatus)}
              breakoutExpectation={breakoutExpectation}
              comment={supportResistanceComment}
            />

            <div className="space-y-2">
              <AnalysisCard
                trend={getTrendText(chart.trend)}
                pattern={getPatternText(chart.patternSignal)}
                aiScore={power}
                candleSignal={chart.candleSignal}
              />
              <AIAdviceCard items={aiAdviceItems} importance={aiAdviceImportance} />
            </div>
          </section>

          <AICommentCard items={aiCommentItems} />
        </div>
      </div>
    </main>
  );
}
