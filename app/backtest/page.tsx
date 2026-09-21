"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BacktestItem = {
  reason: string; total: number; win: number; lose: number; winRate: number;
  avgProfitRate: number; maxProfitRate: number; minProfitRate: number;
};

export default function BacktestPage() {
  const [data, setData] = useState<BacktestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/history/stats", { cache: "no-store" });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.message || result.error || "バックテスト実績の取得に失敗しました");
        const sorted = (result.data || result.stats || []).sort((a: BacktestItem, b: BacktestItem) => b.winRate + b.avgProfitRate - (a.winRate + a.avgProfitRate));
        setData(sorted);
        setErrorMessage("");
      } catch (error) {
        console.error("バックテスト取得失敗", error);
        setErrorMessage(error instanceof Error ? error.message : "バックテスト実績の取得に失敗しました");
      } finally { setLoading(false); }
    })();
  }, []);

  const best = data[0];
  const judge = (w:number,p:number) => w >= 75 && p > 0 ? "最強候補" : w >= 60 && p > 0 ? "有力" : w >= 50 ? "普通" : "要確認";
  const signed = (v:number) => `${v > 0 ? "+" : ""}${v}%`;

  return (
    <main className="min-h-screen bg-[#f6f8fc] pb-12 text-slate-900">
      <div className="mx-auto max-w-md px-4">
        <header className="sticky top-0 z-30 -mx-4 border-b border-slate-200/70 bg-[#f6f8fc]/90 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-2xl font-black shadow-sm" aria-label="戻る">‹</Link>
            <div className="text-center"><div className="text-3xl font-black tracking-tight">SIGNAL<span className="text-blue-600">X</span></div><div className="text-[10px] font-black tracking-[.22em] text-slate-500">AI PERFORMANCE</div></div>
            <Link href="/performance" className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-xl shadow-sm" aria-label="AI実績">🏆</Link>
          </div>
        </header>

        <section className="pt-6">
          <p className="text-[10px] font-black tracking-[.2em] text-blue-600">BACKTEST</p>
          <h1 className="mt-1 text-3xl font-black">SIGNALXバックテスト</h1>
          <p className="mt-2 text-xs font-bold text-slate-500">保存されたシグナル結果から戦法別の勝率と損益率を分析</p>
        </section>

        {loading && <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400 shadow-sm">実績データを読み込み中...</div>}
        {!loading && errorMessage && <div className="mt-6 rounded-[2rem] border border-red-200 bg-red-50 p-5"><p className="font-black text-red-700">バックテストデータを取得できませんでした</p><p className="mt-2 text-xs text-red-600">{errorMessage}</p></div>}
        {!loading && !errorMessage && data.length === 0 && <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="font-black">判定済みデータを蓄積中です</p><p className="mt-2 text-xs font-bold text-slate-400">WIN / LOSE が確定すると、ここに戦法別実績が表示されます。</p></div>}

        {best && <section className="mt-6 rounded-[2rem] border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-black text-blue-600">🔥 TODAY BEST STRATEGY</p><h2 className="mt-3 text-3xl font-black">{best.reason}</h2><p className="mt-2 text-xs font-bold text-slate-500">AIが最も強いと判断した戦法</p></div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center"><p className="text-[10px] font-black text-slate-500">AI POWER</p><p className="text-4xl font-black text-blue-600">{Math.min(100,Math.round(best.winRate+best.avgProfitRate))}</p></div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Metric label="勝率" value={`${best.winRate}%`} tone="green" />
            <Metric label="平均利益" value={signed(best.avgProfitRate)} tone="green" />
            <Metric label="成功数" value={String(best.win)} tone="blue" />
          </div>
        </section>}

        {data.length > 0 && <section className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">戦法別バックテスト結果</h2><p className="mt-1 text-xs font-bold text-slate-400">各戦法の過去実績を比較</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
            <div className="grid grid-cols-[1.2fr_.8fr_.9fr_.8fr] bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-400"><span>戦法</span><span className="text-right">勝率</span><span className="text-right">平均利益</span><span className="text-right">取引数</span></div>
            {data.map((item,i)=><div key={item.reason} className={`grid grid-cols-[1.2fr_.8fr_.9fr_.8fr] items-center border-t border-slate-100 px-3 py-3 text-xs ${i===0?"bg-blue-50":""}`}><span className={`font-black ${i===0?"text-blue-600":""}`}>{item.reason}</span><span className="text-right font-black text-emerald-600">{item.winRate}%</span><span className={`text-right font-black ${item.avgProfitRate>=0?"text-emerald-600":"text-red-500"}`}>{signed(item.avgProfitRate)}</span><span className="text-right font-black">{item.total.toLocaleString()}</span></div>)}
          </div>
        </section>}

        {best && <section className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">{best.reason}の詳細データ</h2><p className="mt-1 text-xs font-bold text-slate-400">過去の{best.reason}シグナルの統計</p>
          <div className="mt-4 grid grid-cols-4 gap-2"><Metric label="総数" value={best.total.toLocaleString()} /><Metric label="成功" value={best.win.toLocaleString()} tone="green"/><Metric label="失敗" value={best.lose.toLocaleString()} tone="red"/><Metric label="勝率" value={`${best.winRate}%`} tone="blue"/></div>
          <div className="mt-2 grid grid-cols-3 gap-2"><Metric label="平均利益" value={signed(best.avgProfitRate)} tone={best.avgProfitRate>=0?"green":"red"}/><Metric label="最大利益" value={signed(best.maxProfitRate)} tone="green"/><Metric label="最大損失" value={signed(best.minProfitRate)} tone="red"/></div>
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-[10px] font-black text-amber-700">AI評価</p><p className="mt-1 text-lg font-black text-amber-700">{judge(best.winRate,best.avgProfitRate)}</p></div>
        </section>}

        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs font-bold leading-5 text-slate-500">ⓘ 過去のシグナル結果を基にした統計です。将来の成績を保証するものではありません。</div>
      </div>
    </main>
  );
}

function Metric({label,value,tone="dark"}:{label:string;value:string;tone?:"dark"|"green"|"red"|"blue"}) {
  const color={dark:"text-slate-900",green:"text-emerald-600",red:"text-red-500",blue:"text-blue-600"}[tone];
  return <div className="min-w-0 rounded-2xl bg-slate-50 p-3 text-center"><p className="text-[9px] font-bold text-slate-400">{label}</p><p className={`mt-1 truncate text-base font-black ${color}`}>{value}</p></div>;
}
