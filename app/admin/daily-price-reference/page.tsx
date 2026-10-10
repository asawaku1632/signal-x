"use client";

import Link from "next/link";
import { useState } from "react";

type Observation = {
  code: string; name: string; date: string;
  baselinePrice: number; baselineSavedAt: string | null;
  referencePrice: number; referenceSource: string; referenceBarAt: string;
  observationDateJst: string; observedAt: string;
  differenceYen: number; status: "MATCH" | "MISMATCH";
};
type Result = { code: string; success: boolean; reason?: string; observation?: Observation & { alreadySaved: boolean } };
type SampleChoice = { code: string; name: string; baselinePrice: number; priceBand: string; sector: string };
const yen = (n: number) => n.toLocaleString("ja-JP", { maximumFractionDigits: 4 }) + "円";
const signed = (n: number) => (n > 0 ? "+" : "") + yen(n);

export default function ManualPriceReferencePage() {
  const [date, setDate] = useState("2026-10-09");
  const [codesText, setCodesText] = useState("9984,4062,7182,6740,4493");
  const [observations, setObservations] = useState<Observation[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [candidateChoices, setCandidateChoices] = useState<SampleChoice[]>([]);
  const [sampleSourceCount, setSampleSourceCount] = useState<number | null>(null);

  async function suggestCandidates() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setCandidateChoices([]);
    setSampleSourceCount(null);
    setResults([]);
    setObservations([]);
    try {
      // No date parameter means the latest fully saved trading day before today.
      const response = await fetch("/api/admin/daily-price-sample", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "候補が選べませんでした");
      const choices = (payload.choices ?? []) as SampleChoice[];
      if (choices.length === 0) {
        setNotice("未照合の候補はありません。別の取引日で試してください。");
        return;
      }
      setDate(payload.tradeDate);
      setCodesText(choices.map((item) => item.code).join(","));
      setCandidateChoices(choices);
      setSampleSourceCount(payload.sourceCount);
      setNotice("保存済み銘柄から候補を選び、日付とコードを自動入力しました。まだYahooへのアクセスや参考価格保存は行っていません。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "候補を取得できませんでした");
    } finally {
      setBusy(false);
    }
  }

  function codes() {
    return codesText.replace(/，/g, ",").split(",").map((s) => s.trim()).filter(Boolean);
  }

  const run = async (mode: "GET" | "POST") => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setResults([]);
    setObservations([]);
    try {
      const values = codes();
      if (!values.length || values.length > 5 || values.some((x) => !/^\d{4}$/.test(x))) {
        throw new Error("銘柄コードは4桁、最大5件をカンマ区切りで入力してください");
      }
      const endpoint = "/api/admin/daily-price-reference";
      const url = endpoint + "?date=" + encodeURIComponent(date) + "&codes=" + encodeURIComponent(values.join(","));
      const response = await fetch(mode === "GET" ? url : endpoint,
        mode === "GET" ? { cache: "no-store" } : {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, codes: values }), cache: "no-store",
        });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "照合できませんでした");
      if (mode === "GET") {
        setObservations(data.observations ?? []);
        setNotice("保存済みの比較結果を表示しています（外部取得なし）。");
      } else {
        setResults(data.results ?? []);
        setNotice(`参考価格を新規保存：${data.saved ?? 0}件。保存できなかった銘柄は理由を確認してください。`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "取得に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const display = results.length ? results.filter((r) => r.success && r.observation).map((r) => r.observation!) : observations;
  return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/daily-price-audit" className="text-sm font-bold text-blue-600">← 日次株価の差額調査</Link>
        <Link href="/admin/price-reference-trend" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">📊 差額の傾向を見る</Link>
      </div>
      <header className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-black tracking-wider text-blue-600">ADMIN RESEARCH / SHADOW ONLY</p>
        <h1 className="mt-2 text-xl font-black">🧪 判定時の価格・後日の参考終値</h1>
        <p className="mt-2 text-sm leading-6">
          元のAI判定時価格を保持したまま、後日取得したYahoo日足の参考値を<b>別テーブル</b>へ記録します。
          保存価格・勝敗・売買判定・通知は変更しません。
        </p>
      </header>
      <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="space-y-3">
          <label className="block text-sm font-bold">取引日
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-3 text-slate-900"/>
          </label>
          <div>
            <button type="button" disabled={busy} onClick={() => void suggestCandidates()}
              className="w-full rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-3 text-sm font-bold text-indigo-800 disabled:opacity-50">
              {busy ? "準備中…" : "🎯 最新営業日の比較候補5銘柄を自動入力（外部取得なし）"}
            </button>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              既存の学習保存データから価格帯を分散して選び、同じ取引日で照合済みの銘柄は除外します。
              自動入力だけでは外部サービスに接続しません。
            </p>
          </div>
          <label className="block text-sm font-bold">銘柄コード（最大5件）
            <input value={codesText} onChange={(e) => setCodesText(e.target.value)}
              placeholder="9984,4062,7182" className="mt-1 w-full rounded-xl border px-3 py-3 text-slate-900"/>
          </label>
        </div>
        <button type="button" disabled={busy} onClick={() => void run("GET")}
          className="mt-4 w-full rounded-xl border border-blue-300 px-3 py-3 font-bold text-blue-700 disabled:opacity-50">
          保存済みデータを見る（外部取得なし）
        </button>
        <button type="button" disabled={busy} onClick={() => void run("POST")}
          className="mt-2 w-full rounded-xl bg-blue-600 px-3 py-3 font-bold text-white disabled:opacity-50">
          {busy ? "照合中…" : "Yahoo日足と照合して別保存する"}
        </button>
        {candidateChoices.length > 0 && <section className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-indigo-950">
          <h2 className="text-sm font-black">自動選定された候補（保存済みの{sampleSourceCount ?? "—"}銘柄から）</h2>
          <div className="mt-2 space-y-1">
            {candidateChoices.map((item) => <p key={item.code} className="text-xs">
              <span className="font-bold">{item.code} {item.name}</span>・{item.priceBand}・{item.sector}
            </p>)}
          </div>
        </section>}
        {notice && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      </section>
      {results.some((r) => !r.success) && <section className="rounded-xl border bg-white p-3 dark:bg-slate-900">
        <p className="text-sm font-bold">今回記録できなかった銘柄</p>
        {results.filter((r) => !r.success).map((r) => <p key={r.code} className="text-sm text-slate-500">{r.code}: {r.reason}</p>)}
      </section>}
      <div className="space-y-3">
        {display.map((item, index) => <article key={item.code + item.observedAt + index}
          className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex justify-between gap-2">
            <h2 className="font-black">{item.code} {item.name}</h2>
            <span className={item.status === "MATCH" ? "text-emerald-700" : "text-amber-600"}>
              {item.status === "MATCH" ? "一致" : "差異あり"}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-900">
              <p className="text-xs">判定時に保存した価格</p><p className="text-xl font-black">{yen(item.baselinePrice)}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-900">
              <p className="text-xs">後日のYahoo日足参考値</p><p className="text-xl font-black">{yen(item.referencePrice)}</p>
            </div>
          </div>
          <p className="mt-2 text-sm font-bold">差額：{signed(item.differenceYen)}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            取引日：{item.date} ／ 参照元：{item.referenceSource}<br />
            参考値を照合した日：{item.observationDateJst}（当日1回まで保存）
          </p>
        </article>)}
      </div>
      <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        ※ Yahooの日足データは公式な確定約定値と同義ではありません。
        速報修正・株式分割・取得条件などで変わる場合があります。
        比較結果は研究用で、買い・売りの自動判定に利用しません。
      </p>
    </div>
  </main>;
}
