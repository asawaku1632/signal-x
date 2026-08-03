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

function getPatternText(pattern?: string) {
  if (pattern === "W_BOTTOM_BREAK") return "Wボトム突破";
  if (pattern === "W_BOTTOM") return "Wボトム候補";
  if (pattern === "NONE") return "通常";
  return pattern || "通常";
}

function topFiveStyle(index: number, isCurrent: boolean) {
  if (isCurrent) {
    return "border-blue-400 bg-blue-50 ring-1 ring-blue-300 dark:border-blue-500 dark:bg-slate-800 dark:ring-blue-700";
  }
  if (index === 0)
    return "border-amber-300 bg-white dark:border-amber-700 dark:bg-slate-900";
  if (index === 1)
    return "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900";
  if (index === 2)
    return "border-orange-200 bg-white dark:border-orange-800 dark:bg-slate-900";
  return "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900";
}

function topFiveMedalStyle(index: number) {
  if (index === 0)
    return "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-slate-800 dark:text-amber-300 dark:ring-amber-700";
  if (index === 1)
    return "bg-slate-200 text-slate-700 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600";
  if (index === 2)
    return "bg-orange-100 text-orange-800 ring-1 ring-orange-300 dark:bg-slate-800 dark:text-orange-300 dark:ring-orange-700";
  return "bg-slate-50 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700";
}

function candidateNote(rank: string) {
  if (rank === "S") return "評価は高水準です。買い時を個別解析で確認してください。";
  if (rank === "A") return "評価は高めです。現在の行動と値動きを確認してください。";
  if (rank === "B") return "条件を確認し、無理に追わず判断してください。";
  if (rank === "C") return "慎重に値動きを確認したい候補です。";
  return "現時点では様子見を優先したい候補です。";
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
  const [totalStockList, setTotalStockList] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchAiAnalysis = async () => {
      setLoading(true);
      setError(false);

      try {
        const res = await fetch("/api/scan?limit=1000", { cache: "no-store" });
        if (!res.ok) throw new Error(`scan request failed: ${res.status}`);
        const json = await res.json();

        const list: Stock[] = Array.isArray(json)
          ? json
          : Array.isArray(json.stocks)
          ? json.stocks
          : [];

        if (list.length === 0) {
          setStocks([]);
          return;
        }

        setStocks(list);
        if (!Array.isArray(json) && Number.isFinite(Number(json.totalStockList))) {
          setTotalStockList(Number(json.totalStockList));
        }
      } catch (error) {
        console.error("ai analysis fetch error:", error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    void fetchAiAnalysis();
  }, []);

  const topFive = useMemo(() => stocks.slice(0, 5), [stocks]);
  const topStock = useMemo(() => {
    if (requestedSymbol) {
      const requestedStock = topFive.find(
        (stock) => String(stock.code) === requestedSymbol,
      );
      if (requestedStock) return requestedStock;
    }

    return stocks[0];
  }, [requestedSymbol, stocks, topFive]);
  const topRank = useMemo(
    () => stocks.findIndex((stock) => stock.code === topStock?.code) + 1,
    [stocks, topStock],
  );
  const breakdown = topStock?.scoreBreakdown ?? null;
  const aiRank = topStock ? getAiRank(topStock.score) : null;
  const aiComments = topStock ? buildAiComment(topStock) : [];
  const reasonItems = topStock
    ? Array.from(
        new Set(
          [
            ...(topStock.reason ?? "")
              .split("・")
              .map((reason) => reason.trim())
              .filter(Boolean),
            ...(topStock.patternReasons ?? []),
          ].filter(Boolean),
        ),
      )
    : [];

  const expectedProfit = topStock
    ? ((topStock.takeProfit ?? topStock.price) - topStock.price) * 100
    : 0;

  const expectedProfitRate =
    topStock && topStock.price > 0
      ? (((topStock.takeProfit ?? topStock.price) - topStock.price) /
          topStock.price) *
        100
      : 0;
  const requiredMoney = topStock ? topStock.price * 100 : 0;

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
  const selectedCount = totalStockList ?? stocks.length;
  const strongestReason = reasonItems[0] ?? getPatternText(topStock?.patternSignal);

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 pb-28 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-2xl px-3 py-3 min-[380px]:px-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Link href="/dashboard" className="text-sm font-bold text-blue-600 dark:text-blue-400">
            ← ホームへ戻る
          </Link>
          <h1 className="mt-3 text-2xl font-black text-slate-950 dark:text-slate-100">AI分析</h1>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">
            AIが本日の上位候補を比較し、注目すべき銘柄を分かりやすく表示します
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {selectedCount > 0 ? `${selectedCount.toLocaleString("ja-JP")}銘柄から選出` : "監視銘柄から選出"}
          </p>
        </header>

        <section className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-slate-900">
          <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">
            🎉 Ver1.0公開記念｜現在、全機能を無料公開中
          </p>
        </section>

        {loading && (
          <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
            <p className="mt-3 font-bold text-slate-600 dark:text-slate-300">AI分析候補を取得しています</p>
          </section>
        )}

        {!loading && error && !topStock && (
          <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="font-black">データを取得できませんでした</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-12 rounded-xl bg-blue-600 px-6 font-black text-white transition hover:bg-blue-700 active:scale-[0.98]">再読み込み</button>
          </section>
        )}

        {!loading && !error && !topStock && (
          <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="font-black">本日の候補が見つかりません</p>
            <Link href="/scan-mobile" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-blue-600 px-5 font-black text-white">Scanで条件を変更</Link>
          </section>
        )}

        {topStock && aiRank && (
          <>
            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 dark:border-blue-800 dark:bg-slate-800">
                <p className="text-base font-black text-blue-800 dark:text-blue-300">
                  {topRank === 1 ? "本日のAIランキング1位" : `選択中：AIランキング${topRank}位`}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {selectedCount > 0 ? `${selectedCount.toLocaleString("ja-JP")}銘柄から選出` : "AIの監視銘柄から選出"}
                </p>
              </div>
              {topRank > 1 && (
                <Link
                  href="/ai-analysis"
                  className="mt-2 flex min-h-10 w-full items-center justify-center rounded-xl border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 transition hover:bg-blue-50 active:scale-[0.99] dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
                >
                  ← 今日のAIランキング1位へ戻る
                </Link>
              )}
              <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-xl font-black leading-tight text-slate-950 dark:text-slate-100 min-[380px]:text-2xl">
                    {topStock.code} {topStock.name}
                  </h2>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
                    現在値 <span className="font-black text-slate-950 dark:text-slate-100">{yen(topStock.price)}</span>
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">
                    必要資金 <span className="font-black text-slate-950 dark:text-slate-100">{yen(requiredMoney)}</span>
                  </p>
                </div>
                <div className="shrink-0 rounded-xl border border-blue-200 bg-white px-3 py-2 text-center dark:border-blue-800 dark:bg-slate-800">
                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-300">AI POWER</p>
                  <p className="text-5xl font-black leading-none text-blue-600 dark:text-blue-400">{topStock.score}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-slate-800">
                  <p className="text-xs font-black text-blue-700 dark:text-blue-300">総合評価</p>
                  <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-300">銘柄の有望度</p>
                  <p className="mt-2 text-lg font-black">{aiRank.rank}ランク</p>
                  <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{aiRank.comment}</p>
                  <p className="mt-1 text-[10px] text-amber-500" aria-label={`${aiRank.stars} 星評価`}>{aiRank.stars}</p>
                </div>
                <div className={`rounded-xl border p-3 dark:bg-slate-800 ${getActionColor(topStock.score)}`}>
                  <p className="text-xs font-black">現在の行動</p>
                  <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-300">今の価格で取る行動</p>
                  <p className="mt-2 text-lg font-black">{getAction(topStock.score)}</p>
                  <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{candidateNote(aiRank.rank)}</p>
                </div>
              </div>

              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-900 dark:border-amber-800 dark:bg-slate-800 dark:text-amber-200">候補評価です。売買前に個別解析をご確認ください。</p>

              <section className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-slate-800">
                <h3 className="text-xs font-black text-orange-800 dark:text-orange-300">AIが最も伝えたい情報</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-800 dark:text-slate-200">{getAction(topStock.score)}です。{strongestReason}。{candidateNote(aiRank.rank)}</p>
              </section>

              <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <h3 className="text-base font-black">利益とリスク</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Mini label="利益確定目安" value={yen(topStock.takeProfit)} color="text-emerald-600 dark:text-emerald-400" />
                  <Mini label="損失を抑える目安" value={yen(topStock.stopLoss)} color="text-red-600 dark:text-red-400" />
                  <Mini label="期待利益" value={`+${yen(expectedProfit)}`} color="text-emerald-600 dark:text-emerald-400" />
                  <Mini label="必要資金" value={yen(requiredMoney)} color="text-slate-950 dark:text-slate-100" />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Mini label="期待度" value={`${aiWinRate}%`} color="text-blue-600 dark:text-blue-400" />
                  <Mini label="リスク" value={riskLevel} color={riskLevel === "高" ? "text-red-600 dark:text-red-400" : riskLevel === "中" ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"} />
                  <Mini label="保有目安" value={holdTerm} color="text-slate-700 dark:text-slate-200" />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">期待利益率 +{expectedProfitRate.toFixed(2)}%</p>
              </section>

              <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <h3 className="text-base font-black">主な注目理由</h3>
                <div className="mt-2 space-y-2">
                  {(reasonItems.length > 0 ? reasonItems : ["AI理由なし"]).slice(0, 3).map((reason) => (
                    <p key={reason} className="flex items-start gap-2 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300"><span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-blue-100 text-[10px] font-black text-blue-700 dark:bg-slate-800 dark:text-blue-300">✓</span><span className="min-w-0 break-words">{reason}</span></p>
                  ))}
                </div>
                {reasonItems.length > 3 && (
                  <details className="group mt-2">
                    <summary className="min-h-10 cursor-pointer list-none py-2 text-sm font-black text-blue-600 dark:text-blue-400"><span className="group-open:hidden">＋ほか{reasonItems.length - 3}件</span><span className="hidden group-open:inline">理由を閉じる</span></summary>
                    <div className="space-y-2">{reasonItems.slice(3).map((reason) => <p key={reason} className="flex items-start gap-2 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300"><span className="text-blue-600">✓</span><span>{reason}</span></p>)}</div>
                  </details>
                )}
              </section>

              <section className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-slate-800">
                <h3 className="text-base font-black text-blue-800 dark:text-blue-300">AIコメント</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">{aiComments[0]}</p>
                {aiComments.length > 1 && <details className="group mt-2"><summary className="min-h-10 cursor-pointer list-none py-2 text-sm font-black text-blue-600 dark:text-blue-400"><span className="group-open:hidden">コメントを詳しく見る ＋</span><span className="hidden group-open:inline">コメントを閉じる</span></summary><div className="space-y-2">{aiComments.slice(1).map((comment) => <p key={comment} className="rounded-xl bg-white p-3 text-sm font-medium leading-6 dark:bg-slate-900 dark:text-slate-300">{comment}</p>)}</div></details>}
              </section>

              {breakdown && (
                <details className="group mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                  <summary className="cursor-pointer list-none text-sm font-black"><span className="flex items-center justify-between gap-2"><span>AI POWERの内訳を見る</span><span className="text-blue-600 dark:text-blue-400">合計 {topStock.score} <span aria-hidden="true">⌄</span></span></span></summary>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ScoreItem label="上昇率" score={breakdown.momentum} /><ScoreItem label="低価格補正" score={breakdown.lowPriceBonus} /><ScoreItem label="MA20" score={breakdown.trend} /><ScoreItem label="EMA" score={breakdown.ema} /><ScoreItem label="VWAP" score={breakdown.vwap} /><ScoreItem label="MACD" score={breakdown.macd} /><ScoreItem label="パターン" score={breakdown.pattern} /><ScoreItem label="ローソク足" score={breakdown.candle} /><ScoreItem label="出来高" score={breakdown.volume} /><ScoreItem label="RSI" score={breakdown.rsi} /><ScoreItem label="パターン補正" score={breakdown.patternBonus} />
                  </div>
                </details>
              )}

              <Link href={`/analysis/${topStock.code}`} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-base font-black text-white transition hover:bg-blue-700 active:scale-[0.99]">個別解析を見る</Link>
              <Link href={`/chart/${topStock.code}`} className="mt-2 flex min-h-11 w-full items-center justify-center text-sm font-black text-blue-600 dark:text-blue-400">チャートを見る →</Link>
            </section>

            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="today-top-five-title">
              <h2 id="today-top-five-title" className="text-xl font-black">今日のTOP5</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">銘柄を選ぶと、上部のAI分析が切り替わります</p>
              <ol className="mt-3 space-y-2">
                {topFive.map((stock, index) => {
                  const isCurrent = stock.code === topStock.code;
                  const rank = getAiRank(stock.score);
                  const change = stock.changePercent ?? 0;
                  return (
                    <li key={stock.code}>
                      <Link href={`/ai-analysis?symbol=${encodeURIComponent(stock.code)}`} aria-current={isCurrent ? "page" : undefined} className={`block min-w-0 rounded-xl border p-3 transition active:scale-[0.99] ${topFiveStyle(index, isCurrent)}`}>
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${topFiveMedalStyle(index)}`} aria-label={`${index + 1}位`}>{index < 3 ? ["🥇", "🥈", "🥉"][index] : index + 1}</span>
                          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><p className="break-words text-sm font-black text-slate-950 dark:text-slate-100">{stock.code} {stock.name}</p>{isCurrent && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black text-white">✓ 表示中</span>}</div><p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-300">{rank.rank}ランク・{rank.comment}</p></div>
                          <div className="shrink-0 text-right"><p className="text-[9px] font-black text-blue-600 dark:text-blue-400">AI POWER</p><p className="text-2xl font-black leading-none text-blue-600 dark:text-blue-400">{Math.round(stock.score)}</p></div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-2 dark:border-slate-700"><CompactMetric label="変化率" value={`${change > 0 ? "+" : ""}${change}%`} valueClass={change > 0 ? "text-emerald-600 dark:text-emerald-400" : change < 0 ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-300"} /><CompactMetric label="必要資金" value={yen(stock.price * 100)} /><CompactMetric label="候補" value={getAction(stock.score).replace(/^[^ ]+ /, "")} /></div>
                      </Link>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-4 grid gap-2 min-[420px]:grid-cols-3">
                <Link href="/top-signals" className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-center text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">今日の注目銘柄を見る</Link>
                <Link href="/scan-mobile" className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-center text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Scanで候補を探す</Link>
                <Link href="/ranking" className="flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-center text-xs font-black text-blue-700 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300">AIランキングをもっと見る</Link>
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
    <div className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-300">{label}</p>
      <p className={`mt-1 break-words text-base font-black leading-tight ${color}`}>{value}</p>
    </div>
  );
}

function CompactMetric({
  label,
  value,
  valueClass = "text-slate-700 dark:text-slate-200",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-300">{label}</p>
      <p className={`mt-1 break-words text-xs font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

function ScoreItem({ label, score }: { label: string; score: number }) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-1 rounded-xl border bg-white px-2.5 py-2 text-xs font-bold dark:bg-slate-900 ${score === 0 ? "border-slate-200 text-slate-400 dark:border-slate-700" : "border-blue-100 text-slate-800 dark:border-blue-800 dark:text-slate-200"}`}>
      <span className="truncate">{label}</span>
      <span className={score > 0 ? "text-blue-600" : "text-zinc-400"}>{score > 0 ? `+${score}` : score}</span>
    </div>
  );
}

function AiAnalysisLoading() {
  return (
    <main className="min-h-screen bg-slate-50 pb-24 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-2xl p-4">
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="font-bold text-slate-500 dark:text-slate-300">AI分析候補を取得しています</p>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
