"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";

type Outcome = {
  days: 3 | 5 | 10;
  date: string | null;
  price: number | null;
  changePercent: number | null;
};
type Case = {
  id: string;
  code: string;
  name: string;
  exitDate: string;
  exitPrice: number;
  exitAiPower: number | null;
  precursorDate: string;
  precursorProfile: string | null;
  reasons: string[];
  outcomes: Outcome[];
};
type Summary = {
  days: number;
  evaluated: number;
  pending: number;
  reboundCount: number;
  continuedDeclineCount: number;
  upCount: number;
  reboundRatePercent: number | null;
  continuedDeclineRatePercent: number | null;
  averageChangePercent: number | null;
};
type Group = { total: number; summary: Summary[] };
type Report = {
  items: Case[];
  cohorts: { overlap: Group; exitOnly: Group };
  scannedExitAudits: number;
  maxRecentExits: number;
  lookbackSessions: number;
  note: string;
};

const pct = (value: number | null) =>
  value == null ? "検証待ち" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
const yen = (value: number) => `${value.toLocaleString("ja-JP")}円`;
const profile = (value: string | null) =>
  value === "EXPLOSIVE_REBOUND" ? "爆発反発型" :
    value === "STABLE_REBOUND" ? "安定反発型" : "爆益前兆";
const sampleRate = (value: number | null, count: number) =>
  count === 0 || value == null ? "—" : `${value.toFixed(1)}%`;

export default function SwingConflictCheckPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    fetch("/api/swing-conflict-audit", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ?
          "ログインが必要です" : "検証データを取得できませんでした");
        return response.json();
      })
      .then((data: Report) => { if (mounted) setReport(data); })
      .catch((reason) => {
        if (mounted) setError(reason instanceof Error ? reason.message : "読み込みに失敗しました");
      });
    return () => { mounted = false; };
  }, []);

  return <main className="min-h-screen bg-slate-50 pb-24 text-slate-900">
    <div className="mx-auto max-w-lg bg-white px-4 py-5">
      <Link href="/simulation" className="text-sm font-bold text-blue-600">← 疑似投資に戻る</Link>
      <h1 className="mt-4 text-xl font-black">🟣 爆益前兆 × 🔴 撤退候補</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        爆益前兆が出てから5取引日以内に、疑似保有中の同じ銘柄が「撤退候補」になったケースを自動で答え合わせします。
        撤退時点を基準に、3・5・10取引日後を比較します。
      </p>
      {!report && !error && <p className="mt-8 text-sm text-slate-500">検証データを読み込み中…</p>}
      {error && <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {report && <>
        <section className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-black text-violet-800">前兆あり ＋ 撤退候補</p>
          <p className="mt-1 text-3xl font-black text-violet-950">{report.cohorts.overlap.total}件</p>
          <p className="mt-1 text-xs text-violet-700">
            比較対象：前兆なしの撤退候補 {report.cohorts.exitOnly.total}件
            （直近{report.maxRecentExits}件までの撤退記録）
          </p>
          <p className="mt-2 text-xs text-violet-700">
            件数が少ない間は参考値です。過去の割合は将来の反発確率ではありません。
          </p>
        </section>

        <section className="mt-5 space-y-3">
          <h2 className="text-base font-black">3・5・10取引日後の比較</h2>
          {[3, 5, 10].map((days, index) => {
            const overlap = report.cohorts.overlap.summary[index];
            const baseline = report.cohorts.exitOnly.summary[index];
            if (!overlap || !baseline) return null;
            return <div key={days} className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-black">{days}取引日後</h3>
                <span className="text-xs text-slate-500">実績が30件未満なら参考値</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  { title: "🟣 前兆あり＋撤退", group: overlap },
                  { title: "🔴 撤退のみ", group: baseline },
                ]).map((entry) => <div key={entry.title} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-black">{entry.title}</p>
                  <p className="mt-2 text-[11px] text-slate-500">+3%以上の反発</p>
                  <p className="text-xl font-black text-blue-700">
                    {sampleRate(entry.group.reboundRatePercent, entry.group.evaluated)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {entry.group.reboundCount}/{entry.group.evaluated}件（未判定 {entry.group.pending}件）
                  </p>
                  <p className="mt-3 text-[11px] text-slate-500">−3%以下の続落</p>
                  <p className="text-lg font-black text-rose-700">
                    {sampleRate(entry.group.continuedDeclineRatePercent, entry.group.evaluated)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">平均騰落 {pct(entry.group.averageChangePercent)}</p>
                </div>)}
              </div>
              {(overlap.evaluated < 30 || baseline.evaluated < 30) &&
                <p className="mt-2 text-xs text-amber-700">⏳ 比較データ収集中。今は優劣を判定しません。</p>}
            </div>;
          })}
        </section>

        <section className="mt-5">
          <h2 className="font-black">該当銘柄の記録</h2>
          {report.items.length === 0 &&
            <p className="mt-3 rounded-xl border border-dashed p-4 text-sm leading-6 text-slate-500">
              条件が一致する記録はまだありません。疑似保有の撤退判定がサーバーで保存され、
              その前の5取引日以内に爆益前兆が記録されていると、ここに表示されます。
            </p>}
          <div className="mt-3 space-y-3">
            {report.items.map((item) => <article key={item.id} className="rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">{item.code}</p>
                  <h3 className="font-black">{item.name}</h3>
                </div>
                <Link href={`/chart/${encodeURIComponent(item.code)}`}
                  className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                  📈 CHART →
                </Link>
              </div>
              <p className="mt-2 text-xs text-violet-700">
                🟣 爆益前兆 {item.precursorDate}（{profile(item.precursorProfile)}）
              </p>
              <p className="mt-1 text-xs text-rose-700">
                🔴 撤退候補 {item.exitDate} ／ 基準 {yen(item.exitPrice)}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {item.outcomes.map((outcome) => <div key={outcome.days}
                  className="rounded-xl bg-slate-50 p-2 text-center">
                  <p className="text-[11px] text-slate-500">{outcome.days}取引日後</p>
                  <p className={`mt-1 text-sm font-black ${outcome.changePercent == null
                    ? "text-slate-400" : outcome.changePercent >= 3
                      ? "text-blue-700" : outcome.changePercent <= -3
                        ? "text-rose-700" : "text-slate-700"}`}>
                    {pct(outcome.changePercent)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {outcome.date ?? "結果待ち"}
                  </p>
                </div>)}
              </div>
              <details className="mt-3 text-xs text-slate-600">
                <summary className="cursor-pointer font-bold">撤退判定理由を見る</summary>
                <p className="mt-2 leading-5">{item.reasons.join(" / ") || "記録なし"}</p>
              </details>
            </article>)}
          </div>
        </section>
        <p className="mt-6 text-xs leading-5 text-slate-500">{report.note}</p>
      </>}
    </div>
    <BottomNav />
  </main>;
}
