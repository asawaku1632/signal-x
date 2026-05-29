"use client";

import { useEffect, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  rsi: number;
  volumeRatio: number;
  breakout: boolean;
  lowerWick: boolean;
  doubleBottom: boolean;
  signalScore: number;
  signal: string;
  reasons: string[];
  notificationLevel: string;
  pattern: string;
  shouldNotify: boolean;
};

export default function ScanPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [flashAlert, setFlashAlert] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);

  async function fetchStocks() {
    try {
      const res = await fetch("/api/scan");

      const data = await res.json();

      setStocks(data);

      const newAlerts = data.filter(
        (s: Stock) => s.notificationLevel === "今すぐ見ろ"
      );

      if (newAlerts.length > 0) {
        playAlertSound();

        setFlashAlert(true);

        setTimeout(() => {
          setFlashAlert(false);
        }, 3000);

        const alertMessages = newAlerts.map(
          (s: Stock) =>
            `${new Date().toLocaleTimeString()} ${s.name} 今すぐ見ろ`
        );

        setAlerts((prev) => [...alertMessages, ...prev].slice(0, 10));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStocks();

    const interval = setInterval(() => {
      fetchStocks();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  function playAlertSound() {
    const audio = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
    );

    audio.play().catch(() => {});
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* サイドバー */}
      <div className="w-64 bg-[#050816] border-r border-blue-900 p-6 hidden md:block">
        <h1 className="text-3xl font-black text-green-400 mb-10">
          SIGNALX
        </h1>

        <div className="space-y-4 text-gray-300">
          <div className="text-green-400 font-bold">全銘柄スキャン</div>
          <div>ダッシュボード</div>
          <div>戦略AI</div>
          <div>チャート分析</div>
          <div>レーダー監視</div>
          <div>アラート履歴</div>
        </div>
      </div>

      {/* メイン */}
      <div className="flex-1 p-6">
        {/* タイトル */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-5xl font-black mb-2">
              全銘柄スキャン
            </h1>

            <p className="text-gray-400">
              実際の日本株データを監視中...
            </p>
          </div>

          <div className="text-right">
            <div className="text-gray-400 text-sm">
              自動更新: 5秒
            </div>
          </div>
        </div>

        {/* 上部ステータス */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#07111f] border border-blue-900 rounded-2xl p-5">
            <p className="text-gray-400 mb-2">監視銘柄数</p>

            <p className="text-5xl font-black text-green-400">
              {stocks.length}
            </p>
          </div>

          <div className="bg-[#07111f] border border-blue-900 rounded-2xl p-5">
            <p className="text-gray-400 mb-2">強い通知候補</p>

            <p className="text-5xl font-black text-green-400">
              {
                stocks.filter(
                  (s) => s.notificationLevel === "買い候補"
                ).length
              }
            </p>
          </div>

          <div className="bg-[#07111f] border border-red-900 rounded-2xl p-5">
            <p className="text-gray-400 mb-2">激アツ</p>

            <p className="text-5xl font-black text-red-400">
              {
                stocks.filter((s) => s.signal === "激アツ")
                  .length
              }
            </p>
          </div>

          <div className="bg-[#07111f] border border-yellow-700 rounded-2xl p-5">
            <p className="text-gray-400 mb-2">平均スコア</p>

            <p className="text-5xl font-black text-yellow-400">
              {stocks.length > 0
                ? Math.round(
                    stocks.reduce(
                      (sum, s) => sum + s.signalScore,
                      0
                    ) / stocks.length
                  )
                : 0}
            </p>
          </div>
        </div>

        {/* テーブル */}
        <div className="overflow-x-auto rounded-2xl border border-blue-900">
          <table className="w-full">
            <thead className="bg-blue-700">
              <tr className="text-left text-white">
                <th className="p-4">コード</th>
                <th className="p-4">銘柄名</th>
                <th className="p-4">株価</th>
                <th className="p-4">変化率</th>
                <th className="p-4">検知パターン</th>
                <th className="p-4">RSI</th>
                <th className="p-4">出来高倍率</th>
                <th className="p-4">スコア</th>
                <th className="p-4">判定</th>
                <th className="p-4">通知</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center">
                    読み込み中...
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => (
                  <tr
                    key={stock.code}
                    className="border-b border-gray-900 hover:bg-[#07111f]"
                  >
                    <td className="p-4">{stock.code}</td>

                    <td className="p-4 font-bold">
                      {stock.name}
                    </td>

                    <td className="p-4">
                      {stock.price.toLocaleString()}円
                    </td>

                    <td
                      className={`p-4 font-bold ${
                        stock.changeRate >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {stock.changeRate}%
                    </td>

                    <td className="p-4 text-green-400">
                      {stock.pattern}
                    </td>

                    <td className="p-4 text-red-400">
                      {stock.rsi}
                    </td>

                    <td className="p-4 text-pink-400">
                      {stock.volumeRatio}倍
                    </td>

                    <td className="p-4">
                      <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full">
                        {stock.signalScore}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${
                          stock.signal === "激アツ"
                            ? "bg-red-500/20 text-red-400"
                            : stock.signal === "強い買い"
                            ? "bg-green-500/20 text-green-400"
                            : stock.signal === "買い候補"
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-gray-500/20 text-gray-300"
                        }`}
                      >
                        {stock.signal}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${
                          stock.notificationLevel === "今すぐ見ろ"
                            ? "bg-red-600 text-white"
                            : stock.notificationLevel ===
                              "買い候補"
                            ? "bg-yellow-500 text-black"
                            : "bg-blue-500 text-white"
                        }`}
                      >
                        {stock.notificationLevel}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 右通知 */}
      <div className="w-80 p-5 hidden xl:block">
        <div
          className={`bg-[#07111f] border rounded-2xl p-5 transition-all ${
            flashAlert
              ? "border-red-500 shadow-lg shadow-red-500/50"
              : "border-gray-800"
          }`}
        >
          <h2 className="text-2xl font-black mb-5">
            🔥 シグナルアラート
          </h2>

          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-gray-500">
                条件を満たす通知はまだありません
              </p>
            ) : (
              alerts.map((alert, index) => (
                <div
                  key={index}
                  className="bg-black/50 rounded-xl p-3 border border-red-900"
                >
                  <p className="text-red-400 font-bold">
                    {alert}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}