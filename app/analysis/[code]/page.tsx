"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PatternList from "@/app/components/analysis/PatternList";
import { formatStars, getEvidenceConfidenceStars, getRankPercentile } from "@/app/lib/displayMetrics";
import BottomNav from "@/app/components/BottomNav";
import BollingerSignalCard from "@/app/components/bollinger/BollingerSignalCard";
import type { BollingerSignal } from "@/app/lib/bollingerBands";

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
  detectedPatterns?: unknown;
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
  bollinger?: BollingerSignal;
};

type HistoryStats = {
  success: boolean;
  code: string;
  total: number;
  win: number;
  lose: number;
  hold: number;
  judged: number;
  winRate: number | null;
  cumulativeProfit: number | null;
  recent30: {
    total: number;
    win: number;
    lose: number;
    hold: number;
    judged: number;
    winRate: number | null;
    cumulativeProfit: number | null;
  };
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

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("application/json")) return null;

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
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
  if (power >= 95)
    return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-slate-800 dark:text-yellow-300";
  if (power >= 85)
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300";
  if (power >= 75)
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300";
  if (power >= 65)
    return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-slate-800 dark:text-yellow-300";
  return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-slate-800 dark:text-red-300";
}

function getPowerColor(power: number) {
  if (power >= 95) return "text-yellow-500";
  if (power >= 85) return "text-emerald-500";
  if (power >= 75) return "text-blue-500";
  if (power >= 65) return "text-yellow-500";
  return "text-red-500";
}

function getPowerMessage(power: number) {
  if (power >= 95) return "AIが強く推奨しています。積極的に監視しましょう。";
  if (power >= 85) return "買い候補です。押し目を待つ戦略も有効です。";
  if (power >= 75) return "押し目を待ちながら値動きを確認しましょう。";
  if (power >= 65) return "方向感を確認してから判断しましょう。";
  return "現在は慎重に様子を見る局面です。";
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
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300";
  }

  if (status === "NEAR_SUPPORT") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300";
  }

  if (status === "NEAR_RESISTANCE") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-slate-800 dark:text-amber-300";
  }

  if (status === "BREAKDOWN_RISK") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-slate-800 dark:text-red-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
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

function getLearningMessage(total: number, winRate: number | null) {
  if (total < 10) {
    return "まだ検証数が少ないため、AIは学習中です。判断材料のひとつとして見ましょう。";
  }

  if (winRate !== null && winRate >= 70) {
    return "この銘柄は過去実績が良く、AIが得意な可能性があります。";
  }

  if (winRate !== null && winRate < 50) {
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
  const [favoriteLoading, setFavoriteLoading] = useState(true);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [scanError, setScanError] = useState(false);
  const [learningError, setLearningError] = useState(false);
  const [showAllReasons, setShowAllReasons] = useState(false);

  useEffect(() => {
    const fetchSignal = async () => {
      setLoading(true);
      setScanError(false);
      setLearningError(false);

      try {
        const scanRes = await fetch("/api/scan?limit=1000", {
          cache: "no-store",
        });

        const scanJson = await readJsonResponse<
          Signal[] | { stocks?: Signal[]; totalStockList?: number }
        >(scanRes);

        if (!scanJson) {
          setScanError(true);
          setSignal(null);
          return;
        }

        const stocks: Signal[] = Array.isArray(scanJson)
          ? scanJson
          : Array.isArray(scanJson?.stocks)
            ? scanJson.stocks
            : [];

        const target = stocks.find((item) => item.code === code) || null;
        setSignal(target);

        const rank = stocks.findIndex((item) => item.code === code) + 1;
        setAiRank(rank);
        setTotalRank(
          !Array.isArray(scanJson) && typeof scanJson?.totalStockList === "number"
            ? scanJson.totalStockList
            : stocks.length,
        );

        try {
          const historyRes = await fetch(`/api/learning/stats/${code}`, {
            cache: "no-store",
          });
          const historyJson = await readJsonResponse<HistoryStats>(historyRes);
          setHistoryStats(historyJson?.success ? historyJson : null);

          const performanceRes = await fetch(`/api/performance/stock/${code}`, {
            cache: "no-store",
          });
          const performanceJson =
            await readJsonResponse<PerformanceSummary>(performanceRes);
          setPerformance(performanceJson?.success ? performanceJson : null);

          if (!historyJson?.success || !performanceJson?.success) {
            setLearningError(true);
          }
        } catch {
          setHistoryStats(null);
          setPerformance(null);
          setLearningError(true);
        }
      } catch {
        setScanError(true);
        setSignal(null);
        setHistoryStats(null);
        setPerformance(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchSignal();
  }, [code]);

  useEffect(() => {
    let active = true;

    async function loadFavorite() {
      try {
        const res = await fetch("/api/favorites", { cache: "no-store" });
        const data = await readJsonResponse<{ favorites?: unknown }>(res);
        const favorites = Array.isArray(data?.favorites) ? data.favorites : [];

        if (active) {
          setIsFavorite(
            favorites.some(
              (item: { code?: string }) => String(item?.code ?? "") === code,
            ),
          );
        }
      } catch {
        if (active) setIsFavorite(false);
      } finally {
        if (active) setFavoriteLoading(false);
      }
    }

    void loadFavorite();
    return () => {
      active = false;
    };
  }, [code]);

  const toggleFavorite = async () => {
    if (!signal || favoriteSaving || favoriteLoading) return;

    setFavoriteSaving(true);

    try {
      const res = isFavorite
        ? await fetch(`/api/favorites?code=${encodeURIComponent(code)}`, {
            method: "DELETE",
            cache: "no-store",
          })
        : await fetch("/api/favorites", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              code: signal.code,
              name: signal.name,
            }),
          });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "お気に入りの更新に失敗しました");
      }

      setIsFavorite((current) => !current);
    } catch (error) {
      console.error("favorite toggle error:", error);
    } finally {
      setFavoriteSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-2xl pt-10">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
            <p className="mt-4 text-lg font-black">AI分析データを取得しています</p>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
              AI POWER・利益とリスク・学習データを確認しています。
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (scanError) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-2xl pt-10">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h1 className="text-xl font-black">データを取得できませんでした</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              通信状況をご確認のうえ、もう一度お試しください。
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-12 rounded-xl bg-blue-600 px-6 font-bold text-white transition hover:bg-blue-700 active:scale-[0.98]"
            >
              再読み込み
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!signal) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-2xl pt-10">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h1 className="text-xl font-black">銘柄データが見つかりません</h1>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
              銘柄コード {code}
            </p>
            <Link
              href="/scan-mobile"
              className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-blue-600 px-6 font-bold text-white transition hover:bg-blue-700 active:scale-[0.98]"
            >
              Scanへ戻る
            </Link>
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
  const hold = historyStats?.hold ?? 0;
  const winRate = historyStats?.winRate ?? null;

  const profitRate =
    signal.price > 0 ? ((takeProfit - signal.price) / signal.price) * 100 : 0;

  const lossRate =
    signal.price > 0 ? ((signal.price - stopLoss) / signal.price) * 100 : 0;

  const aiTrust = getAiTrust(power, total, winRate ?? 0);
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
  const visibleReasons = showAllReasons ? reasonItems : reasonItems.slice(0, 3);
  const remainingReasonCount = Math.max(reasonItems.length - 3, 0);
  const aiCommentLines = aiComment.body
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 pb-28 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-2xl px-3 pt-3 min-[380px]:px-4">
        <header className="sticky top-0 z-30 -mx-3 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95 min-[380px]:-mx-4 min-[380px]:px-4">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/scan-mobile"
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <span aria-hidden="true">←</span> Scanへ戻る
            </Link>
            <button
              type="button"
              onClick={() => void toggleFavorite()}
              disabled={favoriteLoading || favoriteSaving}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border px-3 text-sm font-bold shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                isFavorite
                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              }`}
              aria-label={
                isFavorite
                  ? "お気に入りから削除"
                  : "お気に入りに追加"
              }
            >
              <span className="text-xl" aria-hidden="true">
                {favoriteLoading || favoriteSaving ? "…" : isFavorite ? "★" : "☆"}
              </span>
              <span className="hidden min-[360px]:inline">お気に入り</span>
            </button>
          </div>
        </header>

        <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-sm font-bold text-slate-500 dark:text-slate-300">{signal.code}</span>
            <h1 className="min-w-0 break-words text-xl font-black text-slate-950 dark:text-slate-100 min-[380px]:text-2xl">{signal.name}</h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">現在値 <strong className="text-slate-950 dark:text-slate-100">{yen(signal.price)}</strong></span>
            <span className={`font-black ${changePercent > 0 ? "text-emerald-600 dark:text-emerald-400" : changePercent < 0 ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-300"}`}>
              変化率 {changePercent > 0 ? "+" : ""}{changePercent}%
            </span>
          </div>
        </section>

        <section className="mt-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-blue-600 dark:text-blue-400">総合評価</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">銘柄の有望度</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${getJudgeColor(power)}`}>{judgeIcon} {judge}</span>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <div>
              <p className="text-xs font-black tracking-wide text-slate-500 dark:text-slate-300">AI POWER</p>
              <p className={`mt-1 text-6xl font-black leading-none ${getPowerColor(power)}`}>{power}</p>
            </div>
            <div className="mb-1 min-w-0 border-l border-slate-200 pl-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-300">
              <p className="font-bold">補助評価</p>
              <p className="mt-1">AI順位 {getRankLabel(aiRank)} / {totalRank || "-"}銘柄</p>
              <p className="mt-1">信頼度 {aiTrust}% {getRankPercentile(aiRank, totalRank) && `・${getRankPercentile(aiRank, totalRank)}`}</p>
            </div>
          </div>
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-medium leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-300">候補評価です。評価が高くても今すぐの購入を意味しません。</p>
        </section>

        <BollingerSignalCard signal={signal.bollinger} className="mt-3" />

        <section className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm dark:border-orange-800 dark:bg-slate-900">
          <p className="text-xs font-black text-orange-700 dark:text-orange-300">現在の行動</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">今の価格で取る行動</p>
          <p className="mt-3 text-lg font-black leading-7 text-slate-950 dark:text-slate-100">{getPowerMessage(power)}</p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-300">売買前に、下の利益・損失目安とチャートをご確認ください。</p>
        </section>

        <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-black">重要指標</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
            <Info label="必要資金" value={yen(requiredMoney)} />
            <Info label="変化率" value={`${changePercent > 0 ? "+" : ""}${changePercent}%`} valueClass={changePercent > 0 ? "text-emerald-600 dark:text-emerald-400" : changePercent < 0 ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-300"} />
            <Info label="出来高" value={`${volumeRatio}倍`} />
          </div>
        </section>

        <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">利益とリスク</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">利益だけでなく、損失の目安も同じように確認してください。</p>
          <div className="mt-3 grid grid-cols-1 gap-2 min-[350px]:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-slate-800">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">利益確定目安</p>
              <p className="mt-1 text-xl font-black text-slate-950 dark:text-slate-100">{yen(takeProfit)}</p>
              <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">期待利益 +{yen(profitYen)}（+{profitRate.toFixed(2)}%）</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-slate-800">
              <p className="text-xs font-bold text-red-700 dark:text-red-300">損失を抑える目安</p>
              <p className="mt-1 text-xl font-black text-slate-950 dark:text-slate-100">{yen(stopLoss)}</p>
              <p className="mt-1 text-sm font-bold text-red-700 dark:text-red-300">想定損失 -{yen(lossYen)}（-{lossRate.toFixed(2)}%）</p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Info label="必要資金" value={yen(requiredMoney)} />
            <Info label="損益比" value={riskReward} valueClass="text-blue-600 dark:text-blue-400" />
          </div>
        </section>

        <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">主な判断理由</h2>
          <div className="mt-3 space-y-2">
            {visibleReasons.map((item, index) => (
              <div key={`${item}-${index}`} className="flex items-start gap-2 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">
                <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-blue-100 text-[10px] font-black text-blue-700 dark:bg-slate-800 dark:text-blue-300">✓</span>
                <span className="min-w-0 break-words">{item}</span>
              </div>
            ))}
          </div>
          {remainingReasonCount > 0 && (
            <button type="button" onClick={() => setShowAllReasons((current) => !current)} className="mt-3 min-h-10 rounded-lg px-1 text-sm font-bold text-blue-600 dark:text-blue-400" aria-expanded={showAllReasons}>
              {showAllReasons ? "理由を閉じる" : `＋ほか${remainingReasonCount}件`}
            </button>
          )}
        </section>

        <section className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-800 dark:bg-slate-900">
          <h2 className="text-lg font-black">AIコメント</h2>
          <ul className="mt-3 space-y-2">
            {aiCommentLines.map((line, index) => (
              <li key={`${line}-${index}`} className="flex items-start gap-2 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300"><span className="text-blue-600 dark:text-blue-400">・</span><span>{line}</span></li>
            ))}
          </ul>
          <p className="mt-3 border-t border-blue-100 pt-3 text-xs font-medium leading-5 text-slate-600 dark:border-slate-700 dark:text-slate-300">{aiComment.point}</p>
        </section>

        <Link href={`/chart/${signal.code}`} className="mt-3 block rounded-2xl border border-blue-600 bg-blue-600 p-4 text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]" aria-label={`${signal.code} ${signal.name}のチャートを見る`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><p className="text-base font-black min-[380px]:text-lg">値動きと買い時をチャートで確認</p><p className="mt-1 text-xs font-medium text-blue-100">ローソク足、支持線・抵抗線、出来高を確認できます</p></div>
            <span className="shrink-0 text-2xl" aria-hidden="true">→</span>
          </div>
        </Link>

        <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-black">テクニカル情報</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">売買判断を補助する指標</p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getSupportResistanceStyle(supportResistanceStatus)}`}>{getSupportResistanceLabel(supportResistanceStatus)}</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2 min-[430px]:grid-cols-3">
            <Mini label="RSI" value={`${rsi} / ${getRsiComment(rsi)}`} compact valueClass={getRsiColor(rsi)} />
            <Mini label="出来高" value={`${volumeRatio}倍`} compact />
            <Mini label="検出パターン" value={getPatternText(signal.patternSignal)} compact />
            <Mini label="支持線（下値の目安）" value={levelYen(supportPrice)} compact />
            <Mini label="抵抗線（上値の壁）" value={levelYen(resistancePrice)} compact />
            <Mini label="上値突破の期待度" value={`${breakoutExpectation}%`} compact valueClass="text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-medium leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{getSupportResistanceComment({ status: supportResistanceStatus, supportPrice, resistancePrice, supportDistancePercent, resistanceDistancePercent, breakoutExpectation })}</p>
          <PatternList detectedPatterns={signal.detectedPatterns} code={signal.code} />
        </section>

        <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">過去成績</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">過去のAI判定結果</p></div><div className="text-right"><p className="text-xs text-slate-500 dark:text-slate-300">実績スコア</p><p className="text-xl font-black text-blue-600 dark:text-blue-400">{historyStats && historyStats.total > 0 ? (performance?.reliability.score ?? "-") : "蓄積中"}</p><p className="text-xs text-amber-500" aria-label={`実績信頼度5段階中${getEvidenceConfidenceStars(historyStats?.judged ?? 0)}`}>{formatStars(getEvidenceConfidenceStars(historyStats?.judged ?? 0))}</p></div></div>
          {learningError && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-slate-800 dark:text-amber-300">学習データの一部を取得できませんでした。個別解析の内容はそのまま確認できます。</p>}
          <div className="mt-3 grid grid-cols-2 gap-2 min-[430px]:grid-cols-3">
            <PerformanceMini label="直近30件" value={historyStats && historyStats.recent30.total > 0 ? `${historyStats.recent30.win}勝${historyStats.recent30.lose}敗` : "データ蓄積中"} />
            <PerformanceMini label="累計損益" value={historyStats?.cumulativeProfit === null || !historyStats ? "-" : `${historyStats.cumulativeProfit >= 0 ? "+" : ""}${yen(historyStats.cumulativeProfit)}`} valueClass={(historyStats?.cumulativeProfit ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} />
            <PerformanceMini label="直近30件勝率" value={historyStats?.recent30.winRate === null || !historyStats ? "データ蓄積中" : `${historyStats.recent30.winRate}%`} valueClass="text-blue-600 dark:text-blue-400" />
            <PerformanceMini label="累計判定" value={historyStats ? `${historyStats.judged}回` : "データ蓄積中"} />
            <PerformanceMini label="WIN" value={`${win}`} valueClass="text-emerald-600 dark:text-emerald-400" />
            <PerformanceMini label="LOSE / HOLD" value={`${lose} / ${hold}`} />
          </div>
          <Link href={`/analysis/${signal.code}/performance`} className="mt-3 flex min-h-12 items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 font-bold text-blue-700 transition active:scale-[0.99] dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300"><span>詳しいAI実績を見る</span><span aria-hidden="true">→</span></Link>
        </section>

        <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">AI学習データ</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 min-[390px]:grid-cols-4"><Mini label="検証" value={`${total}回`} compact /><Mini label="WIN" value={`${win}`} compact /><Mini label="LOSE" value={`${lose}`} compact /><Mini label="HOLD" value={`${hold}`} compact /></div>
          <div className="mt-3 rounded-xl bg-blue-50 p-3 text-center dark:bg-slate-800"><p className="text-xs font-bold text-slate-500 dark:text-slate-300">AI勝率</p><p className="mt-1 text-3xl font-black text-blue-600 dark:text-blue-400">{winRate === null ? "データ蓄積中" : `${winRate}%`}</p></div>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{getLearningMessage(total, winRate)}</p>
        </section>

        <section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-slate-900">
          <h2 className="text-sm font-black text-amber-800 dark:text-amber-300">投資上の注意</h2>
          <p className="mt-2 text-xs font-medium leading-6 text-amber-900 dark:text-amber-200">SIGNALXは投資判断をサポートする情報提供サービスです。AI判定・スコア・利益確定／損失を抑える目安は将来の利益を保証するものではありません。最終判断はご自身の責任で行ってください。</p>
        </section>

        <BottomNav />
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
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-800">
      <p className="text-[10px] font-bold leading-tight text-slate-500 dark:text-slate-300">{label}</p>
      <p className={`mt-1 break-words text-base font-black leading-tight text-slate-950 dark:text-slate-100 ${valueClass}`}>
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
    <div className="min-w-0 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800">
      <p className="break-words text-[10px] font-bold text-slate-500 dark:text-slate-300">{label}</p>
      <p
        className={`${compact ? "text-sm" : "text-lg"} mt-1 break-words font-black leading-tight text-slate-950 dark:text-slate-100 ${valueClass}`}
      >
        {value}
      </p>
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
    <div className="min-w-0 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800">
      <p className="break-words text-[10px] font-bold text-slate-500 dark:text-slate-300">{label}</p>
      <p className={`mt-2 break-words text-sm font-black text-slate-950 dark:text-slate-100 ${valueClass}`}>{value}</p>
    </div>
  );
}
