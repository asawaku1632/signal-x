"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/app/components/BottomNav";

type Outcome = { days: number; date: string | null; price: number | null; changePercent: number | null };
type Item = { id: string; code: string; name: string; signalDate: string; signalPrice: number; reasons: string[]; outcomes: Outcome[] };
type Summary = { days: number; evaluated: number; declined: number; declineRatePercent: number | null };
type Report = { success: boolean; items: Item[]; summary: Summary[]; count: number; note: string };

const changeLabel = (change: number) =>
  change < 0 ? "下落" : change > 0 ? "上昇" : "変わらず";

export default function SwingExitCheckPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/swing-exit-audit", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? "ログインが必要です" : "結果を取得できませんでした");
        return response.json();
      })
      .then((data: Report) => { if (active) setReport(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "読み込みに失敗しました"); });
    return () => { active = false; };
  }, []);

  return <main className="min-h-screen bg-slate-50 pb-24 text-slate-900">
    <div className="mx-auto min-h-screen max-w-md bg-white px-4 py-5 shadow-sm">
      <a className="text-sm font-bold text-blue-600" href="/simulation">← 疑似投資に戻る</a>
      <h1 className="mt-5 text-2xl font-black">🔍 撤退候補の答え合わせ</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        SIGNALXが「撤退候補」と判定した時点の価格を記録し、その後1・3・5・10取引日目の保存価格と比較します。
      </p>
      {!report && !error && <p className="py-12 text-center text-sm text-slate-500">検証データを読み込み中…</p>}
      {error && <div className="mt-6 rounded-2xl bg-rose-50 p-5 text-sm text-rose-700">{error}</div>}
      {report && <>
        <section className="mt-6 rounded-2xl border bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-500">直近の記録（最大100件）</p>
          <p className="mt-1 text-2xl font-black">{report.count}件</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">下落率は各期間に価格が判明した記録だけで計算します。未確認のものを的中・不的中に含めません。</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {report.summary.map((s) => <div key={s.days} className="rounded-xl bg-white p-3">
              <p className="text-xs font-bold text-slate-500">{s.days}取引日後</p>
              <p className="mt-1 text-xl font-black">{s.declineRatePercent === null ? "集計待ち" : `${s.declineRatePercent.toFixed(1)}%`}</p>
              <p className="mt-1 text-[11px] text-slate-500">下落 {s.declined} / 検証済み {s.evaluated}件</p>
            </div>)}
          </div>
        </section>
        {report.items.length === 0 && <div className="mt-6 rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
          まだ撤退候補の記録はありません。疑似保有中の銘柄が撤退候補と判定されると記録が始まります。
        </div>}
        <div className="mt-5 space-y-4">{report.items.map((item) => <article key={item.id} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-xs text-slate-400">{item.code} / {item.signalDate}</p><h2 className="mt-1 text-lg font-black">{item.name}</h2></div>
            <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">撤退候補</span>
          </div>
          <p className="mt-2 text-xs text-slate-600">判定時の株価 <strong>{item.signalPrice.toLocaleString("ja-JP")}円</strong></p>
          <div className="mt-3 grid grid-cols-2 gap-2">{item.outcomes.map((o) => <div key={o.days} className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-500">{o.days}取引日後</p>
            {o.changePercent === null
              ? <p className="mt-1 text-sm text-slate-400">確認待ち</p>
              : <><p className={`mt-1 text-lg font-black ${o.changePercent < 0 ? "text-emerald-700" : o.changePercent > 0 ? "text-rose-700" : "text-slate-600"}`}>
                {o.changePercent > 0 ? "+" : ""}{o.changePercent.toFixed(2)}%
              </p><p className="text-[11px] text-slate-500">{changeLabel(o.changePercent)} / {o.price?.toLocaleString("ja-JP")}円</p>
              <p className="text-[10px] text-slate-400">{o.date}</p></>}
          </div>)}</div>
          {item.reasons.length > 0 && <p className="mt-3 text-[11px] leading-5 text-slate-500">判定理由：{item.reasons.join(" / ")}</p>}
        </article>)}</div>
        <p className="mt-6 text-[11px] leading-5 text-slate-500">{report.note} 手数料・税金・実際の約定価格は反映していません。</p>
      </>}
    </div>
    <BottomNav />
  </main>;
}
