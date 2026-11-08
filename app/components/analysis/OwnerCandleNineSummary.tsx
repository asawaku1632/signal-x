"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ShadowNineOverview from "@/app/admin/shadow-candlestick-nine/ShadowNineOverview";
import type { ShadowNineSummary } from "@/app/lib/research/shadowCandleNineOverview";
import { getShadowNineQuickVerdict } from "@/app/lib/research/shadowCandleQuickVerdict";

type Report = {
  success: true;
  code: string;
  latestDate: string;
  candleCount: number;
  archiveAvailable: boolean;
  summary: ShadowNineSummary;
};

/**
 * Only rendered by the server owner-gated /analysis/[code]/layout.tsx.
 * The closed header now displays a real research verdict: once the owner
 * visits this code, fetch ONE code automatically, not on expand/collapse.
 * Server API separately rechecks the owner's session and validates a single code.
 * Ordinary users never mount this component.
 */
export default function OwnerCandleNineSummary({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [report, setReport] = useState<Report | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current || report) return;
    inFlight.current = true;
    setState("loading");
    try {
      const response = await fetch("/api/admin/shadow-candle-nine-overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("研究データの取得に失敗");
      }
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("success" in data) ||
          (data as { success: unknown }).success !== true) {
        throw new Error("研究データが不正");
      }
      const result = data as Report;
      if (result.code !== code || !result.summary ||
          typeof result.candleCount !== "number" || !Number.isFinite(result.candleCount)) {
        throw new Error("銘柄データが一致しません");
      }
      setReport(result);
      setState("ready");
    } catch {
      setState("error");
    } finally {
      inFlight.current = false;
    }
  }, [code, report]);

  // The user asked to see the verdict BEFORE opening the accordion.
  // One owner-only request on mount, shared by the header and expanded body.
  useEffect(() => {
    void load();
  }, [load]);

  const quick = getShadowNineQuickVerdict(report?.summary ?? null, state === "error");
  const quickColors = {
    neutral: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    red: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
    green: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  } as const;

  return (
    <details className="mb-2 rounded-xl border border-sky-200 bg-white px-3 py-2 shadow-sm dark:border-sky-800 dark:bg-slate-900">
      <summary className="min-h-12 cursor-pointer py-1 text-sm font-black text-slate-950 dark:text-slate-100">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>📋 ローソク足9種類・総合結果</span>
          <span role="status" aria-live="polite"
            className={`rounded-lg px-3 py-1.5 text-sm font-black ${quickColors[quick.tone]}`}>
            {quick.icon} {quick.label}
          </span>
        </span>
        <span className="mt-1 block text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
          {quick.explanation}
          {report ? `（確定日足：${report.latestDate}）` : ""}
        </span>
        <span className="mt-1 block text-[11px] font-bold text-sky-700 dark:text-sky-300">
          🔒 本人限定・研究用　｜　詳しい理由を見る ▼
        </span>
      </summary>
      <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
        <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
          {code}の完成済み日足だけを使う研究表示。本人がこの銘柄のページを開くと
          1銘柄分の参考日足を自動照合し、折りたたみ前に研究判定を表示します。
          折りたたみの開閉では再取得しません。
        </p>
        {state === "loading" && (
          <p role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-bold dark:bg-slate-800">
            確定日足と研究結果を確認しています…
          </p>
        )}
        {state === "error" && (
          <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-slate-800">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              研究データを取得できませんでした。通常の個別銘柄分析には影響ありません。
            </p>
            <button type="button" onClick={() => void load()}
              className="mt-2 min-h-11 rounded-lg bg-sky-700 px-4 text-sm font-bold text-white">
              再試行（1銘柄のみ）
            </button>
          </div>
        )}
        {state === "ready" && report && (
          <>
            <ShadowNineOverview
              summary={report.summary}
              code={report.code}
              latestDate={report.latestDate}
              candleCount={report.candleCount}
            />
            {!report.archiveAvailable && (
              <p className="mt-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                保存済み研究統計が取得できません。下落警戒の強さは判定できない状態です。
              </p>
            )}
          </>
        )}
        <Link href={`/admin/shadow-candlestick-nine?code=${encodeURIComponent(code)}`}
          prefetch={false}
          className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-bold text-sky-800 dark:border-sky-700 dark:bg-slate-800 dark:text-sky-300">
          9種類の詳しい検出日・1/3/5日後成績を見る
        </Link>
        <p className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
          🔒 SHADOW ONLY。注文・AI POWER・ランキング・通知には接続していません。
          研究結果は買い推奨や購入禁止を意味しません。
        </p>
      </div>
    </details>
  );
}
