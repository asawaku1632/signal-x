"use client";

import { useEffect, useState } from "react";

type Simulation = {
  initialCapital: number;
  currentCapital: number;
  realizedProfitYen: number;
  returnPercent: number;
  tradeCount: number;
  skippedInsufficientFunds: number;
  lotSize: number;
  rules: string[];
  limitation: string;
};

function yen(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value).toLocaleString("ja-JP")}円`;
}

export default function CapitalSimulationCard({ code }: { code: string }) {
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/performance/stock/${code}/capital-simulation`, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error("simulation failed");
        if (active) setSimulation(json.simulation);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [code]);

  if (failed) return null;

  return (
    <section className="mt-5 rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black tracking-[0.18em] text-emerald-600">
        CAPITAL SIMULATION
      </p>
      <h2 className="mt-2 text-2xl font-black">10万円運用シミュレーション</h2>
      <p className="mt-2 text-xs font-bold leading-6 text-slate-500">
        SIGNALXの買い候補以上だけを100株単位で取引した場合の資金推移です。
      </p>

      {!simulation ? (
        <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">
          計算中...
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-[2rem] bg-emerald-50 p-5">
            <p className="text-xs font-black text-emerald-700">10万円 → 現在資産</p>
            <p className="mt-2 text-4xl font-black text-slate-950">
              {simulation.currentCapital.toLocaleString("ja-JP")}円
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-3">
                <p className="text-[11px] font-black text-slate-500">実現損益</p>
                <p className={`mt-1 text-lg font-black ${simulation.realizedProfitYen >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {yen(simulation.realizedProfitYen)}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-3">
                <p className="text-[11px] font-black text-slate-500">運用成績</p>
                <p className={`mt-1 text-lg font-black ${simulation.returnPercent >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {simulation.returnPercent > 0 ? "+" : ""}{simulation.returnPercent}%
                </p>
              </div>
              <div className="rounded-2xl bg-white p-3">
                <p className="text-[11px] font-black text-slate-500">取引回数</p>
                <p className="mt-1 text-lg font-black">{simulation.tradeCount}回</p>
              </div>
              <div className="rounded-2xl bg-white p-3">
                <p className="text-[11px] font-black text-slate-500">資金不足で見送り</p>
                <p className="mt-1 text-lg font-black">{simulation.skippedInsufficientFunds}回</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm font-black text-amber-800">この数字の意味</p>
            <p className="mt-2 text-xs font-bold leading-6 text-amber-900/80">
              {simulation.limitation}
            </p>
          </div>

          <details className="mt-4 rounded-3xl bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-black text-slate-700">計算ルールを見る</summary>
            <ul className="mt-3 space-y-2 pl-5 text-xs font-bold leading-5 text-slate-500">
              {simulation.rules.map((rule) => <li key={rule} className="list-disc">{rule}</li>)}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
