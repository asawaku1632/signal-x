"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ApiStock = {
  code?: string | number;
  name?: string;
  price?: number;
  currentPrice?: number;
  score?: number;
  aiPower?: number;
  changePercent?: number;
  rsi?: number;
  volumeRatio?: number;
  reason?: string;
  patternSignal?: string;
  signal?: string;
  notificationLevel?: string;
  takeProfit?: number;
  stopLoss?: number;
};

type Stock = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  rsi: number;
  volumeRatio: number;
  score: number;
  reason: string;
  patternSignal: string;
  notificationLevel: string;
  takeProfit?: number;
  stopLoss?: number;
};

type ScanResponse = {
  success?: boolean;
  totalStockList?: number;
  scannedCount?: number;
  stocks?: ApiStock[];
};

const REFRESH_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

function normalizeStocks(input: ApiStock[]): Stock[] {
  return input.map((stock) => ({
    code: String(stock.code ?? ""),
    name: String(stock.name ?? "名称不明"),
    price: Number(stock.price ?? stock.currentPrice ?? 0),
    changePercent: Number(stock.changePercent ?? 0),
    rsi: Number(stock.rsi ?? 0),
    volumeRatio: Number(stock.volumeRatio ?? 0),
    score: Number(stock.score ?? stock.aiPower ?? 0),
    reason: String(stock.reason ?? ""),
    patternSignal: String(stock.patternSignal ?? "NONE"),
    notificationLevel: String(stock.notificationLevel ?? ""),
    takeProfit:
      typeof stock.takeProfit === "number" ? stock.takeProfit : undefined,
    stopLoss:
      typeof stock.stopLoss === "number" ? stock.stopLoss : undefined,
  }));
}

function getSignal(score: number) {
  if (score >= 95) return "大本命";
  if (score >= 85) return "激熱";
  if (score >= 70) return "買い候補";
  if (score >= 50) return "静観";
  return "見送り";
}

function getNotificationLevel(stock: Stock) {
  if (stock.notificationLevel) return stock.notificationLevel;
  if (stock.score >= 95) return "今すぐ確認";
  if (stock.score >= 85) return "激熱候補";
  if (stock.score >= 70) return "買い候補";
  return "監視";
}

export default function ScanPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [totalStockList, setTotalStockList] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [alerts, setAlerts] = useState<string[]>([]);

  async function fetchStocks() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS
    );

    try {
      setErrorText("");

      const res = await fetch("/api/scan?limit=1200&top=100", {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`scan api error: ${res.status}`);
      }

      const data: ScanResponse | ApiStock[] = await res.json();

      const rawStocks = Array.isArray(data)
        ? data
        : Array.isArray(data?.stocks)
          ? data.stocks
          : [];

      const normalized = normalizeStocks(rawStocks);
      setStocks(normalized);

      if (!Array.isArray(data)) {
        setTotalStockList(Number(data.totalStockList ?? normalized.length));
        setScannedCount(Number(data.scannedCount ?? normalized.length));
      } else {
        setTotalStockList(normalized.length);
        setScannedCount(normalized.length);
      }

      const newAlerts = normalized
        .filter((stock) => stock.score >= 95)
        .map(
          (stock) =>
            `${new Date().toLocaleTimeString("ja-JP")} ${stock.code} ${stock.name} AI ${stock.score}`
        );

      if (newAlerts.length > 0) {
        setAlerts((prev) => [...newAlerts, ...prev].slice(0, 10));
      }
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "スキャンAPIがタイムアウトしました。少し待って再読み込みしてください。"
          : "スキャンデータを取得できませんでした。";

      console.error("scan fetch error:", error);
      setErrorText(message);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchStocks();

    const intervalId = window.setInterval(() => {
      void fetchStocks();
    }, REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const stats = useMemo(() => {
    const hot = stocks.filter((stock) => stock.score >= 85).length;
    const strong = stocks.filter(
      (stock) => stock.score >= 70 && stock.score < 85
    ).length;
    const average =
      stocks.length > 0
        ? Math.round(
            stocks.reduce((sum, stock) => sum + stock.score, 0) /
              stocks.length
          )
        : 0;

    return { hot, strong, average };
  }, [stocks]);

  return (
    <main className="min-h-screen bg-black pb-24 text-white">
      <div className="mx-auto max-w-6xl p-5 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex text-sm font-black text-blue-300"
            >
              ← Dashboard
            </Link>
            <h1 className="text-4xl font-black md:text-5xl">
              全銘柄スキャン
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              日本株をAIが監視。表示はAI POWER上位100銘柄です。
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchStocks()}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black"
          >
            再読み込み
          </button>
        </div>

        <section className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="監視対象銘柄" value={totalStockList} />
          <Stat label="取得済み" value={scannedCount} />
          <Stat label="激熱候補" value={stats.hot} />
          <Stat label="買い候補" value={stats.strong} />
          <Stat label="平均AI" value={stats.average} />
        </section>

        {loading && (
          <div className="rounded-3xl border border-blue-900 bg-[#07111f] p-8 text-center font-black">
            AIランキングを読み込み中...
          </div>
        )}

        {!loading && errorText && (
          <div className="rounded-3xl border border-red-900 bg-red-950/40 p-6">
            <p className="font-black text-red-300">{errorText}</p>
          </div>
        )}

        {!loading && !errorText && (
          <div className="overflow-x-auto rounded-3xl border border-blue-900">
            <table className="w-full min-w-[950px]">
              <thead className="bg-blue-700">
                <tr className="text-left">
                  <th className="p-4">順位</th>
                  <th className="p-4">コード</th>
                  <th className="p-4">銘柄名</th>
                  <th className="p-4">株価</th>
                  <th className="p-4">変化率</th>
                  <th className="p-4">RSI</th>
                  <th className="p-4">出来高</th>
                  <th className="p-4">AI</th>
                  <th className="p-4">判定</th>
                  <th className="p-4">詳細</th>
                </tr>
              </thead>

              <tbody>
                {stocks.map((stock, index) => {
                  const signal = getSignal(stock.score);
                  const notification = getNotificationLevel(stock);

                  return (
                    <tr
                      key={stock.code}
                      className="border-b border-slate-900 hover:bg-[#07111f]"
                    >
                      <td className="p-4 font-black">{index + 1}</td>
                      <td className="p-4">{stock.code}</td>
                      <td className="p-4 font-black">{stock.name}</td>
                      <td className="p-4">
                        {Math.round(stock.price).toLocaleString()}円
                      </td>
                      <td
                        className={`p-4 font-black ${
                          stock.changePercent >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {stock.changePercent.toFixed(2)}%
                      </td>
                      <td className="p-4">{stock.rsi || "-"}</td>
                      <td className="p-4">
                        {stock.volumeRatio
                          ? `${stock.volumeRatio.toFixed(2)}倍`
                          : "-"}
                      </td>
                      <td className="p-4 text-2xl font-black text-blue-300">
                        {stock.score}
                      </td>
                      <td className="p-4">
                        <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-black">
                          {signal} / {notification}
                        </span>
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/analysis/${stock.code}`}
                          className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black"
                        >
                          AI分析
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <aside className="mt-8 rounded-3xl border border-slate-800 bg-[#07111f] p-5">
          <h2 className="text-xl font-black">🔥 シグナルアラート</h2>
          <div className="mt-4 space-y-2">
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">
                現在、新しい大本命通知はありません。
              </p>
            ) : (
              alerts.map((alert, index) => (
                <p
                  key={`${alert}-${index}`}
                  className="rounded-xl bg-black/40 p-3 text-sm font-bold text-red-300"
                >
                  {alert}
                </p>
              ))
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-blue-900 bg-[#07111f] p-4">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-blue-300">
        {value.toLocaleString()}
      </p>
    </div>
  );
}