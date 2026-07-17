"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import TradingChart from "./components/TradingChart";
import ActionCard from "./components/ActionCard";
import ChartHeader from "./components/ChartHeader";
import SupportResistanceCard from "./components/SupportResistanceCard";
import AnalysisCard from "./components/AnalysisCard";
import AICommentCard from "./components/AICommentCard";
import AIPredictionCard from "./components/AIPredictionCard";

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

function getJudge(power: number) {
  if (power >= 95) return "大本命";
  if (power >= 85) return "買い候補";
  if (power >= 75) return "押し目待ち";
  if (power >= 65) return "様子見";
  return "見送り";
}

function getJudgeClass(power: number) {
  if (power >= 95) return "border-yellow-300 bg-yellow-100 text-yellow-800";
  if (power >= 85) {
    return "border-emerald-300 bg-emerald-100 text-emerald-800";
  }
  if (power >= 75) return "border-blue-300 bg-blue-100 text-blue-800";
  if (power >= 65) return "border-amber-300 bg-amber-100 text-amber-800";
  return "border-indigo-200 bg-indigo-100 text-indigo-800";
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
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }
  if (trend === "DOWNTREND") {
    return "border-red-300 bg-red-50 text-red-700";
  }
  return "border-amber-300 bg-amber-50 text-amber-700";
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
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setChartLoading(true);

      try {
        const [scanRes, chartRes] = await Promise.all([
          fetch("/api/scan?limit=1000", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/api/chart/${code}?tf=${timeframe}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        if (!scanRes.ok) {
          throw new Error(`scan api error: ${scanRes.status}`);
        }

        if (!chartRes.ok) {
          throw new Error(`chart api error: ${chartRes.status}`);
        }

        const scanData = await scanRes.json();
        const chartData: ChartApi = await chartRes.json();

        const stocks: Stock[] = Array.isArray(scanData)
          ? scanData
          : Array.isArray(scanData.stocks)
            ? scanData.stocks
            : [];

        const found = stocks.find((item) => String(item.code) === code);

        setStock(found ?? null);
        setChart(chartData);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("chart page error:", error);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setChartLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [code, timeframe]);

  if (loading) {
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
  const judge = getJudge(power);
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

  return (
    <main className="min-h-screen bg-[#f6f8fc] pb-24 text-slate-900">
      <div className="mx-auto w-full max-w-md px-4 pt-4 md:max-w-7xl md:px-6">
        <header className="sticky top-0 z-30 -mx-4 border-b border-slate-200/80 bg-[#f6f8fc]/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <div className="flex items-center justify-between">
            <Link
              href={`/analysis/${code}`}
              className="grid h-12 w-12 place-items-center rounded-[18px] border border-slate-200 bg-white text-2xl font-black shadow-sm transition active:scale-95"
              aria-label="分析へ戻る"
            >
              ‹
            </Link>

            <div className="text-center">
              <div className="text-3xl font-black tracking-tight">
                SIGNAL<span className="text-blue-600">X</span>
              </div>
              <div className="text-[10px] font-black tracking-[0.24em] text-slate-500">
                AI CHART V4 MULTI TIMEFRAME
              </div>
            </div>

            <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-slate-200 bg-white text-xl shadow-sm">
              📈
            </div>
          </div>
        </header>

        <div className="mt-3 space-y-3.5">
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

          <section className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm md:p-4.5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-blue-600">
                  MAIN CHART
                </p>
                <h2 className="mt-1 text-2xl font-black md:text-4xl">
                  株価チャート
                </h2>
              </div>

              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 md:px-4 md:py-2 md:text-sm">
                実データ
              </span>
            </div>

            <div
              className="mt-4 grid grid-cols-6 rounded-[16px] border border-slate-200 bg-slate-100 p-1"
              role="tablist"
              aria-label="チャート時間足"
            >
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
                    className={`min-w-0 rounded-[12px] px-1 py-2.5 text-xs font-black transition-all duration-200 md:px-3 md:text-sm ${
                      active
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-500 hover:bg-white hover:text-slate-900"
                    } disabled:cursor-wait`}
                  >
                    <span className="md:hidden">{item.value}</span>
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between px-1">
              <p className="text-xs font-bold text-slate-500">
                表示中：{TIMEFRAMES.find((item) => item.value === timeframe)?.label}
              </p>
              <p className="text-xs font-black text-blue-600">
                {chartLoading ? "データ更新中..." : `${chart.candles.length}本`}
              </p>
            </div>

            <div className="relative mt-3 min-h-[320px]">
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
                />
              </div>

              {chartLoading && (
                <div className="absolute inset-0 z-10 grid place-items-center rounded-[18px] bg-white/45 backdrop-blur-[1px]">
                  <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-lg">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                    <span className="text-sm font-black text-slate-700">
                      {timeframe}を読み込み中
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

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

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_0.95fr]">
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

            <AnalysisCard
              trend={getTrendText(chart.trend)}
              pattern={getPatternText(chart.patternSignal)}
              score={chart.patternScore}
              candleSignal={chart.candleSignal}
            />
          </section>

          <AICommentCard items={aiCommentItems} />
        </div>
      </div>
    </main>
  );
}