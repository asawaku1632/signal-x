"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAiRank } from "@/app/lib/aiRank";
import BottomNav from "@/app/components/BottomNav";


type Stock = {
  code: string;
  name: string;
  score: number;
  price: number;
  changePercent?: number;
  rsi?: number;
  volumeRatio?: number;
  reason?: string;
  takeProfit?: number;
  stopLoss?: number;
  trend?: string;
  ma20?: number | null;
  ema20?: number | null;
  ema75?: number | null;
  vwap?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  macdHistogram?: number | null;
  candleSignal?: string;
  patternSignal?: string;
  patternScore?: number;
  patternReasons?: string[];
  scoreBreakdown?: {
    momentum: number;
    lowPriceBonus: number;
    trend: number;
    ema: number;
    vwap: number;
    macd: number;
    pattern: number;
    candle: number;
    rsi: number;
    volume: number;
    patternBonus: number;
  };
};

function yen(value?: number | null) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function getAction(score = 0) {
  if (score >= 85) return "🟢 買い候補";
  if (score >= 70) return "🟡 押し目待ち";
  if (score >= 50) return "⚪ 様子見";
  return "🔴 見送り";
}

function getActionColor(score = 0) {
  if (score >= 85) return "bg-green-50 border-green-200 text-green-600";
  if (score >= 70) return "bg-yellow-50 border-yellow-200 text-yellow-600";
  if (score >= 50) return "bg-blue-50 border-blue-200 text-blue-600";
  return "bg-red-50 border-red-200 text-red-500";
}

function getTrendText(trend?: string) {
  if (trend === "UPTREND") return "上昇トレンド";
  if (trend === "DOWNTREND") return "下降トレンド";
  return "判定なし";
}

function getPatternText(pattern?: string) {
  if (pattern === "W_BOTTOM_BREAK") return "Wボトム突破";
  if (pattern === "W_BOTTOM") return "Wボトム候補";
  if (pattern === "NONE") return "通常";
  return pattern || "通常";
}


  


function buildAiComment(stock: Stock) {
  const comments: string[] = [];

  const score = stock.score;
  const rsi = stock.rsi ?? 50;
  const volumeRatio = stock.volumeRatio ?? 1;
    const ema20 = stock.ema20 ?? null;
  const ema75 = stock.ema75 ?? null;
  const vwap = stock.vwap ?? null;
  const macd = stock.macd ?? null;
  const macdSignal = stock.macdSignal ?? null;
  const macdHistogram = stock.macdHistogram ?? null;
  const takeProfit = stock.takeProfit ?? stock.price;
  const stopLoss = stock.stopLoss ?? stock.price;

  if (score >= 95) {
    comments.push(
      `${stock.code} ${stock.name}は、現在AI POWERが${score}でSランク判定です。複数の買い材料が重なっており、SIGNALXでは本日の有力候補として見ています。`
    );
  } else if (score >= 85) {
    comments.push(
      `${stock.code} ${stock.name}は、AI POWERが${score}で強い買い候補です。短期的な値動きとチャート形状の両方に注目です。`
    );
  } else {
    comments.push(
      `${stock.code} ${stock.name}は、AI POWERが${score}です。無理に飛び乗らず、条件が整うか確認したい局面です。`
    );
  }

  if (stock.trend === "UPTREND") {
    comments.push(
      `現在価格はMA20を上回っており、短期トレンドは上向きです。流れとしては買い優勢ですが、高値追いは避けたいところです。`
    );
  } else if (stock.trend === "DOWNTREND") {
    comments.push(
      `現在価格はMA20を下回っており、短期トレンドは弱めです。反発確認までは慎重に見たい局面です。`
    );
  }
    if (ema20 !== null && stock.price > ema20) {
    comments.push(
      `EMA20は${yen(ema20)}で、現在価格はEMA20を上回っています。短期の移動平均線より上で推移しており、買い優勢の流れを維持しています。`
    );
  } else if (ema20 !== null && stock.price < ema20) {
    comments.push(
      `EMA20は${yen(ema20)}で、現在価格はEMA20を下回っています。短期ではやや弱さが出ているため、反発確認を待ちたい局面です。`
    );
  }

  if (ema75 !== null && stock.price > ema75) {
    comments.push(
      `EMA75も上回っており、中期トレンドでも強さがあります。短期だけでなく、やや広い時間軸でも買いが入りやすい形です。`
    );
  }

  if (vwap !== null && stock.price > vwap) {
    comments.push(
      `VWAPは${yen(vwap)}で、現在価格はVWAPを上回っています。平均取得価格より上で推移しており、当日の需給は買い優勢です。`
    );
  } else if (vwap !== null && stock.price < vwap) {
    comments.push(
      `VWAPは${yen(vwap)}で、現在価格はVWAPを下回っています。当日の需給ではまだ上値が重く、無理なエントリーは避けたい場面です。`
    );
  }

  if (macd !== null && macdSignal !== null && macd > macdSignal) {
    comments.push(
      `MACDはシグナルを上回っており、短期の上昇モメンタムが確認できます。MACDヒストグラムは${macdHistogram ?? 0}で、勢いが続くか注目です。`
    );
  } else if (macd !== null && macdSignal !== null && macd < macdSignal) {
    comments.push(
      `MACDはシグナルを下回っており、短期モメンタムは弱めです。買い判断にはもう一段の反発確認が欲しい場面です。`
    );
  }

  if (stock.patternSignal === "W_BOTTOM_BREAK") {
    comments.push(
      `チャートではWボトム突破を検出しています。底打ち後にネックライン付近まで回復しており、上昇継続の期待があります。`
    );
  } else if (stock.patternSignal === "W_BOTTOM") {
    comments.push(
      `チャートではWボトム候補を検出しています。まだ突破確定ではないため、次の足で上方向に続くか確認したいです。`
    );
  }

  if (volumeRatio >= 3) {
    comments.push(
      `出来高は通常より大きく増加しています。市場参加者の注目が集まっている可能性があり、値動きが大きくなりやすいです。`
    );
  } else if (volumeRatio >= 2) {
    comments.push(
      `出来高は${volumeRatio}倍で増加傾向です。買い圧力が続くかを確認したいポイントです。`
    );
  }

  if (rsi >= 75) {
    comments.push(
      `RSIは${rsi}でやや過熱気味です。短期では利益確定売りが出る可能性もあるため、押し目を待つ判断も有効です。`
    );
  } else if (rsi >= 65) {
    comments.push(
      `RSIは${rsi}でやや高めです。勢いはありますが、飛び乗りよりもタイミングを見たい局面です。`
    );
  } else if (rsi <= 30) {
    comments.push(
      `RSIは${rsi}で売られ過ぎ水準です。反発狙いの候補として監視価値があります。`
    );
  }

  comments.push(
    `利確目安は${yen(takeProfit)}、損切目安は${yen(stopLoss)}です。100株ベースでは、利確到達時におよそ${yen(
      (takeProfit - stock.price) * 100
    )}を狙う計算です。`
  );

  return comments;
}

export default function AiAnalysisPage() {
  return (
    <Suspense fallback={<AiAnalysisLoading />}>
      <AiAnalysisContent />
    </Suspense>
  );
}

function AiAnalysisContent() {
  const searchParams = useSearchParams();
  const requestedSymbol = searchParams.get("symbol");

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAiAnalysis = async () => {
      try {
        const res = await fetch("/api/scan?limit=1000", { cache: "no-store" });
        const json = await res.json();

        const list: Stock[] = Array.isArray(json)
          ? json
          : Array.isArray(json.stocks)
          ? json.stocks
          : [];

        setStocks(list);
      } catch (error) {
        console.error("ai analysis fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAiAnalysis();
  }, []);

  const topStock = useMemo(() => {
    if (!stocks.length) return undefined;

    if (requestedSymbol) {
      const matched = stocks.find(
        (stock) => String(stock.code) === requestedSymbol
      );
      if (matched) return matched;
    }

    return stocks[0];
  }, [stocks, requestedSymbol]);

  const topRank = useMemo(() => {
    if (!topStock) return 0;
    return stocks.findIndex((stock) => stock.code === topStock.code) + 1;
  }, [stocks, topStock]);

  const breakdown = topStock?.scoreBreakdown ?? null;
  const aiRank = topStock ? getAiRank(topStock.score) : null;
  const aiComments = topStock ? buildAiComment(topStock) : [];

  const expectedProfit = topStock
    ? ((topStock.takeProfit ?? topStock.price) - topStock.price) * 100
    : 0;

  const expectedProfitRate =
    topStock && topStock.price > 0
      ? (((topStock.takeProfit ?? topStock.price) - topStock.price) /
          topStock.price) *
        100
      : 0;

  const aiWinRate = topStock
    ? Math.min(95, Math.max(45, Math.round(topStock.score * 0.75 + 12)))
    : 0;

  const riskLevel =
    topStock && (topStock.rsi ?? 50) >= 75
      ? "高"
      : topStock && (topStock.volumeRatio ?? 1) >= 3
      ? "中"
      : "低";

  const holdTerm =
    topStock && topStock.score >= 90
      ? "1〜3営業日"
      : topStock && topStock.score >= 75
      ? "3〜5営業日"
      : "様子見";

  return (
    <main className="min-h-screen bg-zinc-50 pb-28 text-zinc-900">
      <div className="mx-auto max-w-md px-4 py-3">
        <header className="pt-2">
          <Link href="/dashboard" className="text-sm font-bold text-zinc-500">
            ← ホームへ戻る
          </Link>
          <h1 className="mt-3 text-3xl font-black">🧠 AI分析</h1>
          <p className="mt-1 text-xs font-bold text-zinc-500">
            SIGNALXの判断理由と詳細分析を確認
          </p>
        </header>

        <section className="mt-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 shadow-sm">
          <p className="text-sm font-black text-emerald-700">
            🎉 Ver1.0公開記念｜現在、全機能を無料公開中
          </p>
          <p className="mt-1 text-[11px] font-bold leading-4 text-zinc-500">
            SIGNALXをより多くの方に体験していただくため、AIの判断理由・AI POWER内訳・利確損切目安などを無料で公開しています。
          </p>
        </section>

        {loading && (
          <section className="mt-6 rounded-3xl bg-white border border-zinc-200 shadow-sm p-5">
            <p className="font-bold text-zinc-500">
              AI分析データを読み込み中...
            </p>
          </section>
        )}

        {!loading && !topStock && (
          <section className="mt-6 rounded-3xl bg-white border border-zinc-200 shadow-sm p-5">
            <p className="font-bold text-red-500">
              AI分析データを取得できませんでした
            </p>
          </section>
        )}

        {topStock && aiRank && (
          <>
            <section className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold text-blue-500">本日のAI分析</p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-2xl font-black leading-tight">
                    {topStock.code} {topStock.name}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-zinc-500">
                    現在値 <span className="text-lg text-zinc-900">{yen(topStock.price)}</span>
                  </p>
                </div>
                <div className={`shrink-0 rounded-2xl border px-3 py-2 text-center ${aiRank.bg}`}>
                  <p className="text-[10px] font-black text-zinc-500">AI POWER</p>
                  <p className={`text-4xl font-black leading-none ${aiRank.color}`}>{topStock.score}</p>
                  <p className={`mt-1 text-sm font-black ${aiRank.color}`}>
                    {aiRank.icon} {aiRank.rank}ランク
                  </p>
                  <p className="text-xs tracking-tight" aria-label={`${aiRank.stars} 星評価`}>
                    {aiRank.stars}
                  </p>
                </div>
              </div>

              <p className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-600">
                {aiRank.comment}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Mini label="AI順位" value={`${topRank}位`} color="text-yellow-600" />
                <Mini
                  label="チャート判定"
                  value={getPatternText(topStock.patternSignal)}
                  color="text-blue-600"
                />
                <Mini label="推奨行動" value={getAction(topStock.score)} color="text-green-600" className={getActionColor(topStock.score)} />
                <Mini label="AI期待度" value={`${aiWinRate}%`} color="text-blue-600" />
                <Mini label="リスク" value={riskLevel} color={riskLevel === "高" ? "text-red-500" : riskLevel === "中" ? "text-yellow-600" : "text-green-600"} />
                <Mini label="推奨保有" value={holdTerm} color="text-purple-600" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Mini
                  label="利確目標"
                  value={yen(topStock.takeProfit)}
                  color="text-green-600"
                />
                <Mini
                  label="損切目標"
                  value={yen(topStock.stopLoss)}
                  color="text-red-500"
                />
                <InsightCard
                  title="💰 期待利益"
                  value={`+${yen(expectedProfit)}`}
                  note={`+${expectedProfitRate.toFixed(2)}%`}
                  color="text-green-600"
                  className="col-span-2"
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Mini label="トレンド" value={getTrendText(topStock.trend)} color="text-blue-600" />
                <Mini label="パターン点" value={`${topStock.patternScore ?? 0}`} color="text-zinc-900" />
              </div>

              <section className="mt-3 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-3">
                <h2 className="text-base font-black text-blue-700">🤖 SIGNALX AIコメント</h2>
                <p className="mt-2 line-clamp-4 text-sm font-bold leading-6">{aiComments[0]}</p>
                <details className="group mt-2">
                  <summary className="cursor-pointer list-none rounded-xl border border-blue-200 bg-white px-3 py-2 text-center text-xs font-black text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                    <span className="group-open:hidden">AIコメントを詳しく見る ＋</span>
                    <span className="hidden group-open:inline">AIコメントを閉じる −</span>
                  </summary>
                  <div className="mt-2 space-y-2">
                    {aiComments.map((comment) => (
                      <p key={comment} className="rounded-xl border border-blue-100 bg-white p-3 text-sm font-bold leading-6">{comment}</p>
                    ))}
                  </div>
                </details>
              </section>

              <details className="group mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                <summary className="cursor-pointer list-none text-sm font-black text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  <span className="flex items-center justify-between">
                    <span>AI判断理由を見る</span><span aria-hidden="true" className="group-open:rotate-180">⌄</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm font-bold leading-6">{topStock.reason || "AI理由なし"}</p>
                <div className="mt-2 space-y-1.5">
                  {(topStock.patternReasons ?? []).map((reason) => (
                    <p key={reason} className="text-sm font-bold">✅ {reason}</p>
                  ))}
                </div>
              </details>

              {breakdown && (
                <details className="group mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <summary className="cursor-pointer list-none text-sm font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                    <span className="flex items-center justify-between gap-2">
                      <span>🧠 AI POWER 内訳</span>
                      <span className="flex items-center gap-2"><span className="text-blue-600">合計 {topStock.score}</span><span aria-hidden="true" className="group-open:rotate-180">⌄</span></span>
                    </span>
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ScoreItem label="📈 上昇率" score={breakdown.momentum} />
                    <ScoreItem label="💴 低価格補正" score={breakdown.lowPriceBonus} />
                    <ScoreItem label="📊 MA20" score={breakdown.trend} />
                    <ScoreItem label="📈 EMA" score={breakdown.ema} />
                    <ScoreItem label="💰 VWAP" score={breakdown.vwap} />
                    <ScoreItem label="📉 MACD" score={breakdown.macd} />
                    <ScoreItem label="🕯 パターン" score={breakdown.pattern} />
                    <ScoreItem label="🪔 ローソク足" score={breakdown.candle} />
                    <ScoreItem label="📦 出来高" score={breakdown.volume} />
                    <ScoreItem label="📉 RSI" score={breakdown.rsi} />
                    <ScoreItem label="✨ パターン補正" score={breakdown.patternBonus} />
                  </div>
                </details>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href={`/analysis/${topStock.code}`} className="flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-2 py-3 text-center text-sm font-black text-white">個別AI解析を見る</Link>
                <Link href={`/chart/${topStock.code}`} className="flex min-h-12 items-center justify-center rounded-2xl border border-zinc-300 bg-white px-2 py-3 text-center text-sm font-black text-zinc-800">リアルチャートを見る</Link>
              </div>
            </section>
          </>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function Mini({
  label,
  value,
  color,
  className = "",
}: {
  label: string;
  value: string;
  color: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-zinc-100 bg-zinc-50 p-2.5 text-center ${className}`}>
      <p className="text-[11px] font-bold text-zinc-500">{label}</p>
      <p className={`mt-1 break-words text-base font-black leading-tight ${color}`}>{value}</p>
    </div>
  );
}

function InsightCard({
  title,
  value,
  note,
  color,
  className = "",
}: {
  title: string;
  value: string;
  note: string;
  color: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-zinc-100 bg-zinc-50 p-2.5 text-center ${className}`}>
      <p className="text-[11px] font-bold text-zinc-500">{title}</p>
      <p className={`mt-1 text-lg font-black ${color}`}>{value}</p>
      <p className="text-xs font-bold text-zinc-400 mt-1">{note}</p>
    </div>
  );
}

function ScoreItem({ label, score }: { label: string; score: number }) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-1 rounded-xl border bg-white px-2.5 py-2 text-xs font-bold ${score === 0 ? "border-zinc-100 text-zinc-400" : "border-blue-100 text-zinc-800"}`}>
      <span className="truncate">{label}</span>
      <span className={score > 0 ? "text-blue-600" : "text-zinc-400"}>{score > 0 ? `+${score}` : score}</span>
    </div>
  );
}

function AiAnalysisLoading() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 pb-24">
      <div className="max-w-md mx-auto p-4">
        <section className="mt-6 rounded-3xl bg-white border border-zinc-200 shadow-sm p-5">
          <p className="font-bold text-zinc-500">AI分析データを読み込み中...</p>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
