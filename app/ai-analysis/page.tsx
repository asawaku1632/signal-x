"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAiRank } from "@/app/lib/aiRank";

const proItems = [
  { title: "AI根拠分析", description: "なぜ買い・待ち・見送りなのかを詳しく表示" },
  { title: "類似パターン分析", description: "過去に似た値動きから勝率を確認" },
  { title: "AI得意銘柄比較", description: "SIGNALXが得意な銘柄と比較" },
  { title: "時間帯分析", description: "勝ちやすい時間帯をAIが解析" },
  { title: "期待値分析", description: "利益と損失のバランスを数値化" },
];

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

  const topStock = stocks[0];

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
    <main className="min-h-screen bg-zinc-50 text-zinc-900 pb-24">
      <div className="max-w-md mx-auto p-4">
        <header className="pt-4">
          <Link href="/" className="text-sm font-bold text-zinc-500">
            ← ホームへ戻る
          </Link>

          <h1 className="mt-5 text-4xl font-black">🧠 AI分析</h1>

          <p className="mt-2 text-sm font-bold text-zinc-500">
            SIGNALXの判断理由と過去成績を確認
          </p>
        </header>

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
            <section className="mt-6 rounded-3xl bg-white border border-zinc-200 shadow-sm p-5">
              <p className="text-xs font-bold text-blue-500">
                LIVE AI ANALYSIS
              </p>

              <div className="mt-3">
                <h2 className="text-3xl font-black">
                  {topStock.code} {topStock.name}
                </h2>
                <p className="mt-1 text-zinc-500 font-bold">
                  現在値 {yen(topStock.price)}
                </p>
              </div>

              <div
                className={`mt-5 rounded-3xl border p-5 text-center ${aiRank.bg}`}
              >
                <p className="text-sm font-black text-zinc-500">AI POWER</p>
                <p className={`text-6xl font-black mt-2 ${aiRank.color}`}>
                  {topStock.score}
                </p>
                <p className="mt-2 text-3xl tracking-wider">
                  {aiRank.stars}
                </p>
                <p className={`mt-2 text-3xl font-black ${aiRank.color}`}>
                  {aiRank.icon} {aiRank.rank}ランク
                </p>
                <p className="mt-2 font-bold text-zinc-700">
                  {aiRank.comment}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <Mini label="AI順位" value={`${topRank}位`} color="text-yellow-500" />
                <Mini
                  label="チャート判定"
                  value={getPatternText(topStock.patternSignal)}
                  color="text-blue-600"
                />
              </div>

              <div
                className={`mt-5 rounded-2xl border p-5 text-center ${getActionColor(
                  topStock.score
                )}`}
              >
                <p className="text-sm font-bold text-zinc-500">推奨行動</p>
                <p className="mt-2 text-3xl font-black">
                  {getAction(topStock.score)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
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
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <InsightCard title="🎯 AI勝率" value={`${aiWinRate}%`} note="AI POWERから推定" color="text-blue-600" />
                <InsightCard title="💰 期待利益" value={`+${yen(expectedProfit)}`} note={`+${expectedProfitRate.toFixed(2)}%`} color="text-green-600" />
                <InsightCard
                  title="⚠ リスク"
                  value={riskLevel}
                  note={riskLevel === "高" ? "過熱感に注意" : riskLevel === "中" ? "出来高急増中" : "比較的安定"}
                  color={riskLevel === "高" ? "text-red-500" : riskLevel === "中" ? "text-yellow-600" : "text-green-600"}
                />
                <InsightCard title="⏰ 推奨保有" value={holdTerm} note="短期スイング目安" color="text-purple-600" />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <Mini label="トレンド" value={getTrendText(topStock.trend)} color="text-blue-600" />
                <Mini label="パターン点" value={`${topStock.patternScore ?? 0}`} color="text-zinc-900" />
              </div>

              <section className="mt-5 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-200 p-4">
                <h2 className="text-xl font-black text-blue-700">
                  🤖 SIGNALX AIコメント
                </h2>

                <div className="mt-4 space-y-3">
                  {aiComments.map((comment) => (
                    <div
                      key={comment}
                      className="rounded-2xl bg-white border border-blue-100 p-3"
                    >
                      <p className="text-sm font-bold leading-7">
                        {comment}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-5 rounded-2xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-sm font-black text-blue-600">
                  AI判断理由
                </p>

                <p className="mt-2 text-sm font-bold leading-7">
                  {topStock.reason || "AI理由なし"}
                </p>

                <div className="mt-3 space-y-2">
                  {(topStock.patternReasons ?? []).map((reason) => (
                    <p key={reason} className="text-sm font-bold">
                      ✅ {reason}
                    </p>
                  ))}
                </div>
              </div>

              <Link
                href={`/analysis/${topStock.code}`}
                className="mt-5 block rounded-2xl bg-blue-600 py-4 text-center font-black text-white"
              >
                個別AI解析を見る
              </Link>

              <Link
                href={`/chart/${topStock.code}`}
                className="mt-3 block rounded-2xl bg-zinc-900 py-4 text-center font-black text-white"
              >
                リアルチャートを見る
              </Link>
            </section>

           {breakdown && (
  <section className="mt-6 rounded-3xl bg-white border border-zinc-200 shadow-sm p-5">
    <h2 className="text-2xl font-black">🧠 AI POWER 内訳</h2>

    <div className="mt-5 space-y-4">
      <ScoreRow
  label="📈 上昇率"
  score={breakdown.momentum}
/>

<ScoreRow
  label="💴 低価格補正"
  score={breakdown.lowPriceBonus}
/>

<ScoreRow
  label="📊 MA20"
  score={breakdown.trend}
/>

<ScoreRow
  label="📈 EMA"
  score={breakdown.ema}
/>

<ScoreRow
  label="💰 VWAP"
  score={breakdown.vwap}
/>

<ScoreRow
  label="📉 MACD"
  score={breakdown.macd}
/>

<ScoreRow
  label="🕯 チャートパターン"
  score={breakdown.pattern}
/>

<ScoreRow
  label="🪔 ローソク足"
  score={breakdown.candle}
/>

<ScoreRow
  label="📦 出来高"
  score={breakdown.volume}
/>

<ScoreRow
  label="📉 RSI"
  score={breakdown.rsi}
/>

<ScoreRow
  label="✨ パターン補正"
  score={breakdown.patternBonus}
/>
    </div>
  </section>
)}
          </>
        )}

        <section className="mt-6 rounded-3xl bg-zinc-900 text-white p-5">
          <p className="text-xs font-bold text-yellow-300">PRO ANALYSIS</p>

          <h2 className="mt-2 text-2xl font-black">有料版でさらに詳しく</h2>

          <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
            判断理由・類似パターン・期待値まで確認できます。
          </p>

          <div className="mt-5 space-y-3">
            {proItems.map((item) => (
              <div key={item.title} className="rounded-2xl bg-zinc-800 p-4">
                <p className="font-black">🔒 {item.title}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <button className="mt-5 w-full rounded-2xl bg-yellow-300 py-4 font-black text-black">
            PRO版を確認する
          </button>
        </section>
      </div>
    </main>
  );
}

function Mini({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4 text-center">
      <p className="text-sm font-bold text-zinc-500">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function InsightCard({
  title,
  value,
  note,
  color,
}: {
  title: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4 text-center">
      <p className="text-sm font-bold text-zinc-500">{title}</p>
      <p className={`text-3xl font-black mt-2 ${color}`}>{value}</p>
      <p className="text-xs font-bold text-zinc-400 mt-1">{note}</p>
    </div>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm font-bold mb-1">
        <span>{label}</span>
        <span>+{score}</span>
      </div>

      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${Math.min(score * 4, 100)}%` }}
        />
      </div>
    </div>
  );
}