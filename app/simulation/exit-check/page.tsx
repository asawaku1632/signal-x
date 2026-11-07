"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/app/components/BottomNav";

type Outcome = { days: number; date: string | null; price: number | null; changePercent: number | null };
type Item = { id: string; code: string; name: string; signalDate: string; scanAt: string; signalPrice: number; reasons: string[]; outcomes: Outcome[] };
type Summary = { days: number; evaluated: number; declined: number; rebounded: number; furtherDeclined: number; declineRatePercent: number | null; reboundRatePercent: number | null };
type Report = { success: boolean; items: Item[]; summary: Summary[]; count: number; note: string };

const changeLabel = (change: number) =>
  change < 0 ? "下落" : change > 0 ? "上昇" : "変わらず";


const reasonGroups = [
  { label: "AI低下のみ", matches: (item: Item) =>
    item.reasons.length === 1 && /^AI POWERが .*まで低下$/.test(item.reasons[0]) },
  { label: "複数理由", matches: (item: Item) => new Set(item.reasons).size > 1 },
];

function yen(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.round(value);
  return (rounded > 0 ? "+" : "") + rounded.toLocaleString("ja-JP") + "円";
}

function ExitReasonComparison({ items }: { items: Item[] }) {
  return (
    <section className="mt-4 rounded-2xl border bg-white p-3">
      <h2 className="text-sm font-black">撤退理由別の比較</h2>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        判定価格からの差を100株で換算。各期限で最も下落した記録の銘柄を外した平均も表示します。
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
          <caption className="sr-only">撤退理由別の保存株価の比較</caption>
          <thead><tr className="border-b">
            <th scope="col" className="pr-2 text-left">理由・日後</th>
            <th scope="col" className="px-1">完了／対象</th>
            <th scope="col" className="px-1">中央値</th>
            <th scope="col" className="pl-1">最悪銘柄除外平均</th>
          </tr></thead>
          <tbody>{reasonGroups.flatMap(({ label, matches }) => {
            const group = items.filter(matches);
            return [1, 3, 5, 10].map(days => {
              const outcomes = group.flatMap(item => {
                const price = item.outcomes.find(outcome => outcome.days === days)?.price;
                if (price == null || !Number.isFinite(price) || price <= 0 ||
                    !Number.isFinite(item.signalPrice) || item.signalPrice <= 0) return [];
                return [{ code: item.code, difference: (price - item.signalPrice) * 100 }];
              }).sort((left, right) => left.difference - right.difference || left.code.localeCompare(right.code));
              const count = outcomes.length;
              const median = count
                ? (outcomes[Math.floor((count - 1) / 2)].difference + outcomes[Math.floor(count / 2)].difference) / 2
                : null;
              const worst = outcomes[0];
              const remaining = worst && worst.difference < 0
                ? outcomes.filter(outcome => outcome.code !== worst.code)
                : outcomes;
              const mean = remaining.length
                ? remaining.reduce((sum, outcome) => sum + outcome.difference, 0) / remaining.length
                : null;
              return <tr key={label + days} className="border-b border-slate-100">
                <th scope="row" className="py-2 pr-2 text-left">{label}・{days}日</th>
                <td className="px-1">{count}／{group.length}</td>
                <td className="px-1">{yen(median)}</td>
                <td className="pl-1">{yen(mean)}</td>
              </tr>;
            });
          })}</tbody>
        </table>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        下落がない期限は全件の平均。単一の価格理由などは上の全体集計で確認できます。
      </p>
    </section>
  );
}

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
      <h1 className="mt-5 text-2xl font-black">🔍 撤退後の反発・続落を検証</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        SIGNALXが「撤退候補」と判定した時点の価格を記録し、その後1・3・5・10取引日目の保存価格と比較します。
      </p>
      {!report && !error && <p className="py-12 text-center text-sm text-slate-500">検証データを読み込み中…</p>}
      {error && <div className="mt-6 rounded-2xl bg-rose-50 p-5 text-sm text-rose-700">{error}</div>}
      {report && <>
        <section className="mt-6 rounded-2xl border bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-500">直近の記録（最大100件）</p>
          <p className="mt-1 text-2xl font-black">{report.count}件</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">反発（+3%以上）と続落（−3%以下）を各時点の保存株価で検証。確認待ちは集計に含めません。</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {report.summary.map((s) => <div key={s.days} className="rounded-xl bg-white p-3">
              <p className="text-xs font-bold text-slate-500">{s.days}取引日後</p>
              <p className="mt-1 text-xl font-black">{s.declineRatePercent === null ? "集計待ち" : `${s.declineRatePercent.toFixed(1)}%`}</p>
              <p className="mt-1 text-[11px] text-slate-500">下落 {s.declined} / 検証済み {s.evaluated}件</p>
              <p className="mt-2 text-[11px] font-bold text-blue-700">+3%以上反発 {s.rebounded}件（{s.reboundRatePercent === null ? "待ち" : s.reboundRatePercent.toFixed(1) + "%"}）</p>
              <p className="text-[11px] text-rose-700">−3%以上続落 {s.furtherDeclined}件</p>
            </div>)}
          </div>
        </section>
        {report.items.length > 0 && <ExitReasonComparison items={report.items} />}
        {report.items.length === 0 && <div className="mt-6 rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
          まだ撤退候補の記録はありません。疑似保有中の銘柄が撤退候補と判定されると記録が始まります。
        </div>}
        <div className="mt-5 space-y-4">{report.items.map((item) => <article key={item.id} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-xs text-slate-400">{item.code} / {item.signalDate}</p><h2 className="mt-1 text-lg font-black">{item.name}</h2></div>
            <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">撤退候補</span>
          </div>
          <p className="mt-2 text-xs text-slate-600">基準株価 <strong>{item.signalPrice.toLocaleString("ja-JP")}円</strong>（スキャン {new Date(item.scanAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}）</p>
          {item.outcomes.some((o) => o.changePercent !== null && o.changePercent >= 3) &&
            <p className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">↗ 撤退判定後に+3%以上の反発を確認</p>}
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
