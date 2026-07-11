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

type AiComment = {
  icon: string;
  title: string;
  body: string;
};

function yen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString()}円`;
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
              <div className="text-[10px] font-black tracking-[0.22em] text-slate-500">
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

        <section className="mt-5 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-2xl shadow-blue-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-200">
                AI STOCK ANALYSIS
              </p>

              <h1 className="mt-3 text-5xl font-black leading-none">
                {signal.code}
              </h1>

              <p className="mt-2 text-2xl font-black leading-tight">
                {signal.name}
              </p>
            </div>

            <div
              className={`rounded-3xl border px-4 py-3 text-center font-black ${getJudgeColor(power)}`}
            >
              <p className="text-2xl">{judgeIcon}</p>
              <p className="mt-1 text-sm">{judge}</p>
            </div>
          </div>

          <p className="mt-5 text-sm font-bold leading-7 text-blue-100">
            {signal.reason || "AI理由なし"}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <GlassMini label="AI POWER" value={power} />
            <GlassMini label="AI順位" value={getRankLabel(aiRank)} />
            <GlassMini label="信頼度" value={`${aiTrust}%`} />
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                AI POWER
              </p>
              <h2 className="mt-2 text-2xl font-black">AI総合スコア</h2>
            </div>

            <p className={`text-5xl font-black ${getPowerColor(power)}`}>
              {power}
            </p>
          </div>

          <div className="mt-5 flex justify-center gap-1.5">
            {getPowerBars(power).map((filled, index) => (
              <span
                key={index}
                className={`h-8 w-3 rounded-full ${
                  filled ? getPowerBarColor(power) : "bg-slate-200"
                }`}
              />
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-black text-slate-400">AI順位</p>
              <div
                className={`mx-auto mt-3 grid h-20 w-20 place-items-center rounded-full text-2xl font-black shadow-lg ${getRankStyle(
                  aiRank,
                )}`}
              >
                {getRankLabel(aiRank)}
              </div>
              <p className="mt-3 text-xs font-bold text-slate-500">
                / {totalRank.toLocaleString()}銘柄中
              </p>
              <p className="mt-1 text-xs font-black text-yellow-600">
                上位 {rankPercent}
              </p>
            </div>

            <div className="rounded-3xl bg-emerald-50 p-4 text-center">
              <p className="text-xs font-black text-emerald-600">AI信頼度</p>
              <p className="mt-4 text-5xl font-black text-emerald-600">
                {aiTrust}%
              </p>
              <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
                AI POWER・勝率・検証数から算出
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-blue-600">
            PRICE
          </p>
          <h2 className="mt-2 text-2xl font-black">価格情報</h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
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

        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-blue-600">
            RISK REWARD
          </p>
          <h2 className="mt-2 text-2xl font-black">リスク・リワード</h2>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Mini label="期待利益" value={`+${yen(profitYen)}`} />
            <Mini label="想定損失" value={`-${yen(lossYen)}`} />
            <Mini label="RR比" value={riskReward} />
          </div>

          <p className="mt-4 text-sm font-bold leading-7 text-slate-600">
            利確と損切の幅を比較して、無理のないエントリーか確認しましょう。
          </p>
        </section>

        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-blue-600">
            TECHNICAL
          </p>
          <h2 className="mt-2 text-2xl font-black">テクニカル</h2>

          <div className="mt-4 grid grid-cols-3 gap-3">
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

        <section className="mt-5 rounded-[2rem] border border-blue-100 bg-blue-50 p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-blue-700">
            AI COMMENT
          </p>
          <h2 className="mt-2 text-2xl font-black">AIコメント</h2>

          <div className="mt-4 space-y-3">
            {aiComments.map((comment) => (
              <div
                key={`${comment.title}-${comment.body}`}
                className="rounded-3xl border border-blue-100 bg-white/85 p-4"
              >
                <p className="text-sm font-black text-blue-700">
                  {comment.icon} {comment.title}
                </p>
                <p className="mt-2 text-sm font-bold leading-7 text-slate-700">
                  {comment.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Link
          href={`/chart/${signal.code}`}
          className="mt-5 block rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-300 transition active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-blue-300">
                📈 AIチャート分析
              </p>
              <p className="mt-1 text-2xl font-black">チャートを見る</p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-300">
                利確ライン・損切ライン・AI判断を確認
              </p>
            </div>
            <div className="text-4xl">›</div>
          </div>
        </Link>

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

        <section className="mt-5 rounded-[2rem] border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">ご利用前の注意</p>
          <p className="mt-2 text-xs font-bold leading-6 text-amber-900">
            SIGNALXは投資判断をサポートする情報提供サービスです。AI判定・スコア・利確/損切ラインは将来の利益を保証するものではありません。最終判断はご自身の責任で行ってください。
          </p>
        </section>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
            <BottomNavItem href="/" icon="🏠" label="Home" />
            <BottomNavItem href="/scan-mobile" icon="📈" label="Scan" />
            <BottomNavItem
              href={`/analysis/${signal.code}`}
              icon="🤖"
              label="AI"
              active
            />
            <BottomNavItem href="/evolution" icon="🧠" label="Learn" />
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