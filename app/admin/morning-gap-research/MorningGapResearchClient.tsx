"use client";

import Link from "next/link";
import { useState } from "react";
import {
  appendMorningCSV,
  makeSingleMorningCSV,
  MORNING_DEFAULTS,
  parseMorningCSV,
  runMorningResearch,
  type MorningOptions,
  type MorningReport,
  type MorningTrade,
} from "@/app/lib/research/morningGapResearch";

const sampleBarsHeader = "code,date,time,open,high,low,close,volume,prev_close";

function fictionalSample(): string {
  // Entirely invented prices. No real symbols, market data, or claim of historical performance.
  const rows = [sampleBarsHeader];
  for (const [code, date, prevClose, gap, step] of [
    ["DEMO01", "2026-10-06", 1000, 40, 3],
    ["DEMO02", "2026-10-07", 1200, 60, -2],
    ["DEMO03", "2026-10-08", 800, 15, 1],
  ] as const) {
    let close = prevClose + gap;
    for (let i = 0; i < 18; i += 1) {
      const minute = 9 * 60 + 5 * i;
      const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const open = close;
      close = open + step;
      const high = Math.max(open, close) + 5, low = Math.min(open, close) - 5;
      rows.push([code, date, time, open, high, low, close, 30000, prevClose].join(","));
    }
  }
  return rows.join("\n");
}

const money = (value: number) => `${value.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}円`;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}`;
const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;

function exportCsv(filename: string, source: string) {
  // Local-only browser download. The file is never posted to SIGNALX.
  const url = URL.createObjectURL(new Blob(["\uFEFF", source], { type: "text/csv;charset=utf-8" }));
  const element = document.createElement("a");
  element.href = url;
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  element.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string | number) {
  const source = String(value);
  return /["\n,]/.test(source) ? `"${source.replace(/"/g, '""')}"` : source;
}

function tradeCsv(trades: MorningTrade[]): string {
  const names = ["code", "date", "strategy", "gap_pct", "entry_time", "exit_time", "entry_price", "exit_price", "net_yen", "net_pct", "reason"];
  const rows = trades.map((x) => [x.code, x.date, x.strategy, x.gapPct, x.entryTime, x.exitTime, x.entryPrice, x.exitPrice, x.netYen, x.netPct, x.reason].map(csvCell).join(","));
  return [names.join(","), ...rows].join("\n");
}

function TimePlaceholder() {
  return (
    <span className="text-xs leading-5 text-slate-500 dark:text-slate-400">
      09:00,始値,高値,安値,終値,出来高 の順に18行。時刻は足の<b>開始時刻（日本時間）</b>。
    </span>
  );
}

export default function MorningGapResearchClient() {
  const [csv, setCsv] = useState("");
  const [options, setOptions] = useState<MorningOptions>({ ...MORNING_DEFAULTS });
  const [report, setReport] = useState<MorningReport | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [code, setCode] = useState("");
  const [date, setDate] = useState("");
  const [prevClose, setPrevClose] = useState("");
  const [manualLines, setManualLines] = useState("");
  const [showTrades, setShowTrades] = useState(false);

  const invalidate = () => { setReport(null); setError(""); setNotice(""); };
  const settings = (
    key: keyof MorningOptions,
    value: string,
  ) => { setOptions((prev) => ({ ...prev, [key]: value === "" ? Number.NaN : Number(value) })); invalidate(); };

  const run = () => {
    invalidate();
    try {
      if (!csv.trim()) throw new Error("まずCSVまたは5分足18行を入力してください。");
      const result = runMorningResearch(csv, options);
      setReport(result);
      setNotice(`検証完了：${result.completeGroups}銘柄・日、除外 ${result.skipped.length}件。`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "検証できませんでした。"); }
  };

  const addSingle = () => {
    invalidate();
    try {
      const newCsv = makeSingleMorningCSV(code, date, Number(prevClose), manualLines);
      const next = appendMorningCSV(demoMode ? "" : csv, newCsv);
      setCsv(next);
      setDemoMode(false);
      setNotice(`追加しました：${code}／${date}。CSVを保存してから検証してください。`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "追加できませんでした。"); }
  };

  const downloadInput = () => {
    try {
      parseMorningCSV(csv);
      exportCsv("signalx_morning_ohlcv_input.csv", csv);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "CSVに不備があります。"); }
  };
  const downloadTrades = () => {
    if (!report) return;
    exportCsv("signalx_morning_shadow_results.csv", tradeCsv(report.strategies.flatMap((s) => s.trades)));
  };

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href="/admin/learning-status" className="text-sm font-bold text-blue-600 dark:text-blue-300">← 管理者の学習状況に戻る</Link>
        <header className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-black tracking-widest text-emerald-700 dark:text-emerald-300">ADMIN RESEARCH / SHADOW ONLY / NO EXTRA DATA FEES</p>
          <h1 className="mt-2 text-2xl font-black">🧪 朝のギャップアップ × VWAP 研究室</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">9:00〜9:25の5分足6本から、9:30時点で条件が成立するか確認し、9:30始値で仮想エントリーした場合の10:30までの成績を比較します。投稿で紹介された「9:00〜9:30に買う手法」とは異なる、検証用の固定ルールです。</p>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            本番の株価取得・AIスコア・通知・疑似購入・データベースには接続していません。入力・計算はこのブラウザ内だけで行います。実データの取得元と利用条件を守ってください。
          </p>
        </header>

        <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">① 実際の5分足を入力</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">楽天証券などで確認したOHLCVを手入力。1銘柄につき09:00〜10:25の開始時刻で18本必要です。Excel不要・外部API不要。</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-bold">銘柄コード
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例：7203" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900" />
            </label>
            <label className="text-sm font-bold">対象営業日
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900" />
            </label>
            <label className="text-sm font-bold">前営業日の終値（円）
              <input type="number" inputMode="decimal" min="0" step="any" value={prevClose} onChange={(e) => setPrevClose(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900" />
            </label>
          </div>
          <label className="mt-3 block text-sm font-bold">5分足（18行をまとめて貼り付け）
            <textarea value={manualLines} onChange={(e) => setManualLines(e.target.value)} rows={5} spellCheck={false}
              placeholder="09:00,1040,1045,1038,1043,60000\n09:05,1043,1050,1042,1048,55000"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900" />
          </label>
          <TimePlaceholder />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={addSingle} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white">➕ この銘柄・日を追加</button>
            <button type="button" onClick={() => {
              setManualLines(Array.from({ length: 18 }, (_, i) => {
                const m = 540 + 5 * i;
                return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")},,,,,`;
              }).join("\n"));
            }} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold">時刻ひな型を作る</button>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">② CSVを管理する</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="rounded-xl border border-slate-300 p-3 text-sm font-bold">既存CSVを選ぶ
              <input type="file" accept=".csv,text/csv" className="mt-2 block max-w-full text-sm" onChange={async (e) => {
                const selected = e.target.files?.[0];
                if (!selected) return;
                invalidate();
                try {
                  if (selected.size > 3_000_000) throw new Error("3MB以下のCSVに分けてください。");
                  const contents = await selected.text();
                  parseMorningCSV(contents);
                  setCsv(contents);
                  setDemoMode(false);
                  setNotice(`CSVを読み込みました：${selected.name}`);
                } catch (cause) { setError(cause instanceof Error ? cause.message : "CSVを読み込めませんでした。"); }
                e.target.value = "";
              }} />
            </label>
            <button type="button" onClick={downloadInput} disabled={!csv.trim()} className="rounded-xl border border-blue-400 px-4 py-3 text-sm font-black text-blue-700 disabled:opacity-40 dark:text-blue-200">入力済みCSVを保存</button>
            <button type="button" onClick={() => { setCsv(fictionalSample()); setReport(null); setError(""); setDemoMode(true); setNotice("架空の価格を読み込みました。実績ではありません。"); }} className="rounded-xl border border-amber-500 px-4 py-3 text-sm font-black text-amber-700 dark:text-amber-300">架空サンプルを試す</button>
          </div>
          <label className="mt-3 block text-sm font-bold">検証対象CSV（編集・貼り付け可能）
            <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setDemoMode(false); invalidate(); }} rows={5} spellCheck={false}
              placeholder="code,date,time,open,high,low,close,volume,prev_close"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900" />
          </label>
          {demoMode && <p className="mt-2 rounded-lg bg-amber-100 p-2 text-sm font-black text-amber-900">⚠️ 架空サンプルです。表示される勝率・利益は現実の取引成績ではありません。</p>}
        </section>

        <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">③ 仮想売買の条件</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              ["minGapPct", "最小ギャップ（%）"], ["maxGapPct", "最大ギャップ（%）"],
              ["minFirst30Volume", "最初の30分の出来高（株）"], ["shares", "購入株数"],
              ["takeProfitPct", "利確（%）"], ["stopLossPct", "損切り（%）"],
              ["slippageBps", "売買ごとの滑り（bp）"], ["roundTripFeeYen", "往復手数料（円）"],
            ] as Array<[keyof MorningOptions, string]>).map(([key, title]) => (
              <label key={key} className="text-xs font-bold">{title}
                <input type="number" min="0" step="any" inputMode="decimal" value={Number.isNaN(options[key]) ? "" : options[key]}
                  onChange={(e) => settings(key, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-base text-slate-900" />
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">エントリーは09:30足の始値と仮定。利確・損切りの両方に同じ5分足で到達した場合、保守的に損切りを先に採用。ギャップを伴う損切りや滑りを考慮しますが、板・売買停止・実際の約定可否は再現できません。</p>
          <button type="button" onClick={run} className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-4 text-base font-black text-white">🔍 3条件の勝率・利益を比較</button>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800 dark:bg-red-950 dark:text-red-100">{error}</p>}
          {notice && <p role="status" className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-100">{notice}</p>}
        </section>

        {report && <section className="space-y-4 rounded-2xl border border-emerald-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">④ 比較結果{demoMode ? "（完全に架空のデータ）" : "（取り込んだデータ）"}</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["入力した銘柄・日", report.totalGroups], ["検証可能", report.completeGroups], ["除外", report.skipped.length]].map(([title, count]) => <div key={title} className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800"><div className="text-xs text-slate-500 dark:text-slate-400">{title}</div><div className="text-2xl font-black">{count}</div></div>)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-slate-300 bg-slate-100 dark:bg-slate-800">{["条件", "取引数", "勝率", "平均損益率", "損益合計", "PF"].map((h) => <th key={h} className="px-2 py-3">{h}</th>)}</tr></thead>
              <tbody>{report.strategies.map((s) => <tr key={s.id} className="border-b border-slate-200 dark:border-slate-700"><td className="px-2 py-3 font-bold">{s.label}</td><td className="px-2 py-3">{s.stats.trades}</td><td className="px-2 py-3">{percent(s.stats.winRate)}</td><td className="px-2 py-3">{s.stats.avgNetPct === null ? "—" : `${signed(s.stats.avgNetPct)}%`}</td><td className={`px-2 py-3 font-bold ${s.stats.totalYen < 0 ? "text-red-600" : "text-emerald-700 dark:text-emerald-300"}`}>{money(s.stats.totalYen)}</td><td className="px-2 py-3">{s.stats.profitFactor === null ? "—" : s.stats.profitFactor === Infinity ? "∞" : s.stats.profitFactor.toFixed(2)}</td></tr>)}</tbody>
            </table>
          </div>
          {report.completeGroups < 30 && <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-100">現在の件数では手法の優位性を判定できません。最低でも異なる日付・銘柄のデータを幅広く集め、別期間で再検証してください。30件でも統計的な十分性は保証されません。</p>}
          {report.skipped.length > 0 && <details className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><summary className="cursor-pointer font-bold">除外されたデータ（{report.skipped.length}件）</summary><ul className="mt-2 list-disc pl-4 text-sm">{report.skipped.map((x) => <li key={`${x.code}|${x.date}`}>{x.code} {x.date}：{x.reason}</li>)}</ul></details>}
          <div className="flex flex-wrap gap-2">
            <button onClick={downloadTrades} disabled={report.strategies.every((s) => !s.trades.length)} className="rounded-xl border border-emerald-600 px-4 py-3 text-sm font-black text-emerald-700 disabled:opacity-40 dark:text-emerald-200">取引ごとの結果をCSV保存</button>
            <button onClick={() => setShowTrades((v) => !v)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black">{showTrades ? "詳細を閉じる" : "取引詳細を見る"}</button>
          </div>
          {showTrades && <div className="max-h-80 overflow-auto"><table className="w-full min-w-[680px] text-xs"><thead><tr>{["銘柄", "日付", "条件", "買値", "売値", "損益", "理由"].map((name) => <th className="p-2 text-left" key={name}>{name}</th>)}</tr></thead><tbody>{report.strategies.flatMap((s) => s.trades).map((x, i) => <tr key={`${x.code}-${x.date}-${x.strategy}-${i}`} className="border-t"><td className="p-2">{x.code}</td><td>{x.date}</td><td>{x.strategy}</td><td>{x.entryPrice.toFixed(2)}</td><td>{x.exitPrice.toFixed(2)}</td><td>{money(x.netYen)}</td><td>{x.reason}</td></tr>)}</tbody></table></div>}
        </section>}
        <footer className="rounded-2xl bg-slate-200 p-4 text-xs leading-6 text-slate-600 dark:bg-slate-800 dark:text-slate-300">無料研究用・未検証。翌足の約定、寄り付きの株価選定、資金拘束、取引上限、ストップ高安、手数料体系、データ使用許諾を必ず別途確認してください。入力を失わないよう検証後はCSVで保存してください（このページには自動保存機能がありません）。</footer>
      </div>
    </main>
  );
}