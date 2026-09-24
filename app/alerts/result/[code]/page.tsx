"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

function yen(raw: string | null) {
  const value = Number(raw);
  if (!raw || !Number.isFinite(value)) return "-";
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function jst(raw: string | null) {
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AlertResultPage() {
  const params = useParams();
  const search = useSearchParams();
  const code = String(params.code);
  const result = search.get("result") === "WIN" ? "WIN" : "LOSE";
  const name = search.get("name") || code;
  const isWin = result === "WIN";

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950">
      <div className="mx-auto max-w-md space-y-4 pt-4">
        <section className={`rounded-3xl border p-5 shadow-sm ${isWin ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <p className={`text-sm font-black ${isWin ? "text-emerald-700" : "text-red-700"}`}>
            {isWin ? "🎯 利確ライン到達" : "🛡 損切ライン到達"}
          </p>
          <h1 className="mt-2 text-2xl font-black">{code} {name}</h1>
          <p className="mt-3 text-sm font-bold text-slate-700">
            これは現在のAI判定ではなく、以前に成立した買いシグナルの結果です。
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">この通知の基準</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">買い基準</dt><dd className="mt-1 text-lg font-black">{yen(search.get("entry"))}</dd></div>
            <div className="rounded-2xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">到達価格</dt><dd className="mt-1 text-lg font-black">{yen(search.get("resultPrice"))}</dd></div>
            <div className="rounded-2xl bg-emerald-50 p-3"><dt className="font-bold text-emerald-700">利確ライン</dt><dd className="mt-1 text-lg font-black">{yen(search.get("takeProfit"))}</dd></div>
            <div className="rounded-2xl bg-red-50 p-3"><dt className="font-bold text-red-700">損切ライン</dt><dd className="mt-1 text-lg font-black">{yen(search.get("stopLoss"))}</dd></div>
          </dl>
          <div className="mt-4 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
            <p>シグナル成立: {jst(search.get("triggeredAt"))}</p>
            <p className="mt-1">結果確定: {jst(search.get("completedAt"))}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
          現在のAI評価は、この通知が発生した時点の評価とは別物です。最新判断を確認する場合は下の「現在のAI分析」を開いてください。
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Link href={`/analysis/${code}`} className="rounded-2xl bg-blue-600 px-4 py-4 text-center font-black text-white shadow-sm">
            現在のAI分析
          </Link>
          <Link href={`/chart/${code}`} className="rounded-2xl border border-slate-300 bg-white px-4 py-4 text-center font-black text-slate-800 shadow-sm">
            最新チャート
          </Link>
        </div>
      </div>
    </main>
  );
}
