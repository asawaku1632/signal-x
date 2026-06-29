"use client";

import Link from "next/link";
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
  if (power >= 80) return "買い候補";
  if (power >= 75) return "押し目待ち";
  if (power >= 65) return "様子見";
  return "見送り";
}

function getJudgeColor(power: number) {
  if (power >= 80) return "text-green-700 bg-green-100 border-green-300";
  if (power >= 75) return "text-blue-700 bg-blue-100 border-blue-300";
  if (power >= 65) return "text-yellow-700 bg-yellow-100 border-yellow-300";
  return "text-red-700 bg-red-100 border-red-300";
}

function getPowerColor(power: number) {
  if (power >= 90) return "border-purple-500 bg-purple-50 text-purple-600";
  if (power >= 80) return "border-green-500 bg-green-50 text-green-600";
  if (power >= 70) return "border-blue-500 bg-blue-50 text-blue-600";
  if (power >= 60) return "border-yellow-500 bg-yellow-50 text-yellow-600";
  return "border-red-500 bg-red-50 text-red-600";
}

function getPowerBarColor(power: number) {
  if (power >= 90) return "bg-purple-500";
  if (power >= 80) return "bg-green-500";
  if (power >= 70) return "bg-blue-500";
  if (power >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

function getPowerBars(power: number) {
  const filled = Math.round(power / 10);
  return Array.from({ length: 10 }, (_, index) => index < filled);
}

function getRankStyle(rank: number) {
  if (rank === 1) return "bg-yellow-400 text-white";
  if (rank <= 10) return "bg-green-500 text-white";
  if (rank <= 50) return "bg-blue-500 text-white";
  return "bg-slate-300 text-white";
}

function getRankLabel(rank: number) {
  if (rank === 1) return " 1位";
  if (rank <= 10) return ` ${rank}位`;
  if (rank <= 50) return ` ${rank}位`;
  return `${rank}位`;
}

function getRsiComment(rsi: number) {
  if (rsi >= 70) return "買われ過ぎ注意";
  if (rsi <= 30) return "反発期待あり";
  return "過熱感は中立";
}

function getRsiColor(rsi: number) {
  if (rsi >= 70) return "text-red-600";
  if (rsi <= 30) return "text-green-600";
  return "text-blue-600";
}

function getAiTrust(power: number, total: number, winRate: number) {
  const learningBonus = Math.min(total, 100) * 0.1;
  const winBonus = winRate * 0.2;
  const trust = Math.round(power * 0.7 + learningBonus + winBonus);

  return Math.min(trust, 99);
}

function getRankPercent(rank: number, total: number) {
  if (!rank || !total) return "-";
  return `${((rank / total) * 100).toFixed(1)}%`;
}

function buildAiComments({
  reason,
  power,
  judge,
  rsi,
  volumeRatio,
  changePercent,
  takeProfit,
  stopLoss,
}: {
  reason?: string;
  power: number;
  judge: string;
  rsi: number;
  volumeRatio: number;
  changePercent: number;
  takeProfit: number;
  stopLoss: number;
}) {
  const comments: {
    icon: string;
    title: string;
    body: string;
  }[] = [];

  comments.push({
    icon: "🤖",
    title: "AI判断",
    body: `${reason || "AI理由なし"}。AI POWERは${power}で、現在の判定は「${judge}」です。`,
  });

  comments.push({
    icon: "📊",
    title: "RSI",
    body:
      rsi >= 70
        ? `RSIは${rsi}で高めです。買われ過ぎに注意しましょう。`
        : rsi <= 30
        ? `RSIは${rsi}で低めです。反発の可能性があります。`
        : `RSIは${rsi}で、過熱感は中立です。`,
  });

  comments.push({
    icon: "📈",
    title: "出来高",
    body:
      volumeRatio >= 2
        ? `出来高倍率は${volumeRatio}倍で、出来高が急増しています。`
        : volumeRatio >= 1.3
        ? `出来高倍率は${volumeRatio}倍で、やや注目されています。`
        : `出来高倍率は${volumeRatio}倍です。`,
  });

  comments.push({
    icon: "⚡",
    title: "値動き",
    body:
      changePercent >= 3
        ? `本日の変化率は+${changePercent}%です。急騰気味なので飛び乗り注意です。`
        : changePercent > 0
        ? `本日の変化率は+${changePercent}%です。上昇基調です。`
        : changePercent < 0
        ? `本日の変化率は${changePercent}%です。下落中のため慎重に見ましょう。`
        : "本日の変化率は0%付近です。方向感を確認しましょう。",
  });

  comments.push({
    icon: "🎯",
    title: "売買ライン",
    body: `利確目安は${yen(takeProfit)}、損切目安は${yen(stopLoss)}です。`,
  });

  return comments;
}

export default function AnalysisPage() {
  const params = useParams();
  const code = String(params.code);

  const [signal, setSignal] = useState<Signal | null>(null);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiRank, setAiRank] = useState(0);
  const [totalRank, setTotalRank] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const fetchSignal = async () => {
      try {
        const scanRes = await fetch("/api/scan?limit=1000", {
          cache: "no-store",
        });

        const scanJson = await scanRes.json();
        const stocks: Signal[] = scanJson.stocks || [];

        const target = stocks.find((item) => item.code === code) || null;
        setSignal(target);

        const rank = stocks.findIndex((item) => item.code === code) + 1;
        setAiRank(rank);
        setTotalRank(scanJson.totalStockList || stocks.length);

        const historyRes = await fetch(`/api/learning/stats/${code}`, {
          cache: "no-store",
        });

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

  useEffect(() => {
    const saved = localStorage.getItem("signalx-favorites");
    const favorites: string[] = saved ? JSON.parse(saved) : [];

    setIsFavorite(favorites.includes(code));
  }, [code]);

  const toggleFavorite = () => {
    const saved = localStorage.getItem("signalx-favorites");
    const favorites: string[] = saved ? JSON.parse(saved) : [];

    let updated: string[];

    if (favorites.includes(code)) {
      updated = favorites.filter((item) => item !== code);
      setIsFavorite(false);
    } else {
      updated = [...favorites, code];
      setIsFavorite(true);
    }

    localStorage.setItem("signalx-favorites", JSON.stringify(updated));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-slate-900 p-4">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="font-bold text-slate-500">
              分析データを読み込み中...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!signal) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-slate-900 p-4">
        <div className="mx-auto max-w-md">
          <Link href="/today-market" className="text-blue-600 font-black">
            ← 今日の市場へ戻る
          </Link>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm mt-4">
            <h1 className="text-2xl font-black">銘柄が見つかりません</h1>
            <p className="text-slate-500 mt-2">CODE {code}</p>
          </div>
        </div>
      </main>
    );
  }

  const power = getPower(signal);
  const judge = getJudge(power);

  const takeProfit = signal.takeProfit ?? Math.round(signal.price * 1.03);
  const stopLoss = signal.stopLoss ?? Math.round(signal.price * 0.98);

  const requiredMoney = signal.price * 100;
  const profitYen = (takeProfit - signal.price) * 100;
  const lossYen = (signal.price - stopLoss) * 100;

  const rsi = signal.rsi ?? 50;
  const volumeRatio = signal.volumeRatio ?? 1;
  const changePercent = signal.changePercent ?? 0;

  const total = historyStats?.total ?? 0;
  const win = historyStats?.win ?? 0;
  const lose = historyStats?.lose ?? 0;
  const hold = historyStats?.hold ?? Math.max(total - win - lose, 0);
  const winRate = historyStats?.winRate ?? 0;

  const profitRate =
    signal.price > 0 ? ((takeProfit - signal.price) / signal.price) * 100 : 0;

  const lossRate =
    signal.price > 0 ? ((signal.price - stopLoss) / signal.price) * 100 : 0;

  const aiTrust = getAiTrust(power, total, winRate);
  const rankPercent = getRankPercent(aiRank, totalRank);

  const aiComments = buildAiComments({
    reason: signal.reason,
    power,
    judge,
    rsi,
    volumeRatio,
    changePercent,
    takeProfit,
    stopLoss,
  });

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="flex items-center justify-between mb-4">
          <Link
            href="/today-market"
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-2xl"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.22em] text-slate-500">
              AI ANALYSIS
            </div>
          </div>

          <button
            onClick={toggleFavorite}
            className={`w-11 h-11 rounded-2xl shadow flex items-center justify-center text-2xl transition ${
              isFavorite
                ? "bg-yellow-400 text-white"
                : "bg-white text-yellow-500"
            }`}
          >
            {isFavorite ? "★" : "☆"}
          </button>
        </header>

        <section className="rounded-[24px] bg-gradient-to-br from-white to-blue-50 border border-blue-200 p-4 mb-4 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-sm font-black text-blue-600">AI銘柄分析</p>
              <h1 className="text-4xl font-black leading-tight mt-1">
                {signal.code}
              </h1>
              <p className="text-2xl font-black">{signal.name}</p>
            </div>

            <div
              className={`px-3 py-2 rounded-xl border font-black text-sm ${getJudgeColor(
                power
              )}`}
            >
              {judge}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-2xl bg-white border border-slate-100 p-4 text-center">
              <p className="text-xs font-black text-slate-500">AI POWER</p>

              <div
                className={`relative mx-auto mt-3 w-24 h-24 rounded-full border-[10px] flex items-center justify-center ${getPowerColor(
                  power
                )}`}
              >
                <div>
                  <p className="text-4xl font-black leading-none">{power}</p>
                  <p className="text-[10px] text-slate-400 font-bold">/100</p>
                </div>
              </div>

              <div className="flex justify-center gap-1 mt-3">
                {getPowerBars(power).map((filled, index) => (
                  <span
                    key={index}
                    className={`w-2 h-5 rounded-full ${
                      filled ? getPowerBarColor(power) : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-100 p-4 text-center">
              <p className="text-xs font-black text-slate-500">AI順位</p>

              <div
                className={`mx-auto mt-3 w-24 h-24 rounded-full flex items-center justify-center ${getRankStyle(
                  aiRank
                )}`}
              >
                <p className="text-3xl font-black">{getRankLabel(aiRank)}</p>
              </div>

              <p className="text-xs text-slate-400 font-bold mt-3">
                /{totalRank}銘柄中
              </p>
              <p className="text-xs text-yellow-600 font-black mt-1">
                上位 {rankPercent}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-green-50 border border-green-100 p-4 text-center">
            <p className="text-xs font-black text-slate-500">AI信頼度</p>
            <p className="text-4xl font-black text-green-600 mt-1">
              {aiTrust}%
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              AI POWER・勝率・検証数から算出
            </p>
          </div>
        </section>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">💰 価格情報</h2>

          <div className="grid grid-cols-2 gap-3">
            <Info label="現在値" value={yen(signal.price)} />
            <Info label="必要資金" value={yen(requiredMoney)} />
            <Info
              label="本日変化率"
              value={`${changePercent}%`}
              green={changePercent >= 0}
            />
            <Info label="出来高倍率" value={`${volumeRatio}倍`} />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-[24px] bg-green-50 border border-green-300 p-4 shadow-sm text-center">
            <p className="text-sm font-black text-green-700">🎯 利確目標</p>
            <p className="text-3xl font-black text-green-600 mt-2">
              {yen(takeProfit)}
            </p>
            <p className="text-xs font-bold text-green-700 mt-1">
              +{profitRate.toFixed(2)}% / +{yen(profitYen)}
            </p>
          </div>

          <div className="rounded-[24px] bg-red-50 border border-red-300 p-4 shadow-sm text-center">
            <p className="text-sm font-black text-red-700">🛡 損切ライン</p>
            <p className="text-3xl font-black text-red-600 mt-2">
              {yen(stopLoss)}
            </p>
            <p className="text-xs font-bold text-red-700 mt-1">
              -{lossRate.toFixed(2)}% / -{yen(lossYen)}
            </p>
          </div>
        </section>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">📊 テクニカル</h2>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
              <p className="text-xs font-black text-slate-500">RSI</p>
              <p className={`text-xl font-black mt-1 ${getRsiColor(rsi)}`}>
                {rsi}
              </p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">
                {getRsiComment(rsi)}
              </p>
            </div>

            <Mini label="出来高" value={`${volumeRatio}倍`} />
            <Mini label="変化率" value={`${changePercent}%`} />
          </div>
        </section>

        <section className="rounded-[24px] bg-blue-50 border border-blue-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">💬 AIコメント</h2>

          <div className="space-y-3">
            {aiComments.map((comment) => (
              <div
                key={`${comment.title}-${comment.body}`}
                className="rounded-2xl bg-white/80 border border-blue-100 p-3"
              >
                <p className="text-sm font-black text-blue-700">
                  {comment.icon} {comment.title}
                </p>
                <p className="text-sm leading-6 font-bold mt-1">
                  {comment.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Link
          href={`/chart/${signal.code}`}
          className="block rounded-[24px] bg-slate-900 text-white p-5 mb-4 shadow-sm active:scale-[0.98] transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-blue-300">
                📈 AIチャート分析
              </p>
              <p className="text-2xl font-black mt-1">チャートを見る</p>
              <p className="text-xs text-slate-300 font-bold mt-1">
                利確ライン・損切ライン・AI判断を確認
              </p>
            </div>
            <div className="text-3xl">›</div>
          </div>
        </Link>

        <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">🧠 AI学習データ</h2>

          <div className="grid grid-cols-4 gap-2">
            <Mini label="検証" value={`${total}回`} />
            <Mini label="WIN" value={`${win}`} />
            <Mini label="LOSE" value={`${lose}`} />
            <Mini label="HOLD" value={`${hold}`} />
          </div>

          <div className="mt-3 rounded-2xl bg-blue-50 border border-blue-100 p-4 text-center">
            <p className="text-xs font-black text-slate-500">AI勝率</p>
            <p className="text-4xl font-black text-blue-600 mt-1">
              {winRate}%
            </p>
          </div>

          <p className="text-sm text-slate-500 font-bold leading-6 mt-4">
            {total < 10
              ? "まだ検証数が少ないため、AIは学習中です。"
              : winRate >= 70
              ? "この銘柄は過去実績が良く、AIが得意な可能性があります。"
              : winRate < 50
              ? "この銘柄は過去実績が弱く、慎重に見るべきです。"
              : "標準的な成績です。今後のデータ蓄積で精度を高めます。"}
          </p>
        </section>
      </div>
    </main>
  );
}

function Info({
  label,
  value,
  green,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={`text-xl font-black mt-1 ${green ? "text-red-500" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="text-xl font-black mt-1">{value}</p>
    </div>
  );
}