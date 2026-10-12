"use client";
import { useEffect, useMemo, useState } from "react";
import type { ReboundCandle, ReboundOpportunity } from "@/app/lib/supportReboundResearch";
import {
  REBOUND_LOCAL_STORAGE_KEY, beginReboundForward, reconcileReboundForward, readForwardLocal,
} from "@/app/lib/research/supportReboundForwardLocal";
import type { ForwardLocalStore } from "@/app/lib/research/supportReboundForwardLocal";

type Study={code:string;candles:ReboundCandle[];splitEvents:number[];result:{opportunities:ReboundOpportunity[]}};
const fmt=(v:number)=>v.toLocaleString("ja-JP",{maximumFractionDigits:2});
const pct=(v:number|null)=>v===null?"—":(v>0?"+":"")+fmt(v)+"%";
const day=(t:number)=>new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(t*1000));
export default function SupportReboundForwardLocalPanel({studies,busy,completed,expected}:{
  studies:Study[];busy:boolean;completed:number;expected:number;
}){
  const [saved,setSaved]=useState<ForwardLocalStore|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [warning,setWarning]=useState("");
  useEffect(()=>{
    try{setSaved(readForwardLocal(localStorage.getItem(REBOUND_LOCAL_STORAGE_KEY)));}
    catch{setWarning("このブラウザでは端末内保存が使えません。");}
    setLoaded(true);
  },[]);
  const inputs=useMemo(()=>studies.map(s=>({code:s.code,candles:s.candles,splitEvents:s.splitEvents})),[studies]);
  useEffect(()=>{
    if(!loaded||!saved||busy||completed!==expected||studies.length===0)return;
    const updated=reconcileReboundForward(saved,inputs);
    if(JSON.stringify(updated)===JSON.stringify(saved))return;
    try{
      localStorage.setItem(REBOUND_LOCAL_STORAGE_KEY,JSON.stringify(updated));
      setSaved(updated);
    }catch{setWarning("端末内保存に失敗しました。容量やプライベートモードを確認してください。");}
  },[loaded,saved,busy,completed,expected,studies.length,inputs]);
  const closed=saved?.signals.filter(s=>s.status==="CLOSED")??[];
  const pending=saved?.signals.filter(s=>s.status==="PENDING"||s.status==="OPEN")??[];
  const review=saved?.signals.filter(s=>s.status==="REVIEW")??[];
  const n=closed.length, wins=closed.filter(s=>s.returnPercent!==null&&s.returnPercent>0).length;
  const severe=closed.filter(s=>(s.returnPercent??0)<=-5).length;
  function begin(){
    if(busy||completed!==expected||studies.length===0){setWarning("銘柄の取得が完了してから開始してください。");return;}
    const next=beginReboundForward(inputs);
    try{localStorage.setItem(REBOUND_LOCAL_STORAGE_KEY,JSON.stringify(next));setSaved(next);setWarning("");}
    catch{setWarning("端末内保存に失敗しました。");}
  }
  function exportRecords(){
    if(!saved)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="signalx_rebound_forward_local_v1.json";link.click();
    URL.revokeObjectURL(url);
  }
  return <details className="mt-4 rounded-xl border border-sky-200 bg-white p-3">
    <summary className="cursor-pointer text-sm font-black">🔒 今後の③を固定保存して、次回の再検証で答え合わせ（端末内）</summary>
    <p className="mt-3 text-xs leading-6 text-slate-600">
      初回開始時点の最後の確定日足を基準に、それより後に見つかった③だけを記録。
      ③のサイン日の点数・終値を保存し、あとから点数を再計算・上書きしません。
      { " " }**完全な自動定期追跡ではありません。**
      このブラウザで再び100銘柄を取得したときに、翌営業日始値で買って5営業日後の始値で売った仮想結果を自動照合します。
      他端末への同期・サーバーDB・Cron・LINEはありません。ブラウザのデータを消すと記録も消えます。
    </p>
    {warning&&<p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{warning}</p>}
    {!loaded&&<p className="mt-3 text-xs">端末内の記録を確認中…</p>}
    {loaded&&!saved&&<>
      <button type="button" disabled={busy||completed!==expected||studies.length===0}
        onClick={begin} className="mt-3 min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50">
        この端末で今後の③の記録を開始
      </button>
      <p className="mt-2 text-xs text-slate-500">過去849件は追跡対象に追加しません。初回は基準日時のみ固定し、新しい③が出るまで0件なのが正常です。</p>
    </>}
    {saved&&<>
      <p className="mt-3 text-xs font-bold text-sky-700">端末内の前向き記録：有効 ／ 観測対象 {Object.keys(saved.baselineByCode).length}銘柄</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs">保存サイン</p><p className="text-xl font-black">{saved.signals.length}件</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs">結果確定</p><p className="text-xl font-black">{n}件</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs">結果待ち</p><p className="text-xl font-black">{pending.length}件</p></div>
        <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs">要確認</p><p className="text-xl font-black">{review.length}件</p></div>
      </div>
      <p className="mt-2 text-xs">確定分の勝率 {n?fmt(100*wins/n)+"%":"—"} ／ 大損率 {n?fmt(100*severe/n)+"%":"—"} ／ 平均騰落 {n?pct(closed.reduce((a,s)=>a+(s.returnPercent??0),0)/n):"—"}</p>
      <p className="mt-2 text-xs text-slate-500">サインを見逃さないには各取引日の確定後に同じブラウザで再検証が必要です。訪問間に過去となった未観測サインは未来試験に加えません。</p>
      <div className="mt-3 max-h-72 space-y-2 overflow-auto">{[...saved.signals].reverse().slice(0,30).map(s=><div className="rounded-lg bg-slate-50 p-3 text-xs" key={s.code+":"+s.signalTime}>
        <strong>{s.code}</strong> ／ ③ {day(s.signalTime)} ／ {s.score===null?"算出不可":s.score+"点"}
        <p className="mt-1">{s.status==="CLOSED"?"確定 "+pct(s.returnPercent):s.status==="OPEN"?"保有中（仮想）":s.status==="REVIEW"?"データ再確認："+s.reason:"翌営業日の始値待ち"}</p>
      </div>)}</div>
      <button type="button" onClick={exportRecords} className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-bold text-sky-800">記録をJSONでバックアップ</button>
      <p className="mt-2 text-xs text-slate-500">未来検証の本格的な無人自動化（サーバー保存・定時ジョブ）は、運用費用とデータ品質を確認してから別途有効化する段階です。</p>
    </>}
  </details>;
}
