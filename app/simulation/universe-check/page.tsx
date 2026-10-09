"use client";

import { useCallback, useEffect, useState } from "react";
import BottomNav from "@/app/components/BottomNav";

type Outcome = { days: number; checked: number; up: number; rebounded: number; averageReturnPercent: number | null };
type Group = { status: string; label: string; count: number; distinctDates: number; outcomes: Outcome[] };
type Item = { code: string; name: string; date: string; status: string; label: string;
  price: number; power: number; outcomes: { days: number; returnPercent: number | null }[] };
type Report = { total: number; latestDate: string | null; distinctDates: number;
  groups: Group[]; latest: Item[]; note: string };
const colors: Record<string, string> = {
  CANDIDATE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  WAIT: "border-blue-200 bg-blue-50 text-blue-800",
  WATCH: "border-amber-200 bg-amber-50 text-amber-800",
  AVOID: "border-rose-200 bg-rose-50 text-rose-800",
};
const signed = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

export default function UniverseCheckPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (filter: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/swing-universe-audit${filter ? `?code=${encodeURIComponent(filter)}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "取得に失敗しました");
      setReport(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "取得に失敗しました");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(code); }, [code, load]);
  const search = () => {
    const trimmed = input.trim();
    if (trimmed && !/^[0-9]{4}$/.test(trimmed)) {
      setError("銘柄コードは4桁で入力してください"); return;
    }
    setCode(trimmed);
    if (trimmed === code) void load(code);
  };
  return <main className="min-h-screen bg-slate-50 pb-24 text-slate-900">
    <div className="mx-auto min-h-screen max-w-md bg-white px-4 py-5 shadow-sm">
      <a href="/simulation" className="text-sm font-bold text-blue-600">← 疑似投資に戻る</a>
      <h1 className="mt-5 text-2xl font-black">📊 全銘柄スイング検証</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        疑似購入しなくてもOK！毎日のAI POWERからスイング候補・押し目待ち・様子見・見送りを記録し、1・3・5・10取引日後の株価で答え合わせ。
      </p>
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        これは日次データの<b>AI POWERのみを使う簡易判定</b>です。「見送り後の反発」は疑似購入の「撤退候補後の反発」とは別の指標です。RSIなどを使う個別銘柄ページと判定が異なる場合があります。成績によって自動的に買い・売り条件を変えることはありません。
      </div>
      {loading && <p className="mt-9 text-center text-sm text-slate-500">検証結果を読み込み中…</p>}
      {error && <p className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {report && !loading && <>
        <section className="mt-5 rounded-2xl border bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-600">自動記録した判定</p>
          <p className="mt-1 text-3xl font-black">{report.total.toLocaleString("ja-JP")}件</p>
          <p className="mt-1 text-xs text-slate-500">記録日数 {report.distinctDates}日 ・ 最新 {report.latestDate ?? "記録待ち"}</p>
        </section>
        <h2 className="mt-6 text-lg font-black">判定別の答え合わせ</h2>
        {report.groups.length === 0
          ? <p className="mt-3 rounded-2xl border border-dashed p-6 text-sm text-slate-500">初回の自動記録待ちです。営業日の16:20以降に集計します。</p>
          : <div className="mt-3 space-y-3">{report.groups.map((group) =>
              <section key={group.status} className={`rounded-2xl border p-4 ${colors[group.status] ?? "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black">{group.label}</p>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black">{group.count.toLocaleString("ja-JP")}件</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {group.outcomes.map((outcome) => <div key={outcome.days} className="rounded-xl bg-white/90 p-3 text-slate-800">
                    <p className="text-xs font-bold">{outcome.days}取引日後</p>
                    <p className="mt-1 text-lg font-black">{outcome.averageReturnPercent == null ? "集計待ち" : signed(outcome.averageReturnPercent)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">平均株価変化率</p>
                    <p className="text-[11px] text-slate-500">上昇 {outcome.up} / 比較済 {outcome.checked}件</p>
                    <p className="mt-1 text-[11px] font-bold text-blue-700">+3%以上反発 {outcome.rebounded}件（{outcome.checked ? (outcome.rebounded / outcome.checked * 100).toFixed(1) + "%" : "集計待ち"}）</p>
                  </div>)}
                </div>
              </section>)}</div>}
        <h2 className="mt-7 text-lg font-black">銘柄ごとに調べる</h2>
        <div className="mt-3 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} inputMode="numeric"
            maxLength={4} placeholder="4桁の銘柄コード" className="min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm"/>
          <button onClick={search} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">検索</button>
          {code && <button onClick={() => {setInput("");setCode("");}} className="rounded-xl border px-3 py-3 text-xs">解除</button>}
        </div>
        <p className="mt-3 text-xs text-slate-500">{code ? `${code} の履歴` : "最近の記録（先頭40件）"}</p>
        <div className="mt-2 space-y-2">{report.latest.map(item =>
          <article key={`${item.date}-${item.code}`} className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <a href={`/analysis/${item.code}`} className="min-w-0 text-sm font-black text-blue-700 underline">{item.code} {item.name}</a>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${colors[item.status] ?? ""}`}>{item.label}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{item.date} ・ 基準 {item.price.toLocaleString("ja-JP")}円 ・ AI POWER {item.power}</p>
            <div className="mt-2 grid grid-cols-4 gap-1">{item.outcomes.map(o =>
              <div key={o.days} className="rounded-lg bg-slate-50 px-1 py-2 text-center">
                <p className="text-[10px] text-slate-500">{o.days}日後</p>
                <p className={`mt-1 text-xs font-bold ${o.returnPercent == null ? "text-slate-400" : o.returnPercent > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {o.returnPercent == null ? "待ち" : signed(o.returnPercent)}
                </p>
              </div>)}</div>
          </article>)}</div>
        {code && report.latest.length === 0 && <p className="mt-3 text-sm text-slate-500">この銘柄の記録はまだありません。</p>}
        <p className="mt-6 text-[11px] leading-5 text-slate-500">{report.note} 「見送り」は株価下落の予測ではありません。株価取得が欠けた場合は集計せず確認待ちにします。</p>
      </>}
    </div>
    <BottomNav/>
  </main>;
}
