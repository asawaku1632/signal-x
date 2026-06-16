"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Signal = {
  code: string;
  name: string;
  price: number;
  score?: number;
  aiPower?: number;
  changePercent?: number;
  rsi?: number;
  volumeRatio?: number;
  reason?: string;
  takeProfit?: number;
  stopLoss?: number;
};

type HistoryStats = {
  success: boolean;
  code: string;
  total: number;
  win: number;
  lose: number;
  hold?: number;
  winRate: number;
};

function yen(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function getPower(signal: Signal | null) {
  return signal?.score ?? signal?.aiPower ?? 0;
}

function getJudge(power: number) {
  if (power >= 85) return "激熱";
  if (power >= 70) return "本命";
  if (power >= 50) return "静観";
  return "触るな";
}

function getDecision(power: number) {
  if (power >= 85) return "BUY";
  if (power >= 70) return "WATCH BUY";
  if (power >= 50) return "WATCH";
  return "NO ENTRY";
}

export default function AnalysisPage() {
  const params = useParams();
  const code = String(params.code);

  const [signal, setSignal] = useState<Signal | null>(null);
  const [historyStats, setHistoryStats] =
    useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignal = async () => {
      try {
       const scanRes = await fetch(
  "/api/scan?limit=500",
  {
    cache: "no-store",
  }
);

        const scanJson = await scanRes.json();
        const stocks: Signal[] = scanJson.stocks || [];

        const target =
          stocks.find((item) => item.code === code) || null;

        setSignal(target);

        const historyRes = await fetch(
          `/api/result/power-stats/${code}`,
          {
            cache: "no-store",
          }
        );

        const historyJson = await historyRes.json();
        setHistoryStats(historyJson);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchSignal();
  }, [code]);

  if (loading) {
  return (
    <main className="min-h-screen bg-black text-white p-4">
      <div className="max-w-md mx-auto">
        読み込み中...
      </div>
    </main>
  );
}
 

  if (!signal) {
    return (
      <main className="min-h-screen bg-black text-white p-5">
        <h1 className="text-2xl font-black">銘柄が見つかりません</h1>
        <p className="text-zinc-400 mt-2">CODE {code}</p>
      </main>
    );
  }

  const power = getPower(signal);
  const judge = getJudge(power);
  const decision = getDecision(power);

  const takeProfit =
    signal.takeProfit ?? Math.round(signal.price * 1.03);
  const stopLoss =
    signal.stopLoss ?? Math.round(signal.price * 0.98);

  return (
  <main className="min-h-screen bg-black text-white p-4">
    <div className="max-w-md mx-auto">

      <section className="rounded-3xl border border-orange-500/50 bg-zinc-950 p-5 mb-5">

        <div className="flex justify-between items-center mb-5">
          <div className="text-green-400 text-2xl font-black">
            🟢 {judge}
          </div>

          <div className="text-cyan-400 text-2xl font-black">
            信頼度 {power}%
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-5">
          <h1 className="text-5xl font-black">
            {signal.code}{" "}
            <span className="text-yellow-300">
              {signal.name}
            </span>
          </h1>

          <div className="text-center mt-8">
            <p className="text-zinc-400">現在値</p>
            <p className="text-6xl font-black">
              {yen(signal.price)}
            </p>
            <p className="text-yellow-300 mt-2">
              成行100株（必要資金{" "}
              {yen(signal.price * 100)}）
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="rounded-2xl border border-green-500 p-4 text-center">
              <p className="text-green-400 font-bold">
                🎯 利確
              </p>
              <p className="text-4xl font-black">
                {yen(takeProfit)}
              </p>
              <p className="text-green-400 font-bold">
                +{yen((takeProfit - signal.price) * 100)}
              </p>
            </div>

            <div className="rounded-2xl border border-red-500 p-4 text-center">
              <p className="text-red-400 font-bold">
                🛡 損切
              </p>
              <p className="text-4xl font-black">
                {yen(stopLoss)}
              </p>
              <p className="text-red-400 font-bold">
                -{yen((signal.price - stopLoss) * 100)}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-zinc-900 p-4 text-center text-xl font-black">
            {signal.reason || "AI理由なし"}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-purple-500/50 bg-zinc-950 p-5 mb-5 text-center">
  <p className="text-purple-300 text-sm">
    AI得意銘柄判定
  </p>

  <p className="text-4xl font-black text-purple-300 mt-2">
    {historyStats && historyStats.total >= 10 && historyStats.winRate >= 70
      ? "得意銘柄"
      : historyStats && historyStats.total >= 10 && historyStats.winRate < 50
      ? "苦手銘柄"
      : "データ蓄積中"}
  </p>

  <p className="text-zinc-400 mt-2">
    検証{historyStats?.total ?? 0}回 / 勝率{" "}
    {historyStats?.winRate ?? 0}%
  </p>

  <div className="grid grid-cols-3 gap-3 mt-5">
    <div className="rounded-2xl bg-zinc-900 border border-green-500/40 p-3">
      <p className="text-green-400 text-sm">勝ち</p>
      <p className="text-2xl font-black">
        {historyStats?.win ?? 0}
      </p>
    </div>

    <div className="rounded-2xl bg-zinc-900 border border-red-500/40 p-3">
      <p className="text-red-400 text-sm">負け</p>
      <p className="text-2xl font-black">
        {historyStats?.lose ?? 0}
      </p>
    </div>

    <div className="rounded-2xl bg-zinc-900 border border-cyan-500/40 p-3">
      <p className="text-cyan-400 text-sm">勝率</p>
      <p className="text-2xl font-black">
        {historyStats?.winRate ?? 0}%
      </p>
    </div>
  </div>

  <p className="text-sm text-zinc-400 mt-4 leading-relaxed">
    {historyStats && historyStats.total < 10
      ? "まだ検証数が少ないため、AIは学習中です。"
      : historyStats && historyStats.winRate >= 70
      ? "この銘柄は過去実績が良く、AIが得意な可能性があります。"
      : historyStats && historyStats.winRate < 50
      ? "この銘柄は過去実績が弱く、慎重に見るべきです。"
      : "標準的な成績です。今後のデータ蓄積で精度を高めます。"}
  </p>
</section>

      <section className="rounded-3xl border border-cyan-500/50 bg-zinc-950 p-5 mb-5">
        <p className="text-cyan-400 text-sm">AI学習レベル</p>

        <div className="rounded-2xl border border-orange-500/50 p-5 mt-4 text-center">
          <p className="text-yellow-300">AIランキング</p>
          <p className="text-5xl font-black text-yellow-300">
            1位
          </p>
          <p className="text-zinc-400">/189銘柄中</p>
        </div>

        <div className="mt-5">
          <p className="text-cyan-300 text-3xl font-black">
            Lv1 見習いAI 🥚
          </p>
          <div className="w-full h-3 bg-zinc-800 rounded-full mt-3">
            <div className="h-3 bg-cyan-400 rounded-full w-1/5" />
          </div>
          <p className="text-zinc-400 mt-2">
            次のレベルまであと10件
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-700 bg-zinc-950 p-5">
        <div className="flex justify-between">
          <div>
            <p className="text-zinc-400 text-sm">
              SIGNALX AI ANALYSIS
            </p>
            <h2 className="text-4xl font-black">
              {signal.name}
            </h2>
            <p className="text-zinc-400">CODE {signal.code}</p>
          </div>

          <div className="text-right">
            <p className="text-zinc-400 text-sm">AI POWER</p>
            <p className="text-6xl font-black text-cyan-400">
              {power}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-red-500/60 p-5">
          <p className="text-zinc-400 text-sm">
            AI FINAL JUDGE
          </p>
          <p className="text-5xl font-black text-red-300">
            {judge}
          </p>
          <p className="text-zinc-300 mt-2">
            AIは有力候補と判断。タイミング監視。
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-red-500/60 p-5">
          <p className="text-zinc-400 text-sm">
            AI TRADE DECISION
          </p>
          <p className="text-4xl font-black text-red-300">
            {decision}
          </p>
          <p className="text-zinc-300 mt-2">
            押し目・継続監視
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-500/60 p-5">
          <p className="text-zinc-400 text-sm">
            過去実績勝率
          </p>
          <p className="text-5xl font-black text-cyan-400">
            {historyStats?.winRate ?? 0}%
          </p>
          <p className="text-zinc-400 mt-2">
            検証 {historyStats?.total ?? 0}件 / 勝ち{" "}
            {historyStats?.win ?? 0}件 / 負け{" "}
            {historyStats?.lose ?? 0}件
          </p>
        </div>
        <div className="mt-5 rounded-2xl border border-yellow-500/50 p-5">
  <p className="text-yellow-400 text-sm">
    AI評価
  </p>

  <p className="text-3xl font-black text-yellow-300 mt-2">
    {
      (historyStats?.total ?? 0) >= 10 &&
      (historyStats?.winRate ?? 0) >= 70
        ? "🔥 得意銘柄"
        : (historyStats?.total ?? 0) >= 10 &&
          (historyStats?.winRate ?? 0) < 50
        ? "⚠️ 苦手銘柄"
        : "📚 学習中"
    }
  </p>

  <p className="text-zinc-400 mt-2">
    {
      (historyStats?.total ?? 0) >= 10 &&
      (historyStats?.winRate ?? 0) >= 70
        ? "AIが高勝率を記録しています"
        : (historyStats?.total ?? 0) >= 10 &&
         (historyStats?.winRate ?? 0) < 50
        ? "AIとの相性が悪い銘柄です"
        : "データを蓄積しています"
    }
  </p>
</div>

        <div className="mt-5 rounded-2xl border border-green-500/50 p-5">
          <p className="text-green-400 text-sm">AI WIN RATE</p>

          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="rounded-xl bg-zinc-900 p-4">
              <p className="text-zinc-400 text-sm">
                30分後勝率
              </p>
              <p className="text-4xl font-black text-green-400">
                88%
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900 p-4">
              <p className="text-zinc-400 text-sm">
                1時間後勝率
              </p>
              <p className="text-4xl font-black text-cyan-400">
                83%
              </p>
            </div>
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}