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

type DirectionFilter = "ALL" | PatternDirection;
type Props = {
  patterns: ChartPatternCatalogItem[];
  stocks: ShapeStock[];
  updatedAt: string | null;
  requestedCount: number;
  scannedCount: number;
  unavailable: boolean;
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

export default function ChartShapeSearchExplorer({
  patterns,
  stocks,
  updatedAt,
  requestedCount,
  scannedCount,
  unavailable,
}: Props) {
  const [direction, setDirection] = useState<DirectionFilter>("ALL");
  const [category, setCategory] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(30);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (selectedId) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);

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
      .filter((pattern) =>
        (direction === "ALL" || pattern.direction === direction) &&
        (category === "ALL" || pattern.category === category) &&
        (!q || pattern.name.toLocaleLowerCase("ja-JP").includes(q))
      )
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, [patterns, counts, direction, category, keyword]);

  const selectedPattern = patterns.find((pattern) => pattern.id === selectedId);
  const matches = useMemo(() => {
    if (!selectedId) return [];
    return stocks.flatMap((stock) => {
      const match = stock.patterns.find((pattern) => pattern.id === selectedId);
      return match ? [{ stock, confidence: match.confidence }] : [];
    }).sort((a, b) =>
      (b.confidence ?? -1) - (a.confidence ?? -1) ||
      (b.stock.score ?? -1) - (a.stock.score ?? -1) ||
      a.stock.code.localeCompare(b.stock.code)
    );
  }, [selectedId, stocks]);

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

      {selectedPattern && (
        <section ref={resultRef} aria-live="polite" className="mt-5 scroll-mt-4 rounded-2xl border-2 border-blue-300 bg-white p-3 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-blue-700">選択した形状に一致する銘柄</p>
              <h2 className="mt-1 text-lg font-black">{selectedPattern.name}</h2>
              <p className="mt-1 text-sm font-bold text-slate-600">{matches.length}銘柄</p>
            </div>
            <button type="button" onClick={() => setSelectedId(null)}
              className="min-h-11 shrink-0 rounded-xl border border-slate-300 px-3 text-xs font-black">
              閉じる
            </button>
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
        現段階は保存済みスキャンの形状検索です。画像の「1か月」などの期間別検索や、過去の勝率での絞り込みは未対応です。
      </p>
    </>
  );
}
