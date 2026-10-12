"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import PatternDiagram from "@/app/components/patterns/PatternDiagram";
import {
  CHART_PATTERN_CATEGORIES,
  type ChartPatternCatalogItem,
} from "@/app/lib/chartPatternCatalog";
import type { PatternDirection } from "@/app/lib/chartPatternEngine";

export type ShapeStock = {
  code: string;
  name: string;
  score: number | null;
  price: number | null;
  patterns: Array<{ id: string; confidence: number | null }>;
};

// These are aggregate forward-study results per shape, not individual
// probabilities for the stocks currently matching that shape.
export type ShapePatternStat = {
  id: string;
  status: "COLLECTING" | "PROMISING" | "VALIDATED" | "OBSERVATION_ONLY";
  sampleCount: number;
  completed5dCount: number;
  winRate5d: number | null;
  avgDirectionalReturn5d: number | null;
  distinctCodes: number;
  distinctDates: number;
};

type ResearchFilter = "ALL" | "MIN20" | "VALIDATED";
type ResearchSort = "MATCHES" | "WINRATE" | "AVERAGE";

type DirectionFilter = "ALL" | PatternDirection;
type Props = {
  patterns: ChartPatternCatalogItem[];
  stocks: ShapeStock[];
  updatedAt: string | null;
  requestedCount: number;
  scannedCount: number;
  unavailable: boolean;
  historicalStats: ShapePatternStat[] | null;
  statsUnavailable: boolean;
};

const directions: Array<{ value: DirectionFilter; label: string }> = [
  { value: "ALL", label: "すべて" },
  { value: "BUY", label: "上昇型" },
  { value: "SELL", label: "下落型" },
  { value: "NEUTRAL", label: "方向待ち" },
];

function yen(value: number | null) {
  return value === null ? "価格未取得" : `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function signedPercent(value: number | null) {
  return value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function researchStatus(status: ShapePatternStat["status"] | undefined) {
  if (status === "VALIDATED") return "検証済み";
  if (status === "PROMISING") return "有望・途中経過";
  if (status === "COLLECTING") return "収集中";
  if (status === "OBSERVATION_ONLY") return "方向判定なし";
  return "結果なし";
}

export default function ChartShapeSearchExplorer({
  patterns,
  stocks,
  updatedAt,
  requestedCount,
  scannedCount,
  unavailable,
  historicalStats,
  statsUnavailable,
}: Props) {
  const [direction, setDirection] = useState<DirectionFilter>("ALL");
  const [category, setCategory] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(30);
  const [researchFilter, setResearchFilter] = useState<ResearchFilter>("ALL");
  const [researchSort, setResearchSort] = useState<ResearchSort>("MATCHES");
  const [minAiPower, setMinAiPower] = useState(0);
  const [minConfidence, setMinConfidence] = useState(0);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (selectedId) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);

  const researchById = useMemo(
    () => new Map((historicalStats ?? []).map((item) => [item.id, item])),
    [historicalStats],
  );

  const counts = useMemo(() => {
    const countById = new Map<string, number>();
    for (const stock of stocks) {
      // A stock is counted only once per detected pattern.
      for (const id of new Set(stock.patterns.map((pattern) => pattern.id))) {
        countById.set(id, (countById.get(id) ?? 0) + 1);
      }
    }
    return countById;
  }, [stocks]);

  const filteredPatterns = useMemo(() => {
    const q = keyword.trim().toLocaleLowerCase("ja-JP");
    return patterns
      .filter((pattern) => {
        const stat = researchById.get(pattern.id);
        return (direction === "ALL" || pattern.direction === direction) &&
          (category === "ALL" || pattern.category === category) &&
          (!q || pattern.name.toLocaleLowerCase("ja-JP").includes(q)) &&
          (researchFilter === "ALL" ||
            (researchFilter === "MIN20" && (stat?.completed5dCount ?? 0) >= 20) ||
            (researchFilter === "VALIDATED" && stat?.status === "VALIDATED"));
      })
      .sort((a, b) => {
        if (researchSort !== "MATCHES") {
          const x = researchById.get(a.id);
          const y = researchById.get(b.id);
          const xValue = researchSort === "WINRATE"
            ? (x?.completed5dCount ?? 0) >= 20 ? x?.winRate5d : null
            : (x?.completed5dCount ?? 0) >= 20 ? x?.avgDirectionalReturn5d : null;
          const yValue = researchSort === "WINRATE"
            ? (y?.completed5dCount ?? 0) >= 20 ? y?.winRate5d : null
            : (y?.completed5dCount ?? 0) >= 20 ? y?.avgDirectionalReturn5d : null;
          if (xValue !== null && xValue !== undefined && yValue !== null && yValue !== undefined && xValue !== yValue) {
            return yValue - xValue;
          }
          if (xValue !== null && xValue !== undefined) return -1;
          if (yValue !== null && yValue !== undefined) return 1;
        }
        return (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
      });
  }, [patterns, counts, direction, category, keyword, researchById, researchFilter, researchSort]);

  const selectedPattern = patterns.find((pattern) => pattern.id === selectedId);
  const selectedStat = selectedId ? researchById.get(selectedId) : undefined;
  const matches = useMemo(() => {
    if (!selectedId) return [];
    return stocks.flatMap((stock) => {
      const match = stock.patterns.find((pattern) => pattern.id === selectedId);
      return match && (minAiPower === 0 || (stock.score ?? -1) >= minAiPower) &&
        (minConfidence === 0 || (match.confidence ?? -1) >= minConfidence)
        ? [{ stock, confidence: match.confidence }] : [];
    }).sort((a, b) =>
      (b.confidence ?? -1) - (a.confidence ?? -1) ||
      (b.stock.score ?? -1) - (a.stock.score ?? -1) ||
      a.stock.code.localeCompare(b.stock.code)
    );
  }, [selectedId, stocks, minAiPower, minConfidence]);

  const hasData = updatedAt !== null && !unavailable;
  const dateLabel = updatedAt
    ? new Date(updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    : null;

  return (
    <>
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-black text-slate-500">検索データ</p>
        <p className="mt-1 text-sm font-black text-slate-800">
          {unavailable
            ? "データベースを読み取れませんでした"
            : dateLabel
              ? `保存スキャン：${dateLabel}（日本時間）`
              : "保存済みスキャンはまだありません"}
        </p>
        {hasData && (
          <p className="mt-1 text-xs font-bold text-slate-600">
            取得済み {scannedCount.toLocaleString("ja-JP")}銘柄
            {requestedCount > scannedCount
              ? `／スキャン対象 ${requestedCount.toLocaleString("ja-JP")}銘柄`
              : ""}
            ・形状検出あり {stocks.length.toLocaleString("ja-JP")}銘柄
          </p>
        )}
        <p className="mt-2 text-xs leading-5 text-amber-800">
          最新のリアルタイム株価ではありません。件数は保存スキャンに含まれる銘柄だけの数字です。
          画面を操作しても再スキャン・売買・通知・学習データ更新は行いません。
        </p>
      </section>

      <section aria-label="チャート形状の絞り込み" className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="grid grid-cols-4 gap-1.5">
          {directions.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => { setDirection(option.value); setSelectedId(null); }}
              aria-pressed={direction === option.value}
              className={`min-h-11 rounded-xl px-1 text-xs font-black ${direction === option.value
                ? "bg-blue-700 text-white"
                : "bg-slate-100 text-slate-600"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-black text-slate-700">
            カテゴリ
            <select
              value={category}
              onChange={(event) => { setCategory(event.target.value); setSelectedId(null); }}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="ALL">すべてのカテゴリ</option>
              {CHART_PATTERN_CATEGORIES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-black text-slate-700">
            パターン名
            <input
              type="search"
              value={keyword}
              onChange={(event) => { setKeyword(event.target.value); setSelectedId(null); }}
              placeholder="例：ダブルボトム"
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
            />
          </label>
        </div>
      </section>

      {historicalStats !== null && (
        <section aria-label="研究実績による形状の絞り込み" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-black text-amber-950">🔒 オーナー専用：パターン別の過去実績</h2>
          <p className="mt-2 text-xs leading-5 text-amber-950">
            保存した発生日から5営業日後の方向一致率と平均騰落率です。
            下落型は「その後に株価が下がった割合」を勝率とします。売買利益や個別銘柄の上昇確率ではありません。
          </p>
          {statsUnavailable ? (
            <p className="mt-3 text-sm font-bold text-red-700">研究データを取得できませんでした。形状検索は引き続き利用できます。</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-black text-amber-950">
                実績の絞り込み
                <select value={researchFilter}
                  onChange={(event) => { setResearchFilter(event.target.value as ResearchFilter); setSelectedId(null); }}
                  className="mt-1 h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm text-slate-900">
                  <option value="ALL">すべて（研究途中も表示）</option>
                  <option value="MIN20">5日後の確定結果20件以上</option>
                  <option value="VALIDATED">検証済みパターンのみ</option>
                </select>
              </label>
              <label className="text-xs font-black text-amber-950">
                パターンの並び替え
                <select value={researchSort}
                  onChange={(event) => setResearchSort(event.target.value as ResearchSort)}
                  className="mt-1 h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm text-slate-900">
                  <option value="MATCHES">一致銘柄数が多い順</option>
                  <option value="WINRATE">5日後の方向一致率が高い順（20件以上）</option>
                  <option value="AVERAGE">5日後の方向別平均騰落率が高い順（20件以上）</option>
                </select>
              </label>
            </div>
          )}
          <p className="mt-2 text-xs font-bold leading-5 text-amber-900">
            実績が少ないパターンは数値が大きく変動する場合があります。研究データは本人以外に表示しません。
          </p>
        </section>
      )}

      {selectedPattern && (
        <section ref={resultRef} aria-live="polite" className="mt-5 scroll-mt-4 rounded-2xl border-2 border-blue-300 bg-white p-3 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-blue-700">選択した形状に一致する銘柄</p>
              <h2 className="mt-1 text-lg font-black">{selectedPattern.name}</h2>
              <p className="mt-1 text-sm font-bold text-slate-600">
                {matches.length}銘柄
                {(minAiPower > 0 || minConfidence > 0) && (
                  <span className="text-xs text-slate-500">（絞り込み前 {counts.get(selectedId ?? "") ?? 0}銘柄）</span>
                )}
              </p>
            </div>
            <button type="button" onClick={() => setSelectedId(null)}
              className="min-h-11 shrink-0 rounded-xl border border-slate-300 px-3 text-xs font-black">
              閉じる
            </button>
          </div>
          {historicalStats !== null && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-slate-800">
              <p className="font-black">過去5営業日の研究実績：{researchStatus(selectedStat?.status)}</p>
              <p>方向一致率：{percent((selectedStat?.completed5dCount ?? 0) > 0 ? selectedStat?.winRate5d ?? null : null)}
                （確定 {selectedStat?.completed5dCount ?? 0}件）</p>
              <p>方向別平均騰落率：{signedPercent(selectedStat?.avgDirectionalReturn5d ?? null)}
                ／対象 {selectedStat?.distinctCodes ?? 0}銘柄・{selectedStat?.distinctDates ?? 0}日</p>
              <p className="text-amber-900">この統計は同じ形を検出した過去の集計です。ここに並ぶ銘柄個別の勝率ではありません。</p>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs font-black text-slate-700">
              AI POWER
              <select value={minAiPower} onChange={(event) => { setMinAiPower(Number(event.target.value)); setVisible(30); }}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2 text-sm">
                <option value={0}>すべて</option>
                <option value={70}>70以上</option>
                <option value={85}>85以上</option>
                <option value={95}>95以上</option>
              </select>
            </label>
            <label className="text-xs font-black text-slate-700">
              形状の検出信頼度
              <select value={minConfidence} onChange={(event) => { setMinConfidence(Number(event.target.value)); setVisible(30); }}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2 text-sm">
                <option value={0}>すべて</option>
                <option value={75}>75%以上</option>
                <option value={85}>85%以上</option>
                <option value={95}>95%以上</option>
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            検出信頼度順に表示。信頼度は形状への一致度であり、上昇・下落の確率や勝率ではありません。
          </p>
          {matches.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
              {hasData ? "今回の保存スキャンでは一致した銘柄がありません。" : "スキャンデータを確認できません。"}
            </p>
          ) : (
            <>
              <div className="mt-4 space-y-2">
                {matches.slice(0, visible).map(({ stock, confidence }) => (
                  <article key={stock.code} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black">{stock.name} <span className="text-slate-500">({stock.code})</span></p>
                        <p className="mt-1 text-xs font-bold text-slate-600">
                          株価 {yen(stock.price)} ・ AI POWER {stock.score === null ? "—" : Math.round(stock.score)}
                        </p>
                        <p className="mt-1 text-xs font-black text-blue-700">
                          検出信頼度 {confidence === null ? "—" : `${Math.round(confidence)}%`}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Link href={`/analysis/${encodeURIComponent(stock.code)}`}
                          className="grid min-h-11 place-items-center rounded-xl bg-blue-700 px-3 text-xs font-black text-white">
                          AI解析
                        </Link>
                        <Link href={`/chart/${encodeURIComponent(stock.code)}`}
                          className="grid min-h-11 place-items-center rounded-xl border border-blue-300 bg-white px-3 text-xs font-black text-blue-700">
                          チャート
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {visible < matches.length && (
                <button type="button" onClick={() => setVisible((n) => n + 30)}
                  className="mt-3 min-h-11 w-full rounded-xl border border-blue-300 text-sm font-black text-blue-700">
                  さらに30件を見る
                </button>
              )}
            </>
          )}
        </section>
      )}

      <section className="mt-5">
        <h2 className="text-lg font-black">形状を選ぶ <span className="text-sm text-slate-500">（{filteredPatterns.length}種類）</span></h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredPatterns.map((pattern) => (
            <article key={pattern.id}
              className={`rounded-xl border-2 p-2 text-left shadow-sm ${selectedId === pattern.id
                ? "border-blue-600 bg-blue-50"
                : "border-slate-200 bg-white"}`}
            >
              <p className="min-h-10 text-center text-xs font-black leading-5 sm:text-sm">{pattern.name}</p>
              <PatternDiagram pattern={pattern} compact />
              {historicalStats !== null && (
                <div className="mt-2 rounded-lg bg-amber-50 px-2 py-2 text-center text-[11px] font-bold leading-5 text-amber-950">
                  <p>{researchStatus(researchById.get(pattern.id)?.status)}</p>
                  <p>5日方向一致率 {percent((researchById.get(pattern.id)?.completed5dCount ?? 0) > 0
                    ? researchById.get(pattern.id)?.winRate5d ?? null : null)}
                    （{researchById.get(pattern.id)?.completed5dCount ?? 0}件）</p>
                  <p>5日方向別平均 {signedPercent(researchById.get(pattern.id)?.avgDirectionalReturn5d ?? null)}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => { setSelectedId(pattern.id); setVisible(30); }}
                aria-pressed={selectedId === pattern.id}
                className="mt-2 min-h-11 w-full rounded-lg bg-blue-50 px-1 text-center text-sm font-black text-blue-700 transition active:scale-[0.99]"
              >
                {hasData ? `${counts.get(pattern.id) ?? 0}銘柄を見る` : "形状を選ぶ"}
              </button>
            </article>
          ))}
        </div>
        {filteredPatterns.length === 0 && (
          <p className="mt-4 rounded-xl bg-white p-5 text-sm font-bold text-slate-600">条件に合う形状がありません。</p>
        )}
      </section>
      <p className="mt-5 text-center text-xs font-bold leading-6 text-slate-500">
        現段階は保存済みスキャンを対象とします。過去実績は形状別の集計であり、将来の収益を保証しません。
        画像の「1か月」など任意の期間を指定した形状検索は未対応です。
      </p>
    </>
  );
}
