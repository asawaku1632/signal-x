"use client";

import { useCallback, useEffect, useState } from "react";
import BottomNav from "@/app/components/BottomNav";

type Outcome = { days: number; checked: number; up: number; rebounded: number; averageReturnPercent: number | null };
type Group = { status: string; label: string; count: number; distinctDates: number; outcomes: Outcome[] };
type AvoidOutcome = { days: number; checked: number; checkedDays: number;
  up: number; down: number; plus3: number; minus3: number;
  averageReturnPercent: number | null; medianReturnPercent: number | null;
  worstReturnPercent: number | null };
type AvoidBand = { band: string; label: string; count: number; distinctDates: number;
  outcomes: AvoidOutcome[] };
type SameDayPeer = { groupKey: string; label: string; matchedDates: number;
  peerMeanPct: number | null; excessPctPoints: number | null };
type SameDayDaily = { date: string; count: number; bandMeanPct: number;
  universeMeanPct: number; excessPctPoints: number;
  bandUpRate: number; universeUpRate: number };
type SameDayComparison = { band: string; label: string; days: number;
  matchedDates: number; stockDays: number; universeStockDays: number;
  bandMeanPct: number | null; universeMeanPct: number | null;
  excessPctPoints: number | null; bandUpRate: number | null;
  universeUpRate: number | null; beatUniverseDays: number; conclusive: boolean;
  peers: SameDayPeer[]; daily: SameDayDaily[] };
type Item = { code: string; name: string; date: string; status: string; label: string;
  price: number; power: number; outcomes: { days: number; returnPercent: number | null }[] };
type Report = { total: number; latestDate: string | null; distinctDates: number;
  groups: Group[]; avoidBreakdown: AvoidBand[];
  sameDayComparison: SameDayComparison[]; latest: Item[]; note: string };
const colors: Record<string, string> = {
  CANDIDATE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  WAIT: "border-blue-200 bg-blue-50 text-blue-800",
  WATCH: "border-amber-200 bg-amber-50 text-amber-800",
  AVOID: "border-rose-200 bg-rose-50 text-rose-800",
};
const signed = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const rate = (count: number, checked: number) =>
  checked ? (100 * count / checked).toFixed(1) + "%" : "集計待ち";
const observed = (value: number | null) => value == null ? "集計待ち" : signed(value);
const upPercentage = (value: number | null) =>
  value == null ? "集計待ち" : value.toFixed(1) + "%";


export default function UniverseCheckPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [relativeDays, setRelativeDays] = useState<1 | 3 | 5 | 10>(5);
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
        <section className="mt-6 rounded-2xl border border-rose-200 bg-white p-4">
          <h2 className="text-lg font-black text-slate-900">🔍 「見送り」のAI POWER別・反発検証</h2>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            上の「見送り」を4つのAI POWER帯に分割。過去に保存した同じ銘柄・同じ判定時点の株価を
            1・3・5・10取引日後と比較しています。下の各区分をタップすると詳しい結果が開きます。
          </p>
          <p className="mt-2 text-xs leading-5 text-amber-900">
            上昇割合は検証できた記録の割合で、将来の勝率予測ではありません。
            同じ銘柄が別の日に出た場合は別記録です。
            「最悪の下落」は指定取引日の保存価格との差で、保有途中の最大下落ではありません。
          </p>
          <div className="mt-3 space-y-3">
            {report.avoidBreakdown.map((band) => {
              const five = band.outcomes.find((outcome) => outcome.days === 5);
              return <details key={band.band} className="group rounded-xl border border-slate-200 bg-slate-50"
                open={band.band === "0-19"}>
                <summary className="cursor-pointer list-none rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-slate-900">AI POWER {band.label}</p>
                      <p className="mt-1 text-[11px] text-slate-600">
                        判定 {band.count.toLocaleString("ja-JP")}件 ／ 記録 {band.distinctDates}日
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-slate-900">
                        {five ? rate(five.up, five.checked) : "集計待ち"}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        5日後の上昇割合　<span aria-hidden="true">⌄</span>
                      </p>
                    </div>
                  </div>
                </summary>
                <div className="border-t border-slate-200 px-3 pb-3 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    {band.outcomes.map((o) => <article key={o.days}
                      className="rounded-lg border border-slate-100 bg-white p-2 text-slate-800">
                      <h3 className="text-xs font-black">{o.days}取引日後</h3>
                      <p className="mt-1 text-lg font-black">{rate(o.up, o.checked)}</p>
                      <p className="text-[10px] text-slate-500">上昇 {o.up} / 検証済み {o.checked}件</p>
                      <p className="mt-1 text-[10px] text-slate-500">判定日 {o.checkedDays}日分</p>
                      {o.checkedDays > 0 && o.checkedDays < 10 &&
                        <p className="mt-1 text-[10px] font-bold text-amber-800">日数が少なく検証途中</p>}
                      <div className="mt-2 space-y-1 border-t pt-2 text-[11px]">
                        <p>平均騰落率 <b>{observed(o.averageReturnPercent)}</b></p>
                        <p>中央値 <b>{observed(o.medianReturnPercent)}</b></p>
                        <p>+3%以上 <b>{rate(o.plus3, o.checked)}</b>
                          <span className="text-slate-500">（{o.plus3}件）</span></p>
                        <p>−3%以下 <b>{rate(o.minus3, o.checked)}</b>
                          <span className="text-slate-500">（{o.minus3}件）</span></p>
                        <p>最悪の下落 <b className="text-rose-700">{observed(o.worstReturnPercent)}</b></p>
                      </div>
                    </article>)}
                  </div>
                </div>
              </details>;
            })}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-600">
            ※AI POWER 0〜54は新しい「弱いAI判定からの逆張り反発研究」の対象帯ですが、
            こちらは従来の判定時点の保存株価に対する過去実績です。
            新研究の翌9:10仮想購入結果とは異なります。
            実際の「撤退候補」は購入価格や損切り条件も含み、見送りとは別の判定です。
          </p>
        </section>
        <section className="mt-6 rounded-2xl border border-indigo-200 bg-white p-4">
          <h2 className="text-lg font-black text-slate-900">⚖️ 同じ日の全銘柄平均・他判定との比較</h2>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            その日の同じ検証期間で「見送り」の各AI POWER帯を、SIGNALXが保存した
            全銘柄の均等加重平均と比べます。日経平均・TOPIXの騰落率ではありません。
            日ごとに平均を出してから各日を同じ重みで集計します。
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="比較する取引日数">
            {([1,3,5,10] as const).map(days=>
              <button key={days} type="button" onClick={()=>setRelativeDays(days)}
                aria-pressed={relativeDays===days}
                className={"rounded-xl border px-1 py-2 text-xs font-black "+(
                  relativeDays===days?"border-indigo-600 bg-indigo-600 text-white":
                    "border-slate-200 bg-slate-50 text-slate-700")}>
                {days}日後
              </button>)}
          </div>
          <div className="mt-3 space-y-3">
            {report.sameDayComparison.filter(c=>c.days===relativeDays).map(c=>
              <article key={c.band} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <b className="text-sm text-slate-900">{c.label}</b>
                  <span className="text-[11px] text-slate-600">
                    {c.matchedDates}判定日 / {c.stockDays}銘柄日
                  </span>
                </div>
                {c.matchedDates===0?
                  <p className="mt-2 text-sm text-slate-500">同日比較はまだ集計待ち</p>:
                  <>
                    {!c.conclusive&&<p className="mt-2 text-[11px] font-bold text-amber-800">
                      判定日が10日未満。まだ仮の観察結果です
                    </p>}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-[10px] text-slate-500">{c.label}の日別平均</p>
                        <p className="mt-1 text-base font-black">{observed(c.bandMeanPct)}</p>
                        <p className="text-[10px] text-slate-500">上昇割合 {upPercentage(c.bandUpRate)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-[10px] text-slate-500">同じ日の全銘柄平均</p>
                        <p className="mt-1 text-base font-black">{observed(c.universeMeanPct)}</p>
                        <p className="text-[10px] text-slate-500">上昇割合 {upPercentage(c.universeUpRate)}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-black">
                      全銘柄平均との差：{c.excessPctPoints===null?"集計待ち":
                        (c.excessPctPoints>0?"+":"")+c.excessPctPoints.toFixed(2)+"ポイント"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      全銘柄平均を上回った日 {c.beatUniverseDays} / {c.matchedDates}日
                    </p>
                    <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <summary className="cursor-pointer text-xs font-black">
                        他の3判定グループと比べる
                      </summary>
                      <div className="mt-2 space-y-2">
                        {c.peers.map(p=><div key={p.groupKey}
                          className="rounded-lg bg-white p-2 text-xs">
                          <div className="flex justify-between gap-2">
                            <b>{p.label}</b>
                            <span>{p.matchedDates}日</span>
                          </div>
                          <p className="mt-1">
                            相手グループの日別平均 {observed(p.peerMeanPct)}
                          </p>
                          <p className="mt-1">
                            こちらとの差 {p.excessPctPoints===null?"比較待ち":
                              (p.excessPctPoints>0?"+":"")+p.excessPctPoints.toFixed(2)+"ポイント"}
                          </p>
                        </div>)}
                      </div>
                    </details>
                    <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <summary className="cursor-pointer text-xs font-black">
                        判定日ごとの結果（{c.daily.length}日）
                      </summary>
                      <div className="mt-2 space-y-1">
                        {c.daily.map(d=><div key={d.date}
                          className="rounded-lg bg-white px-2 py-2 text-[11px]">
                          <b>{d.date}</b>
                          <p className="mt-1">
                            {c.label} {signed(d.bandMeanPct)} ／ 全銘柄 {signed(d.universeMeanPct)}
                          </p>
                          <p>
                            差 {(d.excessPctPoints>0?"+":"")+d.excessPctPoints.toFixed(2)}ポイント
                            ・比較銘柄 {d.count}件
                          </p>
                        </div>)}
                      </div>
                    </details>
                  </>}
              </article>)}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-600">
            比較に採用するのは、同一判定日の全銘柄が800件以上保存され、
            全体および対象グループの価格照合が各80%以上完了した日だけ。
            未照合は0%扱いにしません。全銘柄平均には対象帯の銘柄も含まれます。
            他判定との比較も両グループの保存結果が揃う日のみです。
            対象90暦日の観察結果で、売買手数料・実際の約定・税金や
            当日途中の最大下落は反映していません。
            相場から独立した優位性や将来の利益確率を保証するものではありません。
          </p>
        </section>
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
