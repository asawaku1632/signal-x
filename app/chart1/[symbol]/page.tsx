"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function Page() {
  const params = useParams();
  const symbol = params.symbol as string;

  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!symbol) return;

    const fetchChart = async () => {
      const res = await fetch(`/api/chart/${symbol}`);
      const json = await res.json();
      setData(json);
    };

    fetchChart();
  }, [symbol]);

  if (!data) {
    return (
      <div
        style={{
          background: "#050816",
          minHeight: "100vh",
          color: "white",
          padding: 30,
        }}
      >
        読み込み中...
      </div>
    );
  }

  const chartData =
    data.candles?.map((c: any, index: number) => ({
      index,
      close: c.close,
      ma20: data.ma20,
    })) || [];

  return (
    <div
      style={{
        background: "#050816",
        minHeight: "100vh",
        color: "white",
        padding: 30,
        fontFamily: "sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: 54,
          marginBottom: 10,
          fontWeight: 900,
        }}
      >
        シグナルX
      </h1>

      <div
        style={{
          fontSize: 42,
          fontWeight: 900,
          color: "#4dffb8",
          marginBottom: 30,
        }}
      >
        {symbol}
      </div>

      <div
        style={{
          background: "#11182d",
          borderRadius: 20,
          padding: 25,
          marginBottom: 25,
        }}
      >
        <div
          style={{
            color: "#aaa",
            marginBottom: 10,
          }}
        >
          現在価格
        </div>

        <div
          style={{
            fontSize: 58,
            fontWeight: 900,
            color: "#4dffb8",
          }}
        >
          ¥{data.currentPrice ?? "--"}
        </div>
      </div>

      <div
        style={{
          background: "#11182d",
          borderRadius: 20,
          padding: 20,
          marginBottom: 30,
          height: 420,
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            marginBottom: 20,
          }}
        >
          株価チャート
        </div>

        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={chartData}>
            <XAxis dataKey="index" hide />

            <YAxis domain={["dataMin - 20", "dataMax + 20"]} />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="close"
              stroke="#4dffb8"
              strokeWidth={4}
              dot={false}
            />

            <Line
              type="monotone"
              dataKey="ma20"
              stroke="#ff7b7b"
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 25,
        }}
      >
        <div
          style={{
            background: "#11182d",
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div style={{ color: "#aaa" }}>トレンド</div>

          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              color:
                data.trend === "UPTREND"
                  ? "#4dffb8"
                  : "#ff7b7b",
            }}
          >
            {data.trend === "UPTREND"
              ? "上昇トレンド"
              : data.trend === "DOWNTREND"
              ? "下降トレンド"
              : data.trend}
          </div>
        </div>

        <div
          style={{
            background: "#11182d",
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div style={{ color: "#aaa" }}>MA20</div>

          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: "#00ccff",
            }}
          >
            {data.ma20 ?? "--"}
          </div>
        </div>

        <div
          style={{
            background: "#11182d",
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div style={{ color: "#aaa" }}>ローソク足</div>

          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              color:
                data.candleSignal === "BULLISH_ENGULFING"
                  ? "#4dffb8"
                  : data.candleSignal === "BEARISH_ENGULFING"
                  ? "#ff7b7b"
                  : "#fef3c7",
            }}
          >
            {data.candleSignal === "BULLISH_ENGULFING"
              ? "買い包み足"
              : data.candleSignal === "BEARISH_ENGULFING"
              ? "売り包み足"
              : "全くありません"}
          </div>
        </div>

        <div
          style={{
            background: "#11182d",
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div style={{ color: "#aaa" }}>チャートパターン</div>

          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              color:
                data.patternSignal === "W_BOTTOM" ||
                data.patternSignal === "W_BOTTOM_BREAK"
                  ? "#4dffb8"
                  : "#fef3c7",
            }}
          >
            {data.patternSignal === "W_BOTTOM"
              ? "Wボトム候補"
              : data.patternSignal === "W_BOTTOM_BREAK"
              ? "Wボトム上抜け"
              : "全くありません"}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#11182d",
          borderRadius: 24,
          padding: 25,
          border: `1px solid ${
            data.patternScore >= 30
              ? "#4dffb8"
              : data.patternScore >= 10
              ? "#facc15"
              : data.patternScore < 0
              ? "#ff7b7b"
              : "#64748b"
          }`,
        }}
      >
        <div style={{ color: "#aaa", marginBottom: 10 }}>
          シグナルスコア
        </div>

        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color:
              data.patternScore >= 30
                ? "#4dffb8"
                : data.patternScore >= 10
                ? "#facc15"
                : data.patternScore < 0
                ? "#ff7b7b"
                : "#94a3b8",
          }}
        >
          {data.patternScore ?? 0}
        </div>

        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            marginBottom: 20,
            color:
              data.patternScore >= 30
                ? "#4dffb8"
                : data.patternScore >= 10
                ? "#facc15"
                : data.patternScore < 0
                ? "#ff7b7b"
                : "#94a3b8",
          }}
        >
          {data.patternScore >= 50
            ? "GOLD SIGNAL候補"
            : data.patternScore >= 30
            ? "買い優位"
            : data.patternScore >= 10
            ? "様子見"
            : data.patternScore < 0
            ? "弱い"
            : "中立"}
        </div>

        <div style={{ color: "#aaa", marginBottom: 10 }}>
          判定理由
        </div>

        {data.patternReasons?.length > 0 ? (
          <ul style={{ lineHeight: 1.9, fontSize: 18 }}>
            {data.patternReasons.map(
              (reason: string, index: number) => (
                <li key={index}>{reason}</li>
              )
            )}
          </ul>
        ) : (
          <div style={{ color: "#94a3b8", fontSize: 18 }}>
            まだ強い根拠は検出されていません。
          </div>
        )}
      </div>
    </div>
  );
}