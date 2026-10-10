"use client";

import Link from "next/link";
import { useState } from "react";

type Audit = {
  success: boolean;
  status: "MATCH" | "MISMATCH" | "PENDING" | "UNVERIFIED";
  saved: { code: string; name: string; date: string; price: number; savedAt: string; source: string };
  reference: { date: string; price: number; barTime: string; source: string } | null;
  differenceYen?: number;
  differencePercent?: number;
  checkedAt: string;
  note: string;
};
const yen = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 4 }) + "円";
const signed = (value: number) => (value > 0 ? "+" : "") + value.toFixed(2);

export default function DailyPriceAuditPage() {
  const [code, setCode] = useState("9984");
  const [date, setDate] = useState("2026-10-09");
  const [result, setResult] = useState<Audit | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(
        "/api/admin/daily-price-audit?code=" + encodeURIComponent(code.trim()) + "&date=" + encodeURIComponent(date),
        { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "照合できませんでした");
      setResult(body as Audit);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "照合できませんでした");
    } finally {
      setLoading(false);
    }
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/learning-status" className="text-sm font-bold text-blue-600">← AI学習保存状況</Link>
        <Link href="/admin/daily-price-reference" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">🧪 参考終値を別保存する</Link>
      </div>
      <header className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-black tracking-wider text-blue-600">ADMIN / READ ONLY</p>
        <h1 className="mt-2 text-2xl font-black">🔎 日次株価の差額調査</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          15:35頃の学習保存価格と、後から取得したYahoo日足の価格を取引日ごとに比較します。
          保存データ・AI判定・通知には一切変更を加えません。
        </p>
      </header>
      <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs font-bold">銘柄コード
            <input inputMode="numeric" maxLength={4} value={code} onChange={(event) => setCode(event.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-base text-slate-900" placeholder="9984"/>
          </label>
          <label className="space-y-1 text-xs font-bold">保存日
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border px-2 py-2 text-base text-slate-900"/>
          </label>
        </div>
        <button type="button" onClick={() => void verify()} disabled={loading}
          className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white disabled:opacity-60">
          {loading ? "株価を照合しています…" : "この銘柄・日付を照合"}
        </button>
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      </section>
      {result && <section className="space-y-3 rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{result.saved.date} / {result.saved.code}</p>
          <h2 className="text-lg font-black">{result.saved.name}</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">学習保存価格</p>
            <p className="mt-1 text-xl font-black">{yen(result.saved.price)}</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Yahoo日足・参考終値</p>
            <p className="mt-1 text-xl font-black">{result.reference ? yen(result.reference.price) : "未確認"}</p>
          </div>
        </div>
        {result.status === "MISMATCH" &&
          <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
            要確認：保存価格との差 {signed(result.differenceYen ?? 0)}円（{signed(result.differencePercent ?? 0)}%）
          </p>}
        {result.status === "MATCH" &&
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">日足と一致しています</p>}
        {(result.status === "PENDING" || result.status === "UNVERIFIED") &&
          <p className="rounded-xl bg-slate-100 p-3 text-sm">参考値がまだ確定・取得できないため判定を保留しています。</p>}
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          学習保存：{new Date(result.saved.savedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          {result.reference && <> / 参考足：{result.reference.date}</>}
        </p>
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{result.note}</p>
      </section>}
    </div>
  </main>;
}
