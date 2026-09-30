"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/app/components/BottomNav";

type Stock = {
  code: string;
  name: string;
  score: number;
  rawAiPower?: number;
  price?: number;
  changePercent?: number;
  volumeRatio?: number;
  patternSignal?: string;
};

type SignalType = "s-rank" | "buy" | "w-break" | "volume";

const configs: Record<SignalType, { title: string; icon: string; description: string; color: string }> = {
  "s-rank": { title: "Sランク", icon: "👑", description: "AI POWER 95以上の最上位候補", color: "text-yellow-500" },
  buy: { title: "買い候補", icon: "🟢", description: "AI POWER 85以上の注目候補", color: "text-green-600" },
  "w-break": { title: "W突破", icon: "📈", description: "Wボトム突破を検出した銘柄", color: "text-blue-600" },
  volume: { title: "出来高", icon: "🔥", description: "出来高が通常の2倍以上の銘柄", color: "text-purple-600" },
};

function sortStocks(list: Stock[]) {
  return [...list].sort((a, b) => (b.rawAiPower ?? b.score) - (a.rawAiPower ?? a.score));
}

export default function SignalsPage() {
  const params = useSearchParams();
  const rawType = params.get("type") as SignalType | null;
  const type: SignalType = rawType && rawType in configs ? rawType : "s-rank";
  const config = configs[type];
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch("/api/scan?limit=100&top=100", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (!active) return;
        const list = Array.isArray(json?.stocks) ? json.stocks : [];
        setStocks(sortStocks(list));
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => stocks.filter((s) => {
    if (type === "s-rank") return s.score >= 95;
    if (type === "buy") return s.score >= 85;
    if (type === "w-break") return s.patternSignal === "W_BOTTOM_BREAK";
    return (s.volumeRatio ?? 1) >= 2;
  }), [stocks, type]);

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-3 pt-3">
        <div className="mb-3 flex items-center gap-3">
          <Link href="/dashboard" className="grid h-10 w-10 place-items-center rounded-xl border bg-white shadow-sm">←</Link>
          <div>
            <p className="text-xs font-black text-blue-600">今日のSIGNALX AI</p>
            <h1 className="text-2xl font-black">{config.icon} {config.title}</h1>
          </div>
        </div>

        <section className="mb-3 rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-4">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-sm font-bold text-slate-500">{config.description}</p><p className="mt-1 text-xs font-bold text-slate-400">銘柄をタップするとAI分析へ移動します</p></div>
            <div className={`text-3xl font-black ${config.color}`}>{loading ? "--" : filtered.length}</div>
          </div>
        </section>

        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {(["s-rank", "buy", "w-break", "volume"] as SignalType[]).map((key) => (
            <Link key={key} href={`/signals?type=${key}`} className={`rounded-xl border bg-white px-1 py-2 text-center ${key === type ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200"}`}>
              <p className="text-[10px] font-black text-slate-500">{configs[key].title}</p>
            </Link>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {loading ? <p className="p-5 text-center font-bold text-slate-500">読み込み中...</p> : error ? <p className="p-5 text-center font-bold text-red-500">データを取得できませんでした</p> : filtered.length === 0 ? <p className="p-5 text-center font-bold text-slate-500">現在、該当する銘柄はありません</p> : filtered.map((s, i) => (
            <Link key={s.code} href={`/analysis/${s.code}`} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 active:bg-slate-50">
              <span className="w-6 text-center text-sm font-black text-slate-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black">{s.code} {s.name}</p>
                <p className="mt-0.5 text-xs font-bold text-slate-500">{typeof s.price === "number" ? `¥${s.price.toLocaleString()}` : ""}{typeof s.changePercent === "number" ? `　${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(2)}%` : ""}{type === "volume" && typeof s.volumeRatio === "number" ? `　出来高 ${s.volumeRatio.toFixed(2)}倍` : ""}</p>
              </div>
              <div className="text-right"><p className="font-black text-blue-600">AI {Math.round(s.score * 10) / 10}</p><p className="text-xs font-black text-slate-400">›</p></div>
            </Link>
          ))}
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
