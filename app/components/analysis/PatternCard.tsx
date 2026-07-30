"use client";

import { useState } from "react";
import Link from "next/link";
import type { DetectedChartPattern } from "@/app/lib/chartPatternEngine";
import { hasChartPatternCatalogItem } from "@/app/lib/chartPatternCatalog";

type PatternCardProps = {
  pattern: DetectedChartPattern;
  rank: number;
  code: string;
};

const directionStyles = {
  BUY: {
    label: "買いシグナル",
    card: "border-emerald-200 bg-emerald-50/70",
    badge: "bg-emerald-600 text-white",
    bar: "bg-emerald-500",
    score: "text-emerald-700",
  },
  SELL: {
    label: "売りシグナル",
    card: "border-red-200 bg-red-50/70",
    badge: "bg-red-600 text-white",
    bar: "bg-red-500",
    score: "text-red-700",
  },
  NEUTRAL: {
    label: "方向確認中",
    card: "border-slate-200 bg-slate-50/80",
    badge: "bg-blue-600 text-white",
    bar: "bg-blue-500",
    score: "text-slate-700",
  },
} as const;

function formatScore(score: number) {
  if (score > 0) return `+${score}`;
  return String(score);
}

function getRankLabel(rank: number) {
  if (rank === 1) return "最有力";
  if (rank === 2) return "2番目";
  return "3番目";
}

export default function PatternCard({ pattern, rank, code }: PatternCardProps) {
  const [expanded, setExpanded] = useState(false);
  const confidence = Math.round(
    Math.min(Math.max(pattern.confidence, 0), 100),
  );
  const styles = directionStyles[pattern.direction];
  const visibleReasons = expanded ? pattern.reasons : pattern.reasons.slice(0, 4);
  const detailsId = `pattern-details-${pattern.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${rank}`;
  const hasCatalogDetail = hasChartPatternCatalogItem(pattern.id);

  return (
    <article className={`min-w-0 rounded-2xl border p-4 ${styles.card}`}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black tracking-[0.14em] text-slate-500">
            {getRankLabel(rank)}
          </p>
          <h3 className="mt-1 break-words text-lg font-black leading-snug text-slate-900">
            {pattern.name}
          </h3>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${styles.badge}`}>
          {styles.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <div className="min-w-0 rounded-xl bg-white/80 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black text-slate-600">信頼度</span>
            <span className="shrink-0 text-base font-black text-slate-900">{confidence}%</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label={`${pattern.name}の信頼度`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={confidence}
          >
            <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${confidence}%` }} />
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2">
          <span className="break-words text-[11px] font-black text-slate-600">Pattern Score</span>
          <span className={`shrink-0 text-xl font-black ${styles.score}`}>
            {formatScore(pattern.score)}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-black text-slate-700">検出理由</p>
        {visibleReasons.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {visibleReasons.map((reason, index) => (
              <li key={`${pattern.id}-reason-${index}`} className="flex min-w-0 items-start gap-2 text-xs font-bold leading-5 text-slate-600">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span className="min-w-0 break-words">{reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs font-bold text-slate-500">検出理由の詳細はありません。</p>
        )}
      </div>

      {expanded && (
        <dl id={detailsId} className="mt-3 grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white/80 p-3 text-xs min-[360px]:grid-cols-2">
          <div className="min-w-0">
            <dt className="font-black text-slate-500">Pattern ID</dt>
            <dd className="mt-0.5 break-all font-bold text-slate-800">{pattern.id}</dd>
          </div>
          <div>
            <dt className="font-black text-slate-500">方向</dt>
            <dd className="mt-0.5 font-bold text-slate-800">{pattern.direction}（{styles.label}）</dd>
          </div>
          <div>
            <dt className="font-black text-slate-500">信頼度</dt>
            <dd className="mt-0.5 font-bold text-slate-800">{confidence}%</dd>
          </div>
          <div>
            <dt className="font-black text-slate-500">Pattern Score</dt>
            <dd className="mt-0.5 font-bold text-slate-800">{formatScore(pattern.score)}</dd>
          </div>
        </dl>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
        <button
          type="button"
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 transition active:scale-[0.99]"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={detailsId}
        >
          {expanded ? "検出理由を閉じる" : "検出理由をすべて見る"}
        </button>
        {hasCatalogDetail ? (
          <Link
            href={`/learning/patterns/${encodeURIComponent(pattern.id)}?code=${encodeURIComponent(code)}`}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-center text-sm font-black text-white transition active:scale-[0.99]"
          >
            図鑑で詳しく見る
          </Link>
        ) : (
          <Link
            href="/learning/patterns"
            className="flex min-h-11 w-full items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm font-black text-blue-700 transition active:scale-[0.99]"
          >
            図鑑トップを見る
          </Link>
        )}
      </div>
    </article>
  );
}
