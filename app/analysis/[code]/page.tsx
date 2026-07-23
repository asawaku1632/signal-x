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
  title: string;
  body: string;
  point: string;
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

function getPowerMessage(power: number) {
  if (power >= 95) return "AIが強く推奨しています。積極的に監視しましょう。";
  if (power >= 85) return "買い候補です。押し目を待つ戦略も有効です。";
  if (power >= 75) return "押し目を待ちながら値動きを確認しましょう。";
  if (power >= 65) return "方向感を確認してから判断しましょう。";
  return "現在は慎重に様子を見る局面です。";
}

function getPowerCardStyle(power: number) {
  if (power >= 95)
    return "border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-100";
  if (power >= 85)
    return "border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-100";
  if (power >= 75)
    return "border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-100";
  if (power >= 65)
    return "border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50";
  return "border-red-200 bg-gradient-to-br from-red-50 to-rose-100";
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

function buildAiComment({
  reason,
  power,
  judge,
  rsi,
  volumeRatio,
  changePercent,
  supportResistanceStatus,
}: {
  reason?: string;
  power: number;
  judge: string;
  rsi: number;
  volumeRatio: number;
  changePercent: number;
  supportResistanceStatus?: Signal["supportResistanceStatus"];
}): AiComment {
  const reasonText = reason ?? "";
  const aboveImportantLines =
    reasonText.includes("MA20上") ||
    reasonText.includes("EMA20上") ||
    reasonText.includes("VWAP上");

  const belowImportantLines =
    reasonText.includes("MA20下") ||
    reasonText.includes("EMA20下") ||
    reasonText.includes("VWAP下");

  const volumeIsStrong = volumeRatio >= 1.3;
  const isOverheated = rsi >= 70 || changePercent >= 5;
  const isBreakingOut = supportResistanceStatus === "BREAKOUT";
  const isBreakdownRisk = supportResistanceStatus === "BREAKDOWN_RISK";

  let opening = "現在は方向感を見極めたい状態です。";
  let evidence =
    "買いと売りの勢いが拮抗しており、現時点では大きな優位性を確認できません。";
  let action =
    "焦って売買せず、新しいシグナルが出るまでチャートの動きを確認しましょう。";

  if (power >= 95) {
    opening = "現在は買い優勢の状態です。";

    if (aboveImportantLines && volumeIsStrong) {
      evidence =
        "株価は重要な移動平均線より上で推移し、出来高も増えているため、多くの投資家が注目しています。";
    } else if (aboveImportantLines) {
      evidence =
        "株価は重要な移動平均線より上で推移しており、上昇トレンドを維持しています。";
    } else if (volumeIsStrong) {
      evidence =
        "出来高が増え、買いの勢いも強いため、市場の注目度が高まっています。";
    } else {
      evidence =
        "複数の強気シグナルが重なっており、AIは上昇の可能性を高く評価しています。";
    }

    action = isOverheated
      ? "ただし、短期間で大きく上昇した後は一時的に値下がりすることもあります。焦って飛び乗らず、チャートも確認しながら落ち着いてエントリーを判断するのがおすすめです。"
      : "ただし、強い判定でも値下がりする可能性はあります。チャートも確認しながら、落ち着いてエントリーを判断するのがおすすめです。";
  } else if (power >= 85) {
    opening = "現在は買いがやや優勢の状態です。";
    evidence = aboveImportantLines
      ? "株価は重要な移動平均線より上で推移しており、上昇の流れが続いています。"
      : "複数の買いシグナルが確認されており、今後の上昇が期待されます。";

    action = isOverheated
      ? "上昇直後に追いかけて買うよりも、一度値動きが落ち着くか、押し目を確認してから判断しましょう。"
      : "現在値ですぐに飛び乗るのではなく、押し目や出来高の変化を確認してから判断しましょう。";
  } else if (power >= 75) {
    opening = "現在は上昇の兆しが見られます。";
    evidence =
      "テクニカル指標は改善傾向にありますが、まだ強い買いの流れが完成したとは言い切れません。";
    action = isBreakingOut
      ? "抵抗線を上抜けた動きが続くか、出来高を伴っているかを確認してから判断しましょう。"
      : "もう一段強い買いシグナルが出るか、押し目から反発するかを確認しながら判断しましょう。";
  } else if (power >= 65) {
    opening = "現在は様子見が中心の状態です。";
    evidence = belowImportantLines
      ? "株価は重要な移動平均線を下回っており、買いの勢いはまだ十分ではありません。"
      : "買いと売りの勢いが拮抗しており、方向感がはっきりしていません。";
    action =
      "焦って売買するより、株価が重要ラインを上回るなど、新しい買いシグナルを待つ方が安全です。";
  } else {
    opening = "現在は注意が必要な状態です。";
    evidence = isBreakdownRisk || belowImportantLines
      ? "上昇トレンドが弱まり、売り圧力が強くなっているため、下落リスクを慎重に見る必要があります。"
      : "強い上昇シグナルが少なく、AIは現時点で無理に買う局面ではないと判断しています。";
    action =
      "新たな買いシグナルや反発を確認できるまでは、無理にエントリーせず慎重に様子を見ることをおすすめします。";
  }

  return {
    title: "AIの見解",
    body: `${opening}\n\n${evidence}\n\nそのためAIは「${judge}」と評価しました。\n\n${action}`,
    point:
      "AI POWERが高くても、100％上昇を保証するものではありません。利確・損切ラインやリアルタイムチャートも確認しながら、総合的に判断しましょう。",
  };
}

export default function AnalysisPage() {
  const params = useParams();
  const code = String(params.code);

  const [signal, setSignal] = useState<Signal | null>(null);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [performance, setPerformance] = useState<PerformanceSummary | null>(
    null,
  );
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

        const performanceRes = await fetch(`/api/performance/stock/${code}`, {
          cache: "no-store",
        });

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
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
        <div className="mx-auto max-w-md pt-10">
          <div className="rounded-[2rem] border border-white bg-white p-6 text-center shadow-sm">
            <p className="text-2xl font-black">分析データを読み込み中...</p>
            <p className="mt-2 text-sm font-bold text-slate-500">
              AI POWER・利確ライン・学習データを取得しています。
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!signal) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-900">
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
  const supportResistanceStatus = signal.supportResistanceStatus ?? "NO_DATA";
  const breakoutExpectation = signal.breakoutExpectation ?? 0;

  const reasonItems = (signal.reason || "AI理由なし")
    .split("・")
    .map((item) => item.trim())
    .filter(Boolean);

  const aiComment = buildAiComment({
    reason: signal.reason,
    power,
    judge,
    rsi,
    volumeRatio,
    changePercent,
    supportResistanceStatus,
  });

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-28 text-slate-900">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="sticky top-0 z-30 -mx-4 border-b border-white/70 bg-[#f7f9fc]/85 px-4 pb-3 pt-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <Link
              href="/scan-mobile"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-2xl font-black shadow-sm transition active:scale-95"
              aria-label="AIランキングへ戻る"
            >
              ‹
            </Link>

            <div className="text-center">
              <div className="text-3xl font-black tracking-tight">
                SIGNAL<span className="text-blue-600">X</span>
              </div>

              <div
                className="mt-1 inline-flex items-center gap-2 rounded-full
bg-gradient-to-r from-blue-600 to-cyan-500
px-5 py-2
text-white
shadow-lg shadow-blue-500/20
border border-blue-300/30"
              >
                <span className="text-base">🤖</span>
                <span className="text-[15px] font-extrabold tracking-wide">
                  AI分析
                </span>
              </div>

              <div className="mt-1 text-[10px] font-black tracking-[0.22em] text-slate-500">
                AI ANALYSIS
              </div>
            </div>

            <button
              onClick={toggleFavorite}
              className={`grid h-11 w-11 place-items-center rounded-2xl text-2xl shadow-sm transition active:scale-95 ${
                isFavorite
                  ? "bg-yellow-400 text-white"
                  : "border border-slate-200 bg-white text-yellow-500"
              }`}
              aria-label="お気に入り"
            >
              {isFavorite ? "★" : "☆"}
            </button>
          </div>
        </header>

        <section className="mt-4 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 px-5 py-4 text-white shadow-xl shadow-blue-200/70">
          <p className="text-[10px] font-black tracking-[0.18em] text-blue-200">
            AI STOCK ANALYSIS
          </p>

          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-3xl font-black leading-none">
                  {signal.code}
                </h1>
                <p className="truncate text-xl font-black leading-tight">
                  {signal.name}
                </p>
              </div>

            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm">🤖</span>
              <p className="text-[11px] font-black tracking-wide text-blue-100">
                AI分析サマリー
              </p>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1.5 min-[380px]:grid-cols-2">
              {reasonItems.map((item, index) => (
                <div key={`${item}-${index}`} className="flex min-w-0 items-start gap-2">
                  <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-violet-400 text-[9px] font-black text-white">
                    ✓
                  </span>
                  <span className="min-w-0 break-words text-[10px] font-bold leading-[1.45] text-white min-[390px]:text-[11px]">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className={`mt-4 rounded-[1.75rem] border px-5 py-4 shadow-sm ${getPowerCardStyle(power)}`}
        >
          <div className="flex items-stretch gap-4">
            <div className="flex min-w-[7.25rem] shrink-0 flex-col justify-center">
              <p className="text-[10px] font-black tracking-[0.18em] text-blue-600">
                AI POWER
              </p>
              <p className={`mt-1 text-5xl font-black leading-none ${getPowerColor(power)}`}>
                {power}
              </p>

              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${getJudgeColor(power)}`}
                >
                  <span>{judgeIcon}</span>
                  <span>{judge}</span>
                </span>
                <p className="mt-1 text-[10px] font-black leading-tight text-slate-600">
                  {power >= 85 ? "AIが強く推奨" : getPowerMessage(power)}
                </p>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-2 border-l border-slate-300/70 pl-3">
              <div className="flex min-h-[2.8rem] items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-gradient-to-r from-white/95 to-amber-50/90 px-3 py-1.5 shadow-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm shadow-inner">
                    🏆
                  </span>
                  <p className="text-[10px] font-black text-slate-600">AI順位</p>
                </div>
                <p className="flex flex-col items-end text-right leading-tight">
  <span className="text-lg font-black text-amber-700">
    {getRankLabel(aiRank)}
  </span>
  <span className="text-[9px] font-black text-slate-500">
    / {totalRank || "-"}銘柄中
  </span>
</p>
              </div>

              <div className="flex min-h-[2.8rem] items-center justify-between gap-2 rounded-xl border border-emerald-200/80 bg-gradient-to-r from-white/95 to-emerald-50/90 px-3 py-1.5 shadow-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm shadow-inner">
                    🛡️
                  </span>
                  <p className="text-[10px] font-black text-slate-600">信頼度</p>
                </div>
                <p className="text-lg font-black text-emerald-600 text-right">
                  {aiTrust}%
                </p>
              </div>

              <div className="flex min-h-[2.8rem] items-center justify-between gap-2 rounded-xl border border-orange-200/80 bg-gradient-to-r from-white/95 to-orange-50/90 px-3 py-1.5 shadow-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm shadow-inner">
                    ⭐
                  </span>
                  <p className="text-[10px] font-black text-slate-600">判定</p>
                </div>
                <p className="flex items-center justify-end gap-1 text-sm font-black text-orange-600 text-right">
                  <span className="text-sm">{judgeIcon}</span>
                  <span>{judge}</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-[1.5rem] border border-white bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black tracking-[0.18em] text-blue-600">
              PRICE
            </p>
            <p className="text-[10px] font-bold text-slate-400">価格情報</p>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Info label="現在値" value={yen(signal.price)} />
            <Info label="必要資金" value={yen(requiredMoney)} />
            <Info
              label="本日変化率"
              value={`${changePercent >= 0 ? "+" : ""}${changePercent}%`}
              valueClass={
                changePercent >= 0 ? "text-red-500" : "text-emerald-600"
              }
            />
            <Info label="出来高倍率" value={`${volumeRatio}倍`} />
          </div>
        </section>

        <Link
          href={`/chart/${signal.code}`}
          aria-label={`${signal.code} ${signal.name}のAIチャート分析を見る`}
          className="group mt-5 block overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-600 p-[2px] shadow-2xl shadow-blue-300/60 transition duration-200 active:scale-[0.985]"
        >
          <div className="relative overflow-hidden rounded-[calc(2.5rem-2px)] bg-gradient-to-br from-slate-950 via-blue-950 to-violet-900 px-5 py-6 text-white">
            <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-cyan-400/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-violet-500/25 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 top-20 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.4rem] border border-cyan-200/40 bg-gradient-to-br from-cyan-400/25 to-violet-500/25 text-4xl shadow-xl shadow-cyan-950/40 backdrop-blur">
                    📈
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-black tracking-[0.22em] text-cyan-300">
                      REALTIME CHART
                    </p>
                    <h2 className="mt-1 text-[1.75rem] font-black leading-tight">
                      AIチャート分析
                    </h2>
                  </div>
                </div>

                <span className="shrink-0 rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1.5 text-[10px] font-black text-amber-200 backdrop-blur">
                  ⭐ おすすめ
                </span>
              </div>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 px-4 py-2 text-[11px] font-black text-white shadow-lg shadow-fuchsia-950/30">
                <span>✨</span>
                <span>SIGNALXおすすめ機能</span>
              </div>

              <p className="mt-4 text-xl font-black leading-8 text-white">
                リアルタイム解析で
                <br />
                AIが売買ポイントを可視化
              </p>

              <p className="mt-2 text-sm font-bold leading-6 text-blue-100">
                最新の値動きと重要ラインを、チャートで一目で確認できます。
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-3 text-center backdrop-blur">
                  <p className="text-2xl">🎯</p>
                  <p className="mt-1 text-xs font-black text-emerald-200">
                    利確ライン
                  </p>
                  <p className="mt-1 text-[9px] font-bold text-emerald-100/70">
                    利益確定の目安
                  </p>
                </div>

                <div className="rounded-2xl border border-red-300/20 bg-red-400/10 px-3 py-3 text-center backdrop-blur">
                  <p className="text-2xl">🛡</p>
                  <p className="mt-1 text-xs font-black text-red-200">
                    損切ライン
                  </p>
                  <p className="mt-1 text-[9px] font-bold text-red-100/70">
                    リスク管理の目安
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-3 text-center backdrop-blur">
                  <p className="text-2xl">🤖</p>
                  <p className="mt-1 text-xs font-black text-cyan-200">
                    AI判断
                  </p>
                  <p className="mt-1 text-[9px] font-bold text-cyan-100/70">
                    総合判断を確認
                  </p>
                </div>

                <div className="rounded-2xl border border-violet-300/20 bg-violet-400/10 px-3 py-3 text-center backdrop-blur">
                  <p className="text-2xl">📊</p>
                  <p className="mt-1 text-xs font-black text-violet-200">
                    重要ライン
                  </p>
                  <p className="mt-1 text-[9px] font-bold text-violet-100/70">
                    支持線・EMA20・VWAP
                  </p>
                </div>
              </div>

              <div className="mt-6 flex min-h-16 items-center justify-between rounded-2xl border border-cyan-200/40 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 px-5 py-4 shadow-[0_0_28px_rgba(34,211,238,0.35)] transition duration-200 group-hover:brightness-110 group-active:scale-[0.98]">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📈</span>
                  <span className="text-xl font-black">AIチャートを見る</span>
                </div>
                <span className="text-3xl font-black leading-none transition-transform duration-200 group-hover:translate-x-1">
                  ›
                </span>
              </div>

              <p className="mt-3 text-center text-[11px] font-black text-cyan-200">
                ▶ リアルタイムチャートを開く
              </p>
            </div>
          </div>
        </Link>

        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                SUPPORT & RESISTANCE
              </p>
              <h2 className="mt-2 text-2xl font-black">支持線・抵抗線</h2>
            </div>

            <div
              className={`rounded-2xl border px-3 py-2 text-center text-xs font-black ${getSupportResistanceStyle(
                supportResistanceStatus,
              )}`}
            >
              {getSupportResistanceLabel(supportResistanceStatus)}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 text-center">
              <p className="text-xs font-black text-blue-600">支持線</p>
              <p className="mt-2 text-xl font-black leading-none text-blue-700">
                {levelYen(supportPrice)}
              </p>
              <p className="mt-1 text-[10px] font-bold text-blue-500">
                {supportDistancePercent !== null
                  ? `現在値より -${supportDistancePercent.toFixed(2)}%`
                  : "距離データなし"}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs font-black text-slate-500">現在値</p>
              <p className="mt-2 text-xl font-black leading-none text-slate-900">
                {levelYen(signal.price)}
              </p>
              <p className="mt-1 text-[10px] font-bold text-slate-400">
                現在の株価
              </p>
            </div>

            <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-center">
              <p className="text-xs font-black text-amber-600">抵抗線</p>
              <p className="mt-2 text-xl font-black leading-none text-amber-700">
                {levelYen(resistancePrice)}
              </p>
              <p className="mt-1 text-[10px] font-bold text-amber-500">
                {resistanceDistancePercent !== null
                  ? `現在値より +${resistanceDistancePercent.toFixed(2)}%`
                  : "距離データなし"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-3xl bg-slate-950 p-4 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.14em] text-blue-300">
                  BREAKOUT EXPECTATION
                </p>
                <p className="mt-1 text-lg font-black">ブレイク期待度</p>
              </div>

              <p className="text-4xl font-black">
                {breakoutExpectation}
                <span className="text-lg">%</span>
              </p>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-blue-400 transition-all"
                style={{
                  width: `${Math.min(Math.max(breakoutExpectation, 0), 100)}%`,
                }}
              />
            </div>

            <p className="mt-3 text-xs font-bold leading-6 text-slate-300">
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
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3">
          <TradeLineCard
            tone="profit"
            title="🎯 利確目標"
            value={yen(takeProfit)}
            sub={`+${profitRate.toFixed(2)}% / +${yen(profitYen)}`}
          />

          <TradeLineCard
            tone="loss"
            title="🛡 損切ライン"
            value={yen(stopLoss)}
            sub={`-${lossRate.toFixed(2)}% / -${yen(lossYen)}`}
          />
        </section>

        <section className="mt-5 rounded-[2rem] border border-blue-100 bg-blue-50 p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-blue-700">
            AI COMMENT
          </p>
          <h2 className="mt-2 text-2xl font-black">AIコメント</h2>

          <div className="mt-4 overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-100 text-2xl">
                  🤖
                </span>
                <div>
                  <p className="text-lg font-black text-blue-700">
                    {aiComment.title}
                  </p>
                  <p className="mt-0.5 text-[10px] font-black tracking-[0.14em] text-slate-400">
                    SIGNALX AI DECISION
                  </p>
                </div>
              </div>

              <p className="mt-5 whitespace-pre-line text-sm font-bold leading-7 text-slate-700">
                {aiComment.body}
              </p>
            </div>

            <div className="border-t border-amber-100 bg-amber-50 px-5 py-4">
              <p className="text-sm font-black text-amber-800">
                💡 ワンポイント
              </p>
              <p className="mt-2 text-xs font-bold leading-6 text-amber-900">
                {aiComment.point}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-5 text-white">
            <p className="text-xs font-black tracking-[0.18em] text-blue-100">
              AI PERFORMANCE
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">AI実績</h2>
                <p className="mt-1 text-xs font-bold text-blue-100">
                  過去の判定結果を実データで確認
                </p>
              </div>
              <div className="rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur">
                <p className="text-[10px] font-black text-blue-100">
                  過去実績スコア
                </p>
                <p className="mt-1 text-2xl font-black">
                  {performance?.reliability.score ?? "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-3 gap-2">
              <PerformanceMini
                label="直近30件"
                value={
                  performance
                    ? performance.summary30Days.judgedTotal >= 3
                      ? `${performance.summary30Days.wins}勝${performance.summary30Days.losses}敗`
                      : "データ蓄積中"
                    : "集計中"
                }
              />
              <PerformanceMini
                label="累計損益"
                value={
                  performance
                    ? `${performance.summary30Days.totalProfitYen >= 0 ? "+" : ""}${yen(
                        performance.summary30Days.totalProfitYen,
                      )}`
                    : "-"
                }
                valueClass={
                  (performance?.summary30Days.totalProfitYen ?? 0) >= 0
                    ? "text-emerald-600"
                    : "text-red-500"
                }
              />
              <PerformanceMini
                label="直近30件勝率"
                value={
                  performance ? `${performance.summary30Days.winRate}%` : "-"
                }
                valueClass="text-blue-600"
              />
            </div>

            <p className="mt-4 text-xs font-bold leading-6 text-slate-500">
              直近30件の判定済み実績を表示しています。WINは翌日騰落率+2%以上、LOSEは-2%以下で判定しています。
              判定数が少ない場合は「データ蓄積中」と表示します。
            </p>

            <Link
              href={`/analysis/${signal.code}/performance`}
              className="mt-4 flex items-center justify-between rounded-3xl bg-slate-950 px-5 py-4 text-white transition active:scale-[0.98]"
            >
              <div>
                <p className="text-sm font-black text-cyan-300">
                  AI PERFORMANCE CENTER
                </p>
                <p className="mt-1 text-lg font-black">詳しいAI実績を見る</p>
              </div>
              <span className="text-3xl">›</span>
            </Link>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-blue-600">
            AI LEARNING
          </p>
          <h2 className="mt-2 text-2xl font-black">AI学習データ</h2>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <Mini label="検証" value={`${total}回`} compact />
            <Mini label="WIN" value={`${win}`} compact />
            <Mini label="LOSE" value={`${lose}`} compact />
            <Mini label="HOLD" value={`${hold}`} compact />
          </div>

          <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-4 text-center">
            <p className="text-xs font-black text-slate-500">AI勝率</p>
            <p className="mt-1 text-5xl font-black text-blue-600">{winRate}%</p>
          </div>

          <p className="mt-4 text-sm font-bold leading-7 text-slate-600">
            {getLearningMessage(total, winRate)}
          </p>
        </section>

        <section className="mt-5 rounded-[1.75rem] border border-white bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black tracking-[0.18em] text-blue-600">
            RISK REWARD
          </p>
          <h2 className="mt-1 text-xl font-black">リスク・リワード</h2>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Mini
              label="期待利益"
              value={`+${yen(profitYen)}`}
              valueClass="text-emerald-600"
            />
            <Mini
              label="想定損失"
              value={`-${yen(lossYen)}`}
              valueClass="text-red-600"
            />
            <Mini label="RR比" value={riskReward} valueClass="text-blue-600" />
          </div>

          <p className="mt-3 text-xs font-bold leading-6 text-slate-600">
            利確と損切の幅を比較して、無理のないエントリーか確認しましょう。
          </p>
        </section>

        <section className="mt-5 rounded-[1.75rem] border border-white bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black tracking-[0.18em] text-blue-600">
            TECHNICAL
          </p>
          <h2 className="mt-1 text-xl font-black">テクニカル</h2>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-3xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-black text-slate-500">RSI</p>
              <p className={`mt-2 text-2xl font-black ${getRsiColor(rsi)}`}>
                {rsi}
              </p>
              <p className="mt-1 text-[10px] font-bold text-slate-400">
                {getRsiComment(rsi)}
              </p>
            </div>

            <Mini label="出来高" value={`${volumeRatio}倍`} />
            <Mini
              label="形状"
              value={getPatternText(signal.patternSignal)}
              compact
            />
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">ご利用前の注意</p>
          <p className="mt-2 text-xs font-bold leading-6 text-amber-900">
            SIGNALXは投資判断をサポートする情報提供サービスです。AI判定・スコア・利確/損切ラインは将来の利益を保証するものではありません。最終判断はご自身の責任で行ってください。
          </p>
        </section>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-5 gap-2">
            <BottomNavItem href="/dashboard" icon="🏠" label="ホーム" />
            <BottomNavItem href="/today-market" icon="🤖" label="市場" />
            <BottomNavItem href="/ranking" icon="🏆" label="ランキング" />
            <BottomNavItem href="/learning" icon="🧠" label="学習" />
            <BottomNavItem href="/favorites" icon="⭐" label="お気に入り" />
          </div>
        </nav>
      </div>
    </main>
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
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[9px] font-black leading-none text-slate-500">{label}</p>
      <p className={`mt-1 text-base font-black leading-tight ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function Mini({
  label,
  value,
  compact = false,
  valueClass = "",
}: {
  label: string;
  value: string;
  compact?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-3 text-center">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p
        className={`${compact ? "text-base" : "text-xl"} mt-1 font-black leading-tight ${valueClass}`}
      >
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
          ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
          : "text-slate-500"
      }`}
    >
      <div className="text-lg">{icon}</div>
      <div className="mt-1">{label}</div>
    </Link>
  );
}