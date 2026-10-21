"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Outcome = { horizon: number; targetDate: string | null; status: string; returnPct: number | null };
type Item = {
  code: string; name: string; triggeredAt: string; signalDate: string;
  referencePrice: number; aiPower: number; status: string; calendarAnchor?: string;
  availablePriceSessions?: number; notYetDueSessions?: number; outcomes: Outcome[];
};
type Report = { success: boolean; total: number; excluded: number; sampled?: number; exclusionReasons?: Record<string, number>; items: Item[]; caveat: string; error?: string };
const stateText = (status: string) => ({
  VERIFIED: "検証済み", UNVERIFIED: "価格未検証", NOT_YET_DUE: "未到来", MISSING: "データ欠損", PENDING_OR_MISSING: "未到来・欠損",
  CALENDAR_UNAVAILABLE: "営業日未確定",
}[status] ?? "未確認");

export default function ResearchClient() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/buy-failure-forward-preview", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) throw new Error("管理者のみ閲覧できます。");
      const data = await response.json() as Report;
      if (!response.ok || !data.success) throw new Error(data.error || "研究データを取得できませんでした。");
      setReport(data);
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "研究データを取得できませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-600">← 学習データ・管理室へ</Link>
      <header className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-black tracking-wider text-blue-600">OWNER PRIVATE / READ ONLY</p>
        <h1 className="mt-2 text-xl font-black">📉 買いシグナル後の下落・回復研究</h1>
        <p className="mt-2 text-sm leading-6">過去の買い監視開始記録から、1・3・5・10・20営業日後のデータ保存状況を確認します。実際の購入履歴やLINE通知の到達記録ではありません。</p>
      </header>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
        ⚠️ 研究段階：保存株価は独立検証・株式分割調整が未確認です。回復率・勝率・推奨売買は表示しません。
      </p>
      {loading && <p className="rounded-xl border p-4 text-sm">研究データを読み込み中…</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
      {report && <div className="space-y-3">
        <section className="grid grid-cols-3 gap-2">
          {[
            { label: "記録総数", value: report.total },
            { label: "表示件数", value: report.items.length },
            { label: "除外件数", value: report.excluded },
          ].map((stat) => <div key={stat.label} className="rounded-xl border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="mt-1 text-xl font-black">{stat.value ?? "—"}</p>
          </div>)}
        </section>
        <section className="rounded-xl border bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="font-bold">データ品質（今回の抽出範囲）</p>
          <p className="mt-1">抽出：{report.sampled ?? "—"}件 ／ 有効：{report.items.length}件 ／ 除外：{report.excluded}件</p>
          <p className="mt-1">有効記録率：{report.sampled ? (100 * report.items.length / report.sampled).toFixed(1) + "%" : "—"}</p>
          <p className="mt-1 text-xs text-slate-500">全履歴の有効率ではありません。価格の独立検証・株式分割調整は未完了です。</p>
        </section>
        {!report.items.length && <p className="rounded-xl border p-4 text-sm">表示できる買い監視記録はありません。</p>}
        {report.items.map((item, index) => <section key={item.code + ":" + item.triggeredAt + ":" + index} className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-black">{item.code} {item.name}</h2>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">{item.status === "CALENDAR_UNAVAILABLE" ? "営業日未確定" : "未検証"}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">監視開始：{item.triggeredAt} / AI POWER：{item.aiPower ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-500">参考基準価格：{item.referencePrice?.toLocaleString("ja-JP") ?? "—"}円（約定価格ではありません）</p>
          {item.calendarAnchor && item.calendarAnchor !== item.signalDate && <p className="mt-2 text-xs text-amber-700">休場日記録：追跡の営業日基準は {item.calendarAnchor}（約定日ではありません）</p>}
          {item.status === "CALENDAR_UNAVAILABLE" ? <p className="mt-2 text-xs text-amber-700">対象日が営業日カレンダーの対応範囲外、または営業日を確定できません。価格欠損や予測失敗として集計しません。</p> : <p className="mt-2 text-xs">価格記録：{item.availablePriceSessions ?? 0}営業日分 ／ 未到来：{item.notYetDueSessions ?? "—"}営業日</p>}
          <div className="mt-3 grid grid-cols-5 gap-1">
            {[1, 3, 5, 10, 20].map((day) => {
              const outcome = item.outcomes?.find((value) => value.horizon === day);
              return <div key={day} className="rounded-lg bg-slate-100 p-2 text-center dark:bg-slate-800">
                <p className="text-xs font-black">{day}日後</p>
                <p className="mt-1 text-[10px] leading-4">{outcome ? stateText(outcome.status) : "未確認"}</p>
              </div>;
            })}
          </div>
        </section>)}
        <button type="button" onClick={() => void load()} disabled={loading} className="w-full rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-700 disabled:opacity-50">保存済みデータを再読み込み</button>
        <p className="text-xs leading-5 text-slate-500">{report.caveat}　このページから株価取得・保存・通知・売買は行いません。</p>
      </div>}
    </div>
  </main>;
}
