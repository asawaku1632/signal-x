"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Group = { label: string; records: number; matched: number; differing: number; large: number; meanAbsPercent: number; maxAbsPercent: number };
type Example = { code: string; name: string; date: string; baseline: number; reference: number; differenceYen: number; differencePercent: number; sector: string; observationDate: string };
type Report = {
  success: true; checkedAt: string; lookbackDays: number; truncated: boolean;
  summary: { records: number; tradeDays: number; distinctSecurities: number; matched: number; differing: number; overHalfPercent: number; meanAbsPercent: number | null; enoughDatesForTrend: boolean; enoughSaveHoursForComparison: boolean };
  byTradeDate: Group[]; bySector: Group[]; byPriceRange: Group[]; bySaveHour: Group[]; examples: Example[];
};
const yen = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 4 }) + "円";
const labels = { date: "取引日別", sector: "業種別", price: "株価帯別", hour: "保存時刻別" } as const;
type View = keyof typeof labels;
const views: View[] = ["date", "sector", "price", "hour"];

export default function PriceReferenceTrendPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [view, setView] = useState<View>("date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/price-reference-trend", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "集計できませんでした");
      setReport(data as Report);
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "集計できませんでした");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const groups = report ? (view === "date" ? report.byTradeDate :
    view === "sector" ? report.bySector : view === "price" ? report.byPriceRange : report.bySaveHour) : [];
  const summary = report?.summary;
  return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/admin/daily-price-reference" className="text-sm font-bold text-blue-600">← 参考終値の別保存へ</Link>
      <header className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-black tracking-wider text-blue-600">ADMIN RESEARCH / READ ONLY</p>
        <h1 className="mt-2 text-xl font-black">📊 株価差額の傾向調査</h1>
        <p className="mt-2 text-sm leading-6">判定時の保存価格と後日のYahoo日足参考値の違いを、過去90日間の記録から集計します。画面表示だけで株価は取得・更新しません。</p>
      </header>
      {loading && <p className="rounded-xl border p-4 text-sm">保存済みデータを集計中…</p>}
      {error && <p role="alert" className="rounded-xl border bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
      {report && summary && <div className="space-y-4">
        <section className="rounded-2xl border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "調査記録", value: String(summary.records) + "件" },
              { label: "一致", value: String(summary.matched) + "件" },
              { label: "差異あり", value: String(summary.differing) + "件" },
            ].map((item) => <div key={item.label} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{item.label}</p>
              <p className="mt-1 text-xl font-black">{item.value}</p>
            </div>)}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            調査対象：{summary.tradeDays}取引日・{summary.distinctSecurities}銘柄
            ／ 平均絶対差：{summary.meanAbsPercent == null ? "—" : summary.meanAbsPercent.toFixed(3) + "%"}
            ／ 0.5%以上：{summary.overHalfPercent}件
          </p>
        </section>
        {(!summary.enoughDatesForTrend || report.truncated) && <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          {report.truncated ? "取得上限5,000件に達しました。一部の記録だけの集計です。" : ""}
          {!summary.enoughDatesForTrend ? "まだ5取引日分の記録がないため、曜日別・銘柄別の傾向を断定できません。" : ""}
          手動で選んだ銘柄には選択バイアスがあります。差異があってもAI判定が誤りとは限りません。
        </p>}
        <section className="rounded-2xl border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-black">集計の切り替え</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {views.map((item) => <button key={item} type="button" onClick={() => setView(item)}
              aria-pressed={view === item}
              className={view === item ? "rounded-xl bg-blue-600 p-3 text-sm font-bold text-white" : "rounded-xl border p-3 text-sm font-bold"}>
              {labels[item]}
            </button>)}
          </div>
          {view === "sector" && <p className="mt-2 text-xs text-slate-500">業種はSIGNALXの簡易分類。未登録銘柄は「その他・未分類」です。</p>}
          {view === "hour" && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-900">
            これは保存処理の記録時刻（JST）で、AIが判断した瞬間の時刻ではありません。
            {summary.enoughSaveHoursForComparison ? "異なる保存時刻の記録が集まりましたが、因果関係を示すものではありません。" : "時刻比較には複数の取引日・時間帯の記録が必要です。"}
          </p>}
          <div className="mt-3 space-y-2">
            {groups.length ? groups.map((item) => <div key={item.label} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-bold">{item.label}</span>
                <span className="shrink-0 text-sm">{item.records}件</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                <span>一致 {item.matched}</span>
                <span>差異あり {item.differing}</span>
                <span>0.5%以上 {item.large}</span>
                <span>平均絶対差 {item.meanAbsPercent.toFixed(3)}%</span>
              </div>
            </div>) : <p className="text-sm text-slate-500">表示できる保存データがありません。</p>}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-black">差が大きい記録（最大12件）</h2>
          <p className="mt-1 text-xs text-slate-500">差額率（参考値を基準）の絶対値順。良い銘柄ランキングではありません。</p>
          <div className="mt-3 space-y-2">
            {report.examples.map((item) => <div key={item.date + ":" + item.code} className="rounded-xl border px-3 py-2">
              <div className="flex justify-between gap-2 text-sm">
                <span className="font-bold">{item.code} {item.name}</span>
                <span className="font-bold">{item.differencePercent > 0 ? "+" : ""}{item.differencePercent.toFixed(3)}%</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.date}・保存 {yen(item.baseline)} / 参考 {yen(item.reference)}・{item.sector}</p>
            </div>)}
          </div>
        </section>
        <p className="px-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          同じ銘柄・同じ取引日を別の日に再照合した場合、最新の参考値だけを1件として集計。
          Yahoo日足は取引所公式の確定終値を保証しません。
          売買・通知・学習係数は一切変更しません。
        </p>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 disabled:opacity-50">
          最新の保存データで再集計
        </button>
      </div>}
    </div>
  </main>;
}
