"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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
  candles: Candle[];
};

function yen(value?: number | null) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function timeLabel(time: number) {
  return new Date(time * 1000).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPower(stock: Stock | null) {
  return stock?.score ?? stock?.aiPower ?? 0;
}

function getJudge(power: number) {
  if (power >= 80) return "買い候補";
  if (power >= 75) return "押し目待ち";
  if (power >= 65) return "様子見";
  return "見送り";
}

function getTrendText(trend: string) {
  if (trend === "UPTREND") return "上昇トレンド";
  if (trend === "DOWNTREND") return "下降トレンド";
  return "判定なし";
}

function getPatternText(pattern: string) {
  if (pattern === "W_BOTTOM_BREAK") return "Wボトム突破";
  if (pattern === "W_BOTTOM") return "Wボトム候補";
  if (pattern === "NONE") return "通常";
  return pattern;
}

export default function ChartPage() {
  const params = useParams();
  const code = String(params.code);

  const [stock, setStock] = useState<Stock | null>(null);
  const [chart, setChart] = useState<ChartApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [scanRes, chartRes] = await Promise.all([
          fetch("/api/scan?limit=1000", { cache: "no-store" }),
          fetch(`/api/chart/${code}`, { cache: "no-store" }),
        ]);

        const scanData = await scanRes.json();
        const chartData = await chartRes.json();

        const stocks: Stock[] = Array.isArray(scanData)
          ? scanData
          : Array.isArray(scanData.stocks)
          ? scanData.stocks
          : [];

        const found = stocks.find((s) => String(s.code) === code);

        setStock(found ?? null);
        setChart(chartData);
      } catch (error) {
        console.error("chart page error:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [code]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-5 shadow">
          チャートを読み込み中...
        </div>
      </main>
    );
  }

  if (!stock || !chart?.success) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4">
        <div className="mx-auto max-w-md">
          <Link href={`/analysis/${code}`} className="font-black text-blue-600">
            ← 分析へ戻る
          </Link>
          <div className="mt-4 rounded-2xl bg-white p-5 shadow">
            チャートデータを取得できませんでした
          </div>
        </div>
      </main>
    );
  }

  const power = getPower(stock);
  const takeProfit = stock.takeProfit ?? Math.round(stock.price * 1.03);
  const stopLoss = stock.stopLoss ?? Math.round(stock.price * 0.98);

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="flex items-center justify-between mb-4">
          <Link
            href={`/analysis/${code}`}
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-2xl"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.22em] text-slate-500">
              REAL CHART
            </div>
          </div>

          <div className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center">
            📈
          </div>
        </header>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <p className="text-sm font-black text-blue-600">リアル株価チャート</p>

          <div className="flex justify-between items-end mt-2">
            <div>
              <h1 className="text-4xl font-black">{stock.code}</h1>
              <p className="text-2xl font-black">{stock.name}</p>
            </div>

            <div className="text-right">
              <p className="text-xs font-black text-slate-500">AI POWER</p>
              <p className="text-4xl font-black text-blue-600">{power}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">

  <Mini
    label="現在値"
    value={yen(chart.currentPrice)}
  />

  <Mini
    label="MA20"
    value={yen(chart.ma20)}
  />

  <Mini
    label="EMA20"
    value={yen(chart.ema20)}
  />

  <Mini
    label="VWAP"
    value={yen(chart.vwap)}
  />

 <Mini
  label="MACD"
  value={
    chart.macd == null
      ? "-"
      : chart.macd.toFixed(2)
  }
/>

  <Mini
    label="判定"
    value={getJudge(power)}
  />

</div>
        </section>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black">🕯 ローソク足</h2>
            <span className="text-xs font-black text-green-600">
              実データ
            </span>
          </div>

          <CandleChart
            candles={chart.candles}
            ma20={chart.ma20}
            takeProfit={takeProfit}
            stopLoss={stopLoss}
          />
        </section>

        <section className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-[24px] bg-green-50 border border-green-300 p-4 text-center shadow-sm">
            <p className="text-sm font-black text-green-700">🎯 利確ライン</p>
            <p className="text-3xl font-black text-green-600 mt-2">
              {yen(takeProfit)}
            </p>
          </div>

          <div className="rounded-[24px] bg-red-50 border border-red-300 p-4 text-center shadow-sm">
            <p className="text-sm font-black text-red-700">🛡 損切ライン</p>
            <p className="text-3xl font-black text-red-600 mt-2">
              {yen(stopLoss)}
            </p>
          </div>
        </section>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">📊 チャート解析</h2>

          <div className="grid grid-cols-2 gap-3">
            <Mini label="トレンド" value={getTrendText(chart.trend)} />
            <Mini label="形状" value={getPatternText(chart.patternSignal)} />
            <Mini label="スコア" value={`${chart.patternScore}`} />
            <Mini label="足型" value={chart.candleSignal} />
          </div>
        </section>

        <section className="rounded-[24px] bg-blue-50 border border-blue-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">💬 チャートAIコメント</h2>

          <div className="space-y-3">
            <Comment text={`現在は${getTrendText(chart.trend)}です。`} />
            {chart.patternReasons.map((reason) => (
              <Comment key={reason} text={reason} />
            ))}
            <Comment
              text={`利確は${yen(takeProfit)}、損切は${yen(
                stopLoss
              )}を目安にしましょう。`}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function CandleChart({
  candles,
  ma20,
  takeProfit,
  stopLoss,
}: {
  candles: Candle[];
  ma20: number | null;
  takeProfit: number;
  stopLoss: number;
}) {
  const data = candles.slice(-40);

  if (!data.length) {
    return <p className="text-sm font-bold text-slate-500">データなし</p>;
  }

  const width = 320;
  const height = 260;
  const padding = 30;

  const prices = data.flatMap((c) => [c.high, c.low, ma20 ?? c.close, takeProfit, stopLoss]);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  const y = (price: number) =>
    height - padding - ((price - min) / Math.max(max - min, 1)) * (height - padding * 2);

  const candleWidth = Math.max(4, (width - padding * 2) / data.length - 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[300px]">
      {[min, (min + max) / 2, max].map((price) => (
        <g key={price}>
          <line
            x1={padding}
            x2={width - padding}
            y1={y(price)}
            y2={y(price)}
            stroke="#e5e7eb"
          />
          <text x="2" y={y(price) + 4} fontSize="9" fill="#64748b">
            {Math.round(price)}
          </text>
        </g>
      ))}

      <line
        x1={padding}
        x2={width - padding}
        y1={y(takeProfit)}
        y2={y(takeProfit)}
        stroke="#16a34a"
        strokeDasharray="4 4"
      />
      <text x={width - 55} y={y(takeProfit) - 4} fontSize="10" fill="#16a34a">
        利確
      </text>

      <line
        x1={padding}
        x2={width - padding}
        y1={y(stopLoss)}
        y2={y(stopLoss)}
        stroke="#dc2626"
        strokeDasharray="4 4"
      />
      <text x={width - 55} y={y(stopLoss) - 4} fontSize="10" fill="#dc2626">
        損切
      </text>

      {ma20 && (
        <>
          <line
            x1={padding}
            x2={width - padding}
            y1={y(ma20)}
            y2={y(ma20)}
            stroke="#2563eb"
            strokeDasharray="3 3"
          />
          <text x={width - 55} y={y(ma20) - 4} fontSize="10" fill="#2563eb">
            MA20
          </text>
        </>
      )}

      {data.map((c, index) => {
        const x =
          padding +
          (index / Math.max(data.length - 1, 1)) * (width - padding * 2);

        const up = c.close >= c.open;
        const color = up ? "#ef4444" : "#16a34a";
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBottom = y(Math.min(c.open, c.close));
        const bodyHeight = Math.max(bodyBottom - bodyTop, 2);

        return (
          <g key={`${c.time}-${index}`}>
            <line
              x1={x}
              x2={x}
              y1={y(c.high)}
              y2={y(c.low)}
              stroke={color}
              strokeWidth="1.5"
            />
            <rect
              x={x - candleWidth / 2}
              y={bodyTop}
              width={candleWidth}
              height={bodyHeight}
              fill={up ? "#fee2e2" : "#dcfce7"}
              stroke={color}
              strokeWidth="1.5"
              rx="1"
            />
          </g>
        );
      })}

      {data.map((c, index) => {
        if (index % 10 !== 0 && index !== data.length - 1) return null;

        const x =
          padding +
          (index / Math.max(data.length - 1, 1)) * (width - padding * 2);

        return (
          <text
            key={`label-${c.time}`}
            x={x}
            y={height - 8}
            textAnchor="middle"
            fontSize="8"
            fill="#64748b"
          >
            {timeLabel(c.time)}
          </text>
        );
      })}
    </svg>
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
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className="text-lg font-black mt-1">{value}</p>
    </div>
  );
}

function Comment({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-white/80 border border-blue-100 p-3">
      <p className="text-sm font-bold leading-6">✅ {text}</p>
    </div>
  );
}