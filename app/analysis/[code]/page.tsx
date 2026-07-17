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
  trend?: string;
  patternSignal?: string;
  patternScore?: number;
  supportPrice?: number | null;
  resistancePrice?: number | null;
  supportDistancePercent?: number | null;
  resistanceDistancePercent?: number | null;
  supportResistanceStatus?:
    | "BREAKOUT"
    | "NEAR_RESISTANCE"
    | "NEAR_SUPPORT"
    | "BETWEEN_LEVELS"
    | "BREAKDOWN_RISK"
    | "NO_DATA";
  breakoutExpectation?: number;
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

type PerformanceSummary = {
  success: boolean;
  stock: {
    code: string;
    name: string;
  };
  recent3Days: {
    date: string;
    result: "WIN" | "LOSE" | "HOLD";
    profitYen: number;
  }[];
  summary30Days: {
    total: number;
    judgedTotal: number;
    wins: number;
    losses: number;
    holds: number;
    winRate: number;
    averageProfitRate: number;
    averageLossRate: number;
    totalProfitYen: number;
  };
  reliability: {
    score: number;
    rank: string;
    currentWinStreak: number;
    maxWinStreak: number;
    maxLoseStreak: number;
  };
};

type AiComment = {
  icon: string;
  title: string;
  body: string;
};

function yen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function levelYen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";

  const rounded = Number(value.toFixed(1));

  return `${rounded.toLocaleString("ja-JP", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })}円`;
}

function getPower(signal: Signal | null) {
  return signal?.score ?? signal?.aiPower ?? 0;
}

function getJudge(power: number) {
  if (power >= 95) return "大本命";
  if (power >= 85) return "買い候補";
  if (power >= 75) return "押し目待ち";
  if (power >= 65) return "様子見";
  return "見送り";
}

function getJudgeIcon(power: number) {
  if (power >= 95) return "👑";
  if (power >= 85) return "🔥";
  if (power >= 75) return "🟢";
  if (power >= 65) return "🟡";
  return "🔴";
}

function getJudgeColor(power: number) {
  if (power >= 95) return "border-yellow-200 bg-yellow-50 text-yellow-700";
  if (power >= 85) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (power >= 75) return "border-blue-200 bg-blue-50 text-blue-700";
  if (power >= 65) return "border-yellow-200 bg-yellow-50 text-yellow-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function getPowerColor(power: number) {
  if (power >= 95) return "text-yellow-500";
  if (power >= 85) return "text-emerald-500";
  if (power >= 75) return "text-blue-500";
  if (power >= 65) return "text-yellow-500";
  return "text-red-500";
}

function getPowerBarColor(power: number) {
  if (power >= 95) return "bg-yellow-400";
  if (power >= 85) return "bg-emerald-500";
  if (power >= 75) return "bg-blue-500";
  if (power >= 65) return "bg-yellow-500";
  return "bg-red-500";
}

function getPowerBars(power: number) {
  const filled = Math.round(power / 10);
  return Array.from({ length: 10 }, (_, index) => index < filled);
}

function getRankStyle(rank: number) {
  if (rank === 1) return "bg-yellow-400 text-white shadow-yellow-200";
  if (rank <= 10) return "bg-emerald-500 text-white shadow-emerald-200";
  if (rank <= 50) return "bg-blue-500 text-white shadow-blue-200";
  return "bg-slate-300 text-white shadow-slate-200";
}

function getRankLabel(rank: number) {
  if (!rank) return "-";
  return `${rank}位`;
}

function getRsiComment(rsi: number) {
  if (rsi >= 70) return "買われ過ぎ注意";
  if (rsi <= 30) return "反発期待あり";
  return "過熱感は中立";
}

function getRsiColor(rsi: number) {
  if (rsi >= 70) return "text-red-600";
  if (rsi <= 30) return "text-emerald-600";
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

function getPatternText(pattern?: string) {
  if (pattern === "W_BOTTOM_BREAK") return "Wボトム突破";
  if (pattern === "W_BOTTOM") return "Wボトム候補";
  return "通常";
}

function getSupportResistanceLabel(status?: Signal["supportResistanceStatus"]) {
  if (status === "BREAKOUT") return "抵抗線を突破";
  if (status === "NEAR_RESISTANCE") return "抵抗線付近";
  if (status === "NEAR_SUPPORT") return "支持線付近";
  if (status === "BREAKDOWN_RISK") return "支持線割れ注意";
  if (status === "BETWEEN_LEVELS") return "支持線と抵抗線の間";
  return "判定データなし";
}

function getSupportResistanceStyle(status?: Signal["supportResistanceStatus"]) {
  if (status === "BREAKOUT") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "NEAR_SUPPORT") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "NEAR_RESISTANCE") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "BREAKDOWN_RISK") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getBreakoutLabel(expectation: number) {
  if (expectation >= 75) return "かなり高い";
  if (expectation >= 55) return "高め";
  if (expectation >= 35) return "中程度";
  if (expectation >= 20) return "低め";
  return "かなり低い";
}

function getSupportResistanceComment({
  status,
  supportPrice,
  resistancePrice,
  supportDistancePercent,
  resistanceDistancePercent,
  breakoutExpectation,
}: {
  status?: Signal["supportResistanceStatus"];
  supportPrice?: number | null;
  resistancePrice?: number | null;
  supportDistancePercent?: number | null;
  resistanceDistancePercent?: number | null;
  breakoutExpectation: number;
}) {
  if (!supportPrice && !resistancePrice) {
    return "支持線・抵抗線を判定できるだけの価格データがありません。";
  }

  const supportText =
    supportDistancePercent !== undefined &&
    supportDistancePercent !== null &&
    supportPrice
      ? `支持線は${levelYen(supportPrice)}で、現在値から約${supportDistancePercent.toFixed(
          2,
        )}%下です。`
      : "";

  const resistanceText =
    resistanceDistancePercent !== undefined &&
    resistanceDistancePercent !== null &&
    resistancePrice
      ? `抵抗線は${levelYen(
          resistancePrice,
        )}で、現在値から約${resistanceDistancePercent.toFixed(2)}%上です。`
      : "";

  let actionText =
    "現在値は支持線と抵抗線の間にあります。値動きの方向を確認しましょう。";

  if (status === "BREAKOUT") {
    actionText =
      "抵抗線を上抜けています。出来高を伴って上昇が続くか確認しましょう。";
  } else if (status === "NEAR_RESISTANCE") {
    actionText =
      "抵抗線が近いため、高値追いには注意が必要です。突破できるかを見極めましょう。";
  } else if (status === "NEAR_SUPPORT") {
    actionText =
      "支持線付近です。下げ止まり候補ですが、反発を確認してから判断しましょう。";
  } else if (status === "BREAKDOWN_RISK") {
    actionText =
      "支持線を下回る可能性があります。損切ラインを意識して慎重に見ましょう。";
  }

  return `${supportText}${resistanceText}${actionText} ブレイク期待度は${breakoutExpectation}%（${getBreakoutLabel(
    breakoutExpectation,
  )}）です。`;
}

function getRiskReward(profitYen: number, lossYen: number) {
  if (lossYen <= 0) return "-";
  return `${(profitYen / lossYen).toFixed(1)}`;
}

function getLearningMessage(total: number, winRate: number) {
  if (total < 10) {
    return "まだ検証数が少ないため、AIは学習中です。判断材料のひとつとして見ましょう。";
  }

  if (winRate >= 70) {
    return "この銘柄は過去実績が良く、AIが得意な可能性があります。";
  }

  if (winRate < 50) {
    return "この銘柄は過去実績が弱く、慎重に見るべきです。";
  }

  return "標準的な成績です。今後のデータ蓄積で精度を高めます。";
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
  supportPrice,
  resistancePrice,
  supportDistancePercent,
  resistanceDistancePercent,
  supportResistanceStatus,
  breakoutExpectation,
}: {
  reason?: string;
  power: number;
  judge: string;
  rsi: number;
  volumeRatio: number;
  changePercent: number;
  takeProfit: number;
  stopLoss: number;
  supportPrice?: number | null;
  resistancePrice?: number | null;
  supportDistancePercent?: number | null;
  resistanceDistancePercent?: number | null;
  supportResistanceStatus?: Signal["supportResistanceStatus"];
  breakoutExpectation: number;
}) {
  const comments: AiComment[] = [];

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
        ? `出来高倍率は${volumeRatio}倍で、出来高が急増しています。注目度が高い状態です。`
        : volumeRatio >= 1.3
          ? `出来高倍率は${volumeRatio}倍で、やや注目されています。`
          : `出来高倍率は${volumeRatio}倍です。急な過熱感は控えめです。`,
  });

  comments.push({
    icon: "⚡",
    title: "値動き",
    body:
      changePercent >= 3
        ? `本日の変化率は+${changePercent}%です。急騰気味なので飛び乗りには注意しましょう。`
        : changePercent > 0
          ? `本日の変化率は+${changePercent}%です。上昇基調です。`
          : changePercent < 0
            ? `本日の変化率は${changePercent}%です。下落中のため慎重に見ましょう。`
            : "本日の変化率は0%付近です。方向感を確認しましょう。",
  });

  comments.push({
    icon: "🧱",
    title: "支持線・抵抗線",
    body: getSupportResistanceComment({
      status: supportResistanceStatus,
      supportPrice,
      resistancePrice,
      supportDistancePercent,
      resistanceDistancePercent,
      breakoutExpectation,
    }),
  });

  comments.push({
    icon: "🎯",
    title: "売買ライン",
    body: `利確目安は${yen(takeProfit)}、損切目安は${yen(stopLoss)}です。利益幅と損失幅を確認してから判断しましょう。`,
  });

  return comments;
}

export default function AnalysisPage() {
  const params = useParams();
  const code = String(params.code);

  const [signal, setSignal] = useState<Signal | null>(null);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [performance, setPerformance] =
    useState<PerformanceSummary | null>(null);
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
        const stocks: Signal[] = Array.isArray(scanJson)
          ? scanJson
          : scanJson.stocks || [];

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

        const performanceRes = await fetch(
          `/api/performance/stock/${code}`,
          {
            cache: "no-store",
          },
        );

        if (performanceRes.ok) {
          const performanceJson = await performanceRes.json();
          setPerformance(performanceJson);
        }
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
      <main className="min-h-screen bg-[#030712] p-4 text-white">
        <div className="mx-auto max-w-md pt-10">
          <div className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/90 p-6 text-center shadow-2xl shadow-blue-950/40">
            <p className="text-2xl font-black">分析データを読み込み中...</p>
            <p className="mt-2 text-sm font-bold text-slate-400">
              AI POWER・利確ライン・学習データを取得しています。
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!signal) {
    return (
      <main className="min-h-screen bg-[#030712] p-4 text-white">
        <div className="mx-auto max-w-md pt-5">
          <Link href="/scan-mobile" className="font-black text-blue-600">
            ← AIランキングへ戻る
          </Link>

          <div className="mt-4 rounded-[2rem] border border-white bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-black">銘柄が見つかりません</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">CODE {code}</p>
          </div>
        </div>
      </main>
    );
  }

  const power = getPower(signal);
  const judge = getJudge(power);
  const judgeIcon = getJudgeIcon(power);

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
  const riskReward = getRiskReward(profitYen, lossYen);

  const supportPrice = signal.supportPrice ?? null;
  const resistancePrice = signal.resistancePrice ?? null;
  const supportDistancePercent = signal.supportDistancePercent ?? null;
  const resistanceDistancePercent = signal.resistanceDistancePercent ?? null;
  const supportResistanceStatus =
    signal.supportResistanceStatus ?? "NO_DATA";
  const breakoutExpectation = signal.breakoutExpectation ?? 0;

  const aiComments = buildAiComments({
    reason: signal.reason,
    power,
    judge,
    rsi,
    volumeRatio,
    changePercent,
    takeProfit,
    stopLoss,
    supportPrice,
    resistancePrice,
    supportDistancePercent,
    resistanceDistancePercent,
    supportResistanceStatus,
    breakoutExpectation,
  });

  return (
    <main className="min-h-screen bg-[#030712] pb-28 text-white">
      <div className="mx-auto w-full max-w-md px-4 pt-4 md:max-w-6xl md:px-6">
        <header className="sticky top-0 z-30 -mx-4 border-b border-white/10 bg-[#030712]/90 px-4 pb-3 pt-3 backdrop-blur-xl md:-mx-6 md:px-6">
          <div className="flex items-center justify-between">
            <Link
              href="/scan-mobile"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-2xl font-black text-white shadow-sm transition hover:bg-white/10 active:scale-95"
              aria-label="AIランキングへ戻る"
            >
              ‹
            </Link>

            <div className="text-center">
              <div className="text-3xl font-black tracking-tight">
                SIGNAL<span className="text-cyan-400">X</span>
              </div>
              <div className="text-[10px] font-black tracking-[0.22em] text-slate-400">
                AI ANALYSIS
              </div>
            </div>

            <button
              onClick={toggleFavorite}
              className={`grid h-11 w-11 place-items-center rounded-2xl text-2xl shadow-sm transition active:scale-95 ${
                isFavorite
                  ? "bg-yellow-400 text-slate-950 shadow-yellow-500/20"
                  : "border border-white/10 bg-white/5 text-yellow-300 hover:bg-white/10"
              }`}
              aria-label="お気に入り"
            >
              {isFavorite ? "★" : "☆"}
            </button>
          </div>
        </header>

        <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-cyan-400/25 bg-gradient-to-br from-[#071226] via-[#071a38] to-[#130b3d] p-[1px] shadow-2xl shadow-blue-950/60">
          <div className="relative overflow-hidden rounded-[calc(2rem-1px)] bg-[radial-gradient(circle_at_80%_15%,rgba(124,58,237,0.34),transparent_32%),radial-gradient(circle_at_15%_10%,rgba(14,165,233,0.22),transparent_28%),linear-gradient(135deg,#06101f_0%,#071a38_55%,#16073b_100%)] p-5 md:p-7">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-14 bottom-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

            <div className="relative grid gap-5 md:grid-cols-[1fr_250px] md:items-stretch">
              <div>
                <div className="flex items-start gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-yellow-300/30 bg-yellow-400/10 text-4xl shadow-lg shadow-yellow-950/20">
                    {judgeIcon}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-5xl font-black leading-none tracking-tight md:text-6xl">
                        {signal.code}
                      </h1>
                      <span className={`rounded-xl border px-3 py-1 text-sm font-black ${getJudgeColor(power)}`}>
                        {judge}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-2xl font-black text-white md:text-3xl">
                      {signal.name}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-sm font-bold leading-7 text-blue-100 md:text-base">
                  {signal.reason || "AI理由なし"}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  <HeroMetric
                    icon="🤖"
                    label="AI順位"
                    value={`${getRankLabel(aiRank)} / ${totalRank.toLocaleString()}銘柄中`}
                    tone="violet"
                  />
                  <HeroMetric
                    icon="🛡"
                    label="現在信頼度"
                    value={`${aiTrust}%`}
                    tone="red"
                  />
                  <HeroMetric
                    icon="🏆"
                    label="上位"
                    value={rankPercent === "-" ? "-" : `上位 ${rankPercent}`}
                    tone="amber"
                  />
                </div>
              </div>

              <div className="relative flex min-h-52 flex-col items-center justify-center overflow-hidden rounded-[1.75rem] border border-cyan-300/60 bg-gradient-to-br from-blue-600 via-indigo-600 to-fuchsia-600 p-5 text-center shadow-[0_0_35px_rgba(59,130,246,0.35)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(255,255,255,0.24),transparent_25%)]" />
                <p className="relative text-xl font-black tracking-wide text-blue-50">
                  AI POWER
                </p>
                <p className="relative mt-1 text-7xl font-black leading-none text-white md:text-8xl">
                  {power}
                </p>
                <div className="relative mt-4 h-2.5 w-full overflow-hidden rounded-full bg-black/20">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-white to-fuchsia-200"
                    style={{ width: `${Math.min(Math.max(power, 0), 100)}%` }}
                  />
                </div>
                <p className="relative mt-3 text-xs font-black text-blue-100">
                  AI総合評価スコア
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/80 p-5 shadow-2xl shadow-blue-950/30 backdrop-blur">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-cyan-300">
                PRICE
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">価格情報</h2>
            </div>

            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-300">
              REAL DATA
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <DarkInfo
              icon="💴"
              label="現在値"
              value={yen(signal.price)}
              tone="cyan"
            />
            <DarkInfo
              icon="💰"
              label="必要資金"
              value={yen(requiredMoney)}
              tone="violet"
            />
            <DarkInfo
              icon={changePercent >= 0 ? "↗" : "↘"}
              label="本日変化率"
              value={`${changePercent >= 0 ? "+" : ""}${changePercent}%`}
              tone={changePercent >= 0 ? "red" : "green"}
            />
            <DarkInfo
              icon="📊"
              label="出来高倍率"
              value={`${volumeRatio}倍`}
              tone="amber"
            />
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/80 p-5 shadow-2xl shadow-blue-950/30 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-cyan-300">
                SUPPORT & RESISTANCE
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">支持線・抵抗線</h2>
            </div>

            <div
              className={`rounded-2xl border px-3 py-2 text-center text-xs font-black ${getSupportResistanceStyle(
                supportResistanceStatus,
              )}`}
            >
              {getSupportResistanceLabel(supportResistanceStatus)}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="absolute bottom-6 left-[31px] top-6 w-px bg-gradient-to-b from-amber-300 via-cyan-300 to-blue-400" />

              <LevelRow
                dotClass="bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.7)]"
                label="抵抗線"
                value={levelYen(resistancePrice)}
                detail={
                  resistanceDistancePercent !== null
                    ? `現在値より +${resistanceDistancePercent.toFixed(2)}%`
                    : "距離データなし"
                }
                valueClass="text-amber-300"
              />

              <LevelRow
                dotClass="bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.8)]"
                label="現在値"
                value={levelYen(signal.price)}
                detail="現在の株価"
                valueClass="text-white"
                featured
              />

              <LevelRow
                dotClass="bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.8)]"
                label="支持線"
                value={levelYen(supportPrice)}
                detail={
                  supportDistancePercent !== null
                    ? `現在値より -${supportDistancePercent.toFixed(2)}%`
                    : "距離データなし"
                }
                valueClass="text-blue-300"
              />
            </div>

            <div className="relative overflow-hidden rounded-[1.75rem] border border-violet-400/25 bg-gradient-to-br from-[#0a1730] via-[#101a45] to-[#351064] p-5 text-center shadow-[0_0_35px_rgba(124,58,237,0.2)]">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-fuchsia-400/20 blur-3xl" />
              <p className="relative text-xs font-black tracking-[0.16em] text-cyan-300">
                BREAKOUT EXPECTATION
              </p>
              <h3 className="relative mt-2 text-xl font-black text-white">
                ブレイク期待度
              </h3>

              <div className="relative mx-auto mt-5 grid h-44 w-44 place-items-center rounded-full bg-[conic-gradient(#22d3ee_0deg,#8b5cf6_calc(var(--score)*3.6deg),rgba(255,255,255,0.08)_calc(var(--score)*3.6deg),rgba(255,255,255,0.08)_360deg)] p-[12px]"
                style={{ "--score": Math.min(Math.max(breakoutExpectation, 0), 100) } as React.CSSProperties}
              >
                <div className="grid h-full w-full place-items-center rounded-full border border-white/10 bg-slate-950">
                  <div>
                    <p className="text-5xl font-black text-white">
                      {breakoutExpectation}
                      <span className="text-lg text-cyan-300">%</span>
                    </p>
                    <p className="mt-2 text-sm font-black text-violet-200">
                      {getBreakoutLabel(breakoutExpectation)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="relative mt-5 text-xs font-bold leading-6 text-slate-300">
                {getSupportResistanceComment({
                  status: supportResistanceStatus,
                  supportPrice,
                  resistancePrice,
                  supportDistancePercent,
                  resistanceDistancePercent,
                  breakoutExpectation,
                })}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/80 p-5 shadow-2xl shadow-blue-950/30 backdrop-blur">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-cyan-300">
                AI ACTION
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">売買アクション</h2>
            </div>

            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-black text-violet-200">
              RR {riskReward}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_0.85fr]">
            <ActionCard
              icon="🎯"
              label="利確目標"
              price={yen(takeProfit)}
              rate={`+${profitRate.toFixed(2)}%`}
              amount={`+${yen(profitYen)}`}
              tone="profit"
            />

            <ActionCard
              icon="🛡"
              label="損切ライン"
              price={yen(stopLoss)}
              rate={`-${lossRate.toFixed(2)}%`}
              amount={`-${yen(lossYen)}`}
              tone="loss"
            />

            <div className="rounded-[1.5rem] border border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-cyan-500/10 p-4">
              <p className="text-xs font-black text-violet-200">RISK REWARD</p>
              <p className="mt-3 text-4xl font-black text-white">
                1 : {riskReward}
              </p>

              <div className="mt-4 space-y-2">
                <ActionMini label="期待利益" value={`+${yen(profitYen)}`} />
                <ActionMini label="想定損失" value={`-${yen(lossYen)}`} />
              </div>

              <p className="mt-4 text-[11px] font-bold leading-5 text-slate-400">
                利益幅と損失幅を比較して、無理のないエントリーか確認します。
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/80 p-5 shadow-2xl shadow-blue-950/30 backdrop-blur">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-cyan-300">
                TECHNICAL
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">テクニカル</h2>
            </div>

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black text-slate-300">
              LIVE SIGNAL
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            <TechnicalCard
              label="RSI"
              value={`${rsi}`}
              detail={getRsiComment(rsi)}
              tone={rsi >= 70 ? "red" : rsi <= 30 ? "green" : "cyan"}
              meter={Math.min(Math.max(rsi, 0), 100)}
            />

            <TechnicalCard
              label="出来高倍率"
              value={`${volumeRatio}倍`}
              detail={
                volumeRatio >= 2
                  ? "出来高が急増"
                  : volumeRatio >= 1.3
                    ? "やや増加"
                    : "通常水準"
              }
              tone="violet"
              meter={Math.min(volumeRatio * 30, 100)}
            />

            <TechnicalCard
              label="チャート形状"
              value={getPatternText(signal.patternSignal)}
              detail={`パターンスコア ${signal.patternScore ?? 0}`}
              tone="amber"
            />

            <TechnicalCard
              label="トレンド"
              value={signal.trend || "判定中"}
              detail="現在の方向性"
              tone="blue"
            />

            <TechnicalCard
              label="支持線距離"
              value={
                supportDistancePercent !== null
                  ? `-${supportDistancePercent.toFixed(2)}%`
                  : "-"
              }
              detail="下値余地"
              tone="green"
            />

            <TechnicalCard
              label="抵抗線距離"
              value={
                resistanceDistancePercent !== null
                  ? `+${resistanceDistancePercent.toFixed(2)}%`
                  : "-"
              }
              detail="上値余地"
              tone="red"
            />
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-violet-400/20 bg-gradient-to-br from-[#071426] via-[#10163a] to-[#2a0d4f] p-[1px] shadow-2xl shadow-violet-950/40">
          <div className="relative overflow-hidden rounded-[calc(2rem-1px)] bg-slate-950/85 p-5">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

            <div className="relative flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-3xl">
                🤖
              </div>
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-cyan-300">
                  AI COMMENT
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">AIコメント</h2>
              </div>
            </div>

            <div className="relative mt-5 rounded-[1.5rem] border border-cyan-300/15 bg-cyan-400/[0.06] p-5">
              <p className="text-xs font-black text-cyan-300">SIGNALX AI</p>
              <p className="mt-3 text-base font-bold leading-8 text-slate-100">
                {signal.reason || "現在のデータをもとにAIが分析しています。"}
              </p>
            </div>

            <div className="relative mt-4 grid gap-3 md:grid-cols-2">
              {aiComments.slice(1).map((comment) => (
                <div
                  key={`${comment.title}-${comment.body}`}
                  className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.07]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{comment.icon}</span>
                    <p className="text-sm font-black text-white">{comment.title}</p>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-7 text-slate-300">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/80 shadow-2xl shadow-blue-950/30 backdrop-blur">
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 p-5 text-white">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="relative flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-cyan-200">
                  AI PERFORMANCE
                </p>
                <h2 className="mt-2 text-2xl font-black">AI実績</h2>
                <p className="mt-1 text-xs font-bold text-blue-100">
                  過去の判定結果を実データで検証
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center backdrop-blur">
                <p className="text-[10px] font-black text-blue-100">信頼度ランク</p>
                <p className="mt-1 text-2xl font-black">
                  {performance?.reliability.rank ?? "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <DarkPerformanceMini
                label="直近3件"
                value={
                  performance
                    ? `${performance.recent3Days.filter((item) => item.result === "WIN").length}勝${
                        performance.recent3Days.filter(
                          (item) => item.result === "LOSE",
                        ).length
                      }敗`
                    : "集計中"
                }
                tone="cyan"
              />

              <DarkPerformanceMini
                label="累計損益"
                value={
                  performance
                    ? `${performance.summary30Days.totalProfitYen >= 0 ? "+" : ""}${yen(
                        performance.summary30Days.totalProfitYen,
                      )}`
                    : "-"
                }
                tone={
                  (performance?.summary30Days.totalProfitYen ?? 0) >= 0
                    ? "green"
                    : "red"
                }
              />

              <DarkPerformanceMini
                label="30日勝率"
                value={
                  performance
                    ? `${performance.summary30Days.winRate}%`
                    : "-"
                }
                tone="violet"
              />

              <DarkPerformanceMini
                label="実績スコア"
                value={`${performance?.reliability.score ?? "-"}`}
                tone="amber"
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <StreakMini
                label="連勝中"
                value={`${performance?.reliability.currentWinStreak ?? 0}`}
              />
              <StreakMini
                label="最大連勝"
                value={`${performance?.reliability.maxWinStreak ?? 0}`}
              />
              <StreakMini
                label="最大連敗"
                value={`${performance?.reliability.maxLoseStreak ?? 0}`}
              />
            </div>

            <p className="mt-4 text-xs font-bold leading-6 text-slate-400">
              WINは翌日騰落率+2%以上、LOSEは-2%以下で判定。判定数が少ない間はデータ蓄積中として表示します。
            </p>

            <Link
              href={`/analysis/${signal.code}/performance`}
              className="mt-4 flex items-center justify-between rounded-3xl border border-cyan-300/20 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 px-5 py-4 text-white transition hover:brightness-110 active:scale-[0.98]"
            >
              <div>
                <p className="text-xs font-black text-cyan-100">
                  AI PERFORMANCE CENTER
                </p>
                <p className="mt-1 text-lg font-black">詳しいAI実績を見る</p>
              </div>
              <span className="text-3xl">›</span>
            </Link>
          </div>
        </section>

        <Link
          href={`/chart/${signal.code}`}
          aria-label={`${signal.code} ${signal.name}のAIチャート分析を見る`}
          className="group mt-5 block overflow-hidden rounded-[2rem] border border-cyan-300/30 bg-gradient-to-br from-[#04111f] via-[#071d3f] to-[#31105f] p-[1px] shadow-2xl shadow-blue-950/50 transition duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <div className="relative overflow-hidden rounded-[calc(2rem-1px)] bg-[radial-gradient(circle_at_75%_20%,rgba(168,85,247,0.28),transparent_28%),linear-gradient(135deg,#06111f_0%,#08224a_55%,#2d0f5c_100%)] p-5 text-white md:p-6">
            <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />

            <div className="relative grid gap-5 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-3xl">
                    📈
                  </div>
                  <div>
                    <p className="text-[10px] font-black tracking-[0.2em] text-cyan-300">
                      REALTIME AI CHART
                    </p>
                    <h2 className="mt-1 text-2xl font-black">AIチャート分析</h2>
                  </div>
                </div>

                <p className="mt-4 text-sm font-bold leading-7 text-blue-100">
                  5分足から月足まで切り替えながら、利確・損切・支持線・抵抗線をまとめて確認できます。
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {["5m", "15m", "1H", "1D", "1W", "1M"].map((tf) => (
                    <span
                      key={tf}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-slate-200"
                    >
                      {tf}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="grid grid-cols-3 gap-2">
                  <ChartFeature icon="🎯" label="利確" />
                  <ChartFeature icon="🛡" label="損切" />
                  <ChartFeature icon="🧱" label="支持抵抗" />
                </div>

                <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 px-5 py-4 text-center text-lg font-black shadow-lg shadow-blue-950/30 transition group-hover:brightness-110">
                  <span>チャートを見る</span>
                  <span className="text-2xl transition-transform group-hover:translate-x-1">
                    ›
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/80 p-5 shadow-2xl shadow-blue-950/30 backdrop-blur">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-cyan-300">
                AI LEARNING
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">AI学習データ</h2>
            </div>

            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-300">
              AUTO LEARNING
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <LearningCard label="検証" value={`${total}回`} tone="cyan" />
            <LearningCard label="WIN" value={`${win}`} tone="green" />
            <LearningCard label="LOSE" value={`${lose}`} tone="red" />
            <LearningCard label="HOLD" value={`${hold}`} tone="amber" />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
            <div className="rounded-[1.5rem] border border-violet-400/20 bg-violet-400/10 p-5 text-center">
              <p className="text-xs font-black text-violet-200">AI勝率</p>
              <p className="mt-2 text-5xl font-black text-white">{winRate}%</p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black text-cyan-300">AI LEARNING COMMENT</p>
              <p className="mt-3 text-sm font-bold leading-7 text-slate-300">
                {getLearningMessage(total, winRate)}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-amber-400/20 bg-amber-400/10 p-5">
          <p className="text-sm font-black text-amber-300">ご利用前の注意</p>
          <p className="mt-2 text-xs font-bold leading-6 text-amber-100/80">
            SIGNALXは投資判断をサポートする情報提供サービスです。AI判定・スコア・利確/損切ラインは将来の利益を保証するものではありません。最終判断はご自身の責任で行ってください。
          </p>
        </section>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
            <BottomNavItem href="/" icon="🏠" label="Home" />
            <BottomNavItem href="/scan-mobile" icon="📈" label="Scan" />
            <BottomNavItem
              href={`/analysis/${signal.code}`}
              icon="🤖"
              label="AI"
              active
            />
            <BottomNavItem href="/learning" icon="🧠" label="Learn" />
          </div>
        </nav>
      </div>
    </main>
  );
}

function DarkPerformanceMini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "green" | "red" | "violet" | "amber";
}) {
  const toneClass = {
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    red: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  }[tone];

  return (
    <div className={`rounded-[1.35rem] border p-4 text-center ${toneClass}`}>
      <p className="text-[10px] font-black opacity-80">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function StreakMini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function ChartFeature({
  icon,
  label,
}: {
  icon: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-3 text-center">
      <p className="text-lg">{icon}</p>
      <p className="mt-1 text-[10px] font-black text-slate-300">{label}</p>
    </div>
  );
}

function LearningCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "green" | "red" | "amber";
}) {
  const toneClass = {
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    red: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border p-4 text-center ${toneClass}`}>
      <p className="text-xs font-black opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function ActionCard({
  icon,
  label,
  price,
  rate,
  amount,
  tone,
}: {
  icon: string;
  label: string;
  price: string;
  rate: string;
  amount: string;
  tone: "profit" | "loss";
}) {
  const style =
    tone === "profit"
      ? "border-emerald-400/20 bg-emerald-400/10"
      : "border-rose-400/20 bg-rose-400/10";

  const accent = tone === "profit" ? "text-emerald-300" : "text-rose-300";

  return (
    <div className={`rounded-[1.5rem] border p-4 ${style}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <p className={`text-sm font-black ${accent}`}>{label}</p>
        </div>
        <span className={`rounded-full bg-black/20 px-2.5 py-1 text-xs font-black ${accent}`}>
          {rate}
        </span>
      </div>

      <p className="mt-4 text-3xl font-black text-white">{price}</p>
      <p className={`mt-2 text-base font-black ${accent}`}>{amount}</p>
    </div>
  );
}

function ActionMini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
      <span className="text-[10px] font-black text-slate-400">{label}</span>
      <span className="text-xs font-black text-white">{value}</span>
    </div>
  );
}

function TechnicalCard({
  label,
  value,
  detail,
  tone,
  meter,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "violet" | "amber" | "blue" | "green" | "red";
  meter?: number;
}) {
  const toneClass = {
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-300",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    red: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border p-4 ${toneClass}`}>
      <p className="text-xs font-black opacity-80">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 min-h-5 text-[10px] font-bold text-slate-400">{detail}</p>

      {meter !== undefined && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/20">
          <div
            className="h-full rounded-full bg-current"
            style={{ width: `${Math.min(Math.max(meter, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function DarkInfo({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "cyan" | "violet" | "red" | "green" | "amber";
}) {
  const toneClass = {
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    red: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <p className="text-xs font-black opacity-80">{label}</p>
      </div>
      <p className="mt-3 text-xl font-black text-white md:text-2xl">{value}</p>
    </div>
  );
}

function LevelRow({
  dotClass,
  label,
  value,
  detail,
  valueClass,
  featured = false,
}: {
  dotClass: string;
  label: string;
  value: string;
  detail: string;
  valueClass: string;
  featured?: boolean;
}) {
  return (
    <div className={`relative flex items-center gap-4 ${featured ? "my-5" : ""}`}>
      <span className={`relative z-10 h-4 w-4 shrink-0 rounded-full ${dotClass}`} />
      <div className={`flex-1 rounded-2xl border border-white/10 ${featured ? "bg-white/[0.08] p-4" : "bg-white/[0.03] p-3"}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black text-slate-400">{label}</p>
          <p className={`text-lg font-black ${valueClass}`}>{value}</p>
        </div>
        <p className="mt-1 text-[10px] font-bold text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function HeroMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "violet" | "red" | "amber";
}) {
  const toneClass = {
    violet: "border-violet-400/20 bg-violet-500/10 text-violet-200",
    red: "border-rose-400/20 bg-rose-500/10 text-rose-200",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-200",
  }[tone];

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <p className="text-[10px] font-black tracking-wide opacity-80">{label}</p>
      </div>
      <p className="mt-2 text-sm font-black leading-tight text-white md:text-base">
        {value}
      </p>
    </div>
  );
}

function Info({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

function Mini({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-3 text-center">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={`${compact ? "text-base" : "text-xl"} mt-1 font-black`}>
        {value}
      </p>
    </div>
  );
}

function GlassMini({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl bg-white/10 p-3 text-center backdrop-blur">
      <p className="text-xs font-black text-blue-100">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function TradeLineCard({
  tone,
  title,
  value,
  sub,
}: {
  tone: "profit" | "loss";
  title: string;
  value: string;
  sub: string;
}) {
  const style =
    tone === "profit"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`rounded-[2rem] border p-4 text-center shadow-sm ${style}`}>
      <p className="text-sm font-black">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold">{sub}</p>
    </div>
  );
}

function PerformanceMini({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className={`mt-2 text-base font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

function BottomNavItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl px-3 py-2 text-center text-xs font-black transition ${
        active
          ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-950/50"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      <div className="text-lg">{icon}</div>
      <div className="mt-1">{label}</div>
    </Link>
  );
}