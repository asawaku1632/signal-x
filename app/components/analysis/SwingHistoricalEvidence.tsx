"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  summarizeSwingHistoricalEvidence,
  type SwingHistoricalGroup,
} from "@/app/lib/learning/swingEvidenceAdvisory";

type SavedSwingEntry = {
  date: string;
  code: string;
  label: string;
  power: number;
  price: number;
};

type Report = {
  success: boolean;
  groups?: SwingHistoricalGroup[];
  latest?: SavedSwingEntry[];
  latestDate?: string | null;
};

type FetchState = "loading" | "ready" | "unavailable";

function signedPercent(value: number | null) {
  if (value === null) return "集計待ち";
  return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
}

/**
 * Read-only context, NOT a veto or an adjustment to the live swing decision.
 * The cohort intentionally differs: daily AI POWER alone, not intraday RSI.
 */
export default function SwingHistoricalEvidence({ code }: { code: string }) {
  const [expanded, setExpanded] = useState(false);
  const [request, setRequest] = useState<{
    code: string;
    report: Report | null;
    state: FetchState;
  }>({ code, report: null, state: "loading" });

  useEffect(() => {
    if (!expanded) return;
    let active = true;

    void fetch("/api/swing-universe-audit?code=" + encodeURIComponent(code), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Evidence unavailable");
        const data = (await response.json()) as Report;
        if (!data?.success || !Array.isArray(data.groups)) throw new Error("Invalid evidence");
        if (active) setRequest({ code, report: data, state: "ready" });
      })
      .catch(() => {
        if (active) setRequest({ code, report: null, state: "unavailable" });
      });
    return () => { active = false; };
  }, [code, expanded]);

  const report = request.code === code ? request.report : null;
  const fetchState = request.code === code ? request.state : "loading";
  const group = report?.groups?.find((item) => item.status === "CANDIDATE");
  const evidence = summarizeSwingHistoricalEvidence(group);
  const recentForStock = (report?.latest ?? []).filter((row) => row.code === code).slice(0, 3);
  const statusText = fetchState === "loading" ? "照合中" :
    fetchState === "unavailable" ? "確認できません" :
    evidence.status === "CAUTION" ? "実績注意" :
    evidence.status === "REFERENCE" ? "実績は参考値" : "検証データ不足";
  const caution = fetchState === "ready" && evidence.status === "CAUTION";

  return (
    <section data-testid="swing-historical-evidence"
      className={"mt-2 rounded-xl border p-3 shadow-sm dark:bg-slate-900 " +
        (caution ? "border-amber-300 bg-amber-50 dark:border-amber-700" :
          "border-slate-200 bg-white dark:border-slate-700")}>
      <button type="button" aria-expanded={expanded}
        onClick={() => {
          if (!expanded) setRequest({ code, report: null, state: "loading" });
          setExpanded(!expanded);
        }}
        className="flex w-full items-center justify-between gap-2 text-left">
        <span className="text-sm font-black text-slate-900 dark:text-slate-100">🧪 スイング実績照合</span>
        <span className="shrink-0 text-xs font-bold text-blue-700 dark:text-blue-300">{expanded ? "▲ 閉じる" : "▼ 開く"}</span>
      </button>
      {expanded && (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">過去の全銘柄スイング候補</p>
            <span data-testid="swing-evidence-status" aria-live="polite"
              className={"rounded-full px-2.5 py-1 text-xs font-black " +
                (caution ? "bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-100" :
                  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200")}>
              {statusText}
            </span>
          </div>
          {fetchState !== "ready" ? (
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
          {fetchState === "loading" ?
            "過去の3・5取引日後の成績を確認しています。" :
            "検証データを取得できません。スイング候補は実績による裏付けが確認できていない暫定評価です。"}
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-700 dark:text-slate-200">
            {caution ?
              "⚠ 過去の簡易スイング候補は3・5日後のいずれかの平均がマイナス。候補表示だけで買いを判断しないでください。" :
              evidence.status === "REFERENCE" ?
              "参考集計はありますが、将来の値上がりや利益を保証するものではありません。" :
              "記録が短く、3・5日後の成績による裏付けはまだ不十分です。"}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {evidence.horizons.map((row) => (
              <div key={row.days} className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300">{row.days}取引日後の平均</p>
                <p className={"mt-0.5 text-lg font-black " +
                  (row.averageReturnPercent === null ? "text-slate-500" :
                    row.averageReturnPercent < 0 ? "text-rose-700 dark:text-rose-300" :
                      "text-emerald-700 dark:text-emerald-300")}>
                  {signedPercent(row.averageReturnPercent)}
                </p>
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300">比較済 {row.checked}件</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-300">
            簡易候補の記録 {evidence.count}件・{evidence.distinctDates}日
            {report?.latestDate ? "／最新 " + report.latestDate : ""}
            {evidence.distinctDates < 20 ? "（十分な期間の検証前）" : ""}
          </p>
        </>
      )}
      {fetchState === "ready" && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-black text-slate-900 dark:text-slate-100">{code} の保存済み簡易判定（直近3件）</p>
          {recentForStock.length ? recentForStock.map((row) => (
            <p key={row.date} className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">
              {row.date}：AI POWER {row.power} ／ {row.label} ／ 参考株価 {row.price.toLocaleString("ja-JP")}円
            </p>
          )) : <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">この銘柄の保存済み簡易判定はまだありません。</p>}
          <p className="mt-2 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
            個別解析のスイング判定と判定条件が異なります。休日に見た表示を、この日次履歴だけで再現することはできません。
          </p>
        </div>
      )}
      <p className="mt-2 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
        ※全銘柄のAI POWERのみを用いた過去の簡易判定です。個別解析のRSI・当日変化率などを含む判定とは条件が異なり、この銘柄自体の勝率や約定可能な利益を示すものではありません。
      </p>
      <Link href="/simulation/universe-check"
        className="mt-2 inline-block text-xs font-black text-blue-700 underline dark:text-blue-300">
        全銘柄スイング検証を見る →
      </Link>
        </>
      )}
    </section>
  );
}
