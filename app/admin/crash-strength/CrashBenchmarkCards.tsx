"use client";

import { useState } from "react";
import Link from "next/link";

type Row = {
  code: string; name: string; benchmarkBeatRate: number | null;
  averageExcess1: number | null; outperformedCount: number;
  benchmarkSampleCount: number; cost100: number;
};

function signed(value: number | null) {
  if (value===null || !Number.isFinite(value)) return "未観測";
  return (value>0?"+":"")+value.toFixed(2)+"%";
}

function Panel({kind,rows}:{kind:"strong"|"weak";rows:Row[]}) {
  const [expanded,setExpanded] = useState(false);
  const strong=kind==="strong";
  const title=strong?"市場に強い・上位20":"市場に弱い・下位20";
  return <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex items-center justify-between gap-2 pb-2">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl font-black text-white "+
          (strong?"bg-gradient-to-br from-emerald-400 to-green-700":"bg-gradient-to-br from-red-400 to-rose-700")}>
          {strong?"↗":"↘"}</span>
        <h3 className="min-w-0 text-base font-black leading-5 text-slate-900">{title}</h3>
      </div>
      {rows.length>2&&<button type="button" onClick={()=>setExpanded(x=>!x)} aria-expanded={expanded}
        className="shrink-0 rounded-lg px-1.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">
        {expanded?"閉じる ↑":"もっと見る ›"}
      </button>}
    </div>
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-[20px_minmax(0,1fr)_65px_71px] items-center gap-1 bg-slate-50 px-2 py-2 text-[10px] font-bold text-slate-500 sm:grid-cols-[30px_minmax(0,1fr)_110px_120px] sm:text-xs">
        <span>#</span>
        <span>銘柄名（コード）</span>
        <span className="text-right">市場勝率</span>
        <span className="text-right">超過平均</span>
      </div>
      {rows.slice(0,expanded?20:2).map((item,i)=>
        <div key={item.code} className="grid grid-cols-[20px_minmax(0,1fr)_65px_71px] items-center gap-1 border-t border-slate-100 bg-white px-2 py-2.5 text-xs sm:grid-cols-[30px_minmax(0,1fr)_110px_120px] sm:text-sm">
          <span className="text-center font-bold">{i===0?"🥇":i===1?"🥈":i+1}</span>
          <Link href={"/chart/"+item.code} aria-label={item.name+"のチャートを見る"}
            className="min-w-0 font-black leading-4 text-slate-900 hover:text-blue-700">
            <span className="block break-words">{item.name}</span>
            <span className="text-[10px] font-normal text-slate-500">({item.code})</span>
          </Link>
          <span className={"text-right font-black "+(item.benchmarkBeatRate===null?"text-slate-500":item.benchmarkBeatRate>50?"text-emerald-700":"text-rose-700")}>
            {item.benchmarkBeatRate===null?"—":item.benchmarkBeatRate.toFixed(1)+"%"}
          </span>
          <span className={"text-right font-black "+(item.averageExcess1===null?"text-slate-500":item.averageExcess1>=0?"text-emerald-700":"text-rose-700")}>{signed(item.averageExcess1)}</span>
        </div>)}
      {rows.length===0&&<p className="p-3 text-xs text-slate-500">日経平均との比較データを検証中です。</p>}
    </div>
    {expanded&&<p className="mt-2 text-[11px] text-slate-500">
      数値は過去{rows[0]?.benchmarkSampleCount??0}件前後の保存参考終値によるもの。
      各銘柄名を押すとチャートを確認できます。売買推奨ではありません。
    </p>}
  </section>;
}

export default function CrashBenchmarkCards({strong,weak}:{strong:Row[];weak:Row[]}) {
  return <div className="space-y-2">
    <Panel kind="strong" rows={strong}/>
    <Panel kind="weak" rows={weak}/>
  </div>;
}
