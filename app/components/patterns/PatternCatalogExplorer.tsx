"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PatternDiagram from "./PatternDiagram";
import {
  CHART_PATTERN_CATEGORIES,
  type ChartPatternCatalogItem,
} from "@/app/lib/chartPatternCatalog";
import type { PatternDirection } from "@/app/lib/chartPatternEngine";

type DirectionFilter = "ALL" | PatternDirection;
type CategoryFilter = "ALL" | ChartPatternCatalogItem["category"];

const directionFilters: Array<{ value: DirectionFilter; label: string }> = [
  { value: "ALL", label: "すべて" },
  { value: "BUY", label: "BUY" },
  { value: "SELL", label: "SELL" },
  { value: "NEUTRAL", label: "NEUTRAL" },
];

const directionDetails = {
  BUY: { label: "買いパターン", badge: "bg-emerald-600 text-white", card: "border-emerald-200" },
  SELL: { label: "売りパターン", badge: "bg-red-600 text-white", card: "border-red-200" },
  NEUTRAL: { label: "中立・方向確認", badge: "bg-blue-600 text-white", card: "border-blue-200" },
} as const;

const difficultyLabels = {
  BEGINNER: "初級",
  INTERMEDIATE: "中級",
  ADVANCED: "上級",
} as const;

export default function PatternCatalogExplorer({ patterns }: { patterns: ChartPatternCatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("ALL");
  const [category, setCategory] = useState<CategoryFilter>("ALL");

  const filteredPatterns = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ja");

    return patterns.filter((pattern) => {
      const matchesDirection = direction === "ALL" || pattern.direction === direction;
      const matchesCategory = category === "ALL" || pattern.category === category;
      const searchableText = [pattern.name, pattern.summary, pattern.category, pattern.id, ...pattern.engineNames]
        .join(" ")
        .toLocaleLowerCase("ja");
      const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);
      return matchesDirection && matchesCategory && matchesQuery;
    });
  }, [category, direction, patterns, query]);

  return (
    <section className="mt-5" aria-labelledby="pattern-list-heading">
      <h2 id="pattern-list-heading" className="text-2xl font-black">パターン一覧</h2>

      <div className="mt-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="pattern-search" className="text-sm font-black text-slate-700">パターン名を検索</label>
        <input
          id="pattern-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="名前・説明・カテゴリ・ID"
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <fieldset className="mt-4 min-w-0">
          <legend className="text-sm font-black text-slate-700">方向</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
            {directionFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setDirection(filter.value)}
                aria-pressed={direction === filter.value}
                className={`min-h-11 min-w-0 rounded-xl px-2 text-xs font-black transition ${direction === filter.value ? "bg-slate-900 text-white" : "border border-slate-200 bg-slate-50 text-slate-600"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label htmlFor="pattern-category" className="mt-4 block text-sm font-black text-slate-700">カテゴリ</label>
        <select
          id="pattern-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as CategoryFilter)}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="ALL">すべてのカテゴリ</option>
          {CHART_PATTERN_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <p className="mt-4 text-sm font-black text-slate-500" aria-live="polite">{filteredPatterns.length}件を表示</p>

      {filteredPatterns.length > 0 ? (
        <div className="mt-3 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPatterns.map((pattern) => {
            const styles = directionDetails[pattern.direction];
            return (
              <article key={pattern.id} className={`flex min-w-0 flex-col rounded-[1.5rem] border bg-white p-4 shadow-sm ${styles.card}`}>
                <PatternDiagram pattern={pattern} compact />
                <div className="mt-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-[10px] font-black tracking-wide text-slate-400">{pattern.id}</p>
                    <h3 className="mt-1 break-words text-lg font-black leading-snug">{pattern.name}</h3>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${styles.badge}`}>{styles.label}</span>
                </div>
                <p className="mt-3 break-words text-sm font-bold leading-6 text-slate-600">{pattern.summary}</p>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-xs min-[360px]:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-2"><dt className="font-black text-slate-400">カテゴリ</dt><dd className="mt-1 break-words font-black text-slate-700">{pattern.category}</dd></div>
                  <div className="rounded-xl bg-slate-50 p-2"><dt className="font-black text-slate-400">難易度</dt><dd className="mt-1 font-black text-slate-700">{difficultyLabels[pattern.difficulty]}</dd></div>
                </dl>
                <Link href={`/learning/patterns/${encodeURIComponent(pattern.id)}`} className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition active:scale-[0.99]">
                  詳細を見る
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-[1.5rem] border border-slate-200 bg-white p-6 text-center">
          <p className="font-black text-slate-700">条件に一致するパターンがありません</p>
          <button type="button" onClick={() => { setQuery(""); setDirection("ALL"); setCategory("ALL"); }} className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-black text-blue-700">
            条件をリセット
          </button>
        </div>
      )}
    </section>
  );
}
