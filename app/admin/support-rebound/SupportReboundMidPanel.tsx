"use client";
import Link from "next/link";
import { useMemo } from "react";
import type { ScoredHint } from "@/app/lib/research/supportReboundRiskScore";
import { analyzeMidRisk } from "@/app/lib/research/supportReboundMidRisk";
import type { RiskPhase } from "@/app/lib/research/supportReboundRiskStudy";
const n=(v:number)=>v.toLocaleString("ja-JP",{maximumFractionDigits:2});
const pct=(v:number|null)=>v===null?"—":n(v)+"%";
const signed=(v:number|null)=>v===null?"—":(v>0?"+":"")+pct(v);
const day=(t:number)=>new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(t*1000));
export default function SupportReboundMidPanel({scores,phase,busy}:{
  scores:ScoredHint[];phase:RiskPhase;busy:boolean;
}){
  const phases=useMemo(()=>({
    ALL:analyzeMidRisk(scores,"ALL"), TRAIN:analyzeMidRisk(scores,"TRAIN"), TEST:analyzeMidRisk(scores,"TEST"),
  }),[scores]);
  const current=phases[phase];
  return <details className="mt-4 rounded-xl border border-amber-200 bg-white p-3">
    <summary className="cursor-pointer text-sm font-black">🧩 中リスク30〜59点で大損が多い理由を分析</summary>
    <p className="mt-3 text-xs leading-6 text-slate-600">
      「高リスク」より「中リスク」の過去大損率が高かったため、まず元の配点を一切変えず、
      サイン当日の5指標の組み合わせを観察します。該当条件が原因と証明されたわけではありません。
      {busy&&"データ取得中のため数値は暫定です。"}
    </p>
    <div className="mt-3 grid grid-cols-3 gap-2">
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">中リスク取引</p><p className="text-lg font-black">{current.total.count}件</p></div>
      <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-slate-500">大損（-5%以下）</p><p className="text-lg font-black">{current.total.bigLosses}件</p></div>
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">大損率</p><p className="text-lg font-black">{pct(current.total.bigLossPercent)}</p></div>
    </div>
    <p className="mt-3 text-xs text-slate-500">個別の条件は複数重なります。件数を合計してはいけません。20件未満は特に不確かなので注意表示します。</p>
    <div className="mt-2 max-h-[420px] overflow-auto">
      <table className="w-full min-w-[590px] text-left text-xs">
        <thead><tr className="bg-slate-100"><th className="p-2">特徴（単独・2条件）</th><th className="p-2">取引</th><th className="p-2">大損率</th><th className="p-2">勝率</th><th className="p-2">平均利益率</th></tr></thead>
        <tbody>{current.factors.map(x)=><tr key={x.id} className="border-t">
          <td className="p-2 font-bold">{x.label}{x.warning&&<span className="block text-[10px] text-amber-700">{x.warning}</span>}</td>
          <td className="p-2">{x.metrics.count}</td><td className="p-2">{pct(x.metrics.bigLossPercent)}</td>
          <td className="p-2">{pct(x.metrics.winPercent)}</td><td className="p-2">{signed(x.metrics.avgPercent)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <details className="mt-3 rounded-xl border p-3">
      <summary className="cursor-pointer text-sm font-bold">📅 前半・後半で同じ条件を照合</summary>
      {(["TRAIN","TEST"] as const).map(p=><div className="mt-3" key={p}>
        <p className="text-sm font-bold">{p==="TRAIN"?"前半：2025年9月までの決済":"後半：2025年10月以降の購入"}／{phases[p].total.count}件</p>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full min-w-[530px] text-left text-xs">
            <thead><tr className="bg-slate-100"><th className="p-2">条件</th><th className="p-2">件数</th><th className="p-2">大損率</th><th className="p-2">勝率</th></tr></thead>
            <tbody>{phases[p].factors.map(x=><tr className="border-t" key={x.id}><td className="p-2">{x.label}</td><td className="p-2">{x.metrics.count}</td><td className="p-2">{pct(x.metrics.bigLossPercent)}</td><td className="p-2">{pct(x.metrics.winPercent)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>)}
    </details>
    <details className="mt-3 rounded-xl border p-3">
      <summary className="cursor-pointer text-sm font-bold">📉 中リスクの大損事例（最大12件）</summary>
      <div className="mt-2 space-y-2">{current.topLosses.map(x=><div key={x.code+x.signalTime} className="rounded-lg bg-slate-50 p-3 text-xs">
        <Link href={"/chart/"+x.code} className="font-bold text-blue-600">{x.code} ↗</Link> ③ {day(x.signalTime)} ／ <strong className="text-rose-700">{signed(x.returnPercent)}</strong>
        <p className="mt-1 text-slate-500">{x.matched.join("／")||"5条件に該当なし"}</p>
      </div>)}</div>
    </details>
    <p className="mt-3 text-xs leading-6 text-slate-500">比較対象は中リスクの中でスコア・損益がともに計算可能な取引だけ。
      過去の結果を見て始めた探索研究であり、前半・後半は真の未使用データではありません。配点変更・本番AIへの採用はしません。</p>
  </details>;
}
