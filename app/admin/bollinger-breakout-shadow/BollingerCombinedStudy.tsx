"use client";
import {useEffect,useState} from "react";

type Period="ALL"|"EARLY"|"LATE";
type Group="SQUEEZE_UP_BREAKOUT"|"OTHER_UP_BREAKOUT";
type Rule={id:string;name:string};
type Summary={
 group:Group;horizon:number;rule:string;period:Period;
 count:number;uniqueStocks:number;wins:number;qualified:boolean;
 positiveRate:number|null;meanReturnPercent:number|null;
 medianReturnPercent:number|null;meanAdversePercent:number|null;
};
type Study={
 version:string;coverage:{outcomes:number;signals:number;stocks:number;
  baseOutcomes:number;expansionOutcomes:number;verifiedBaseVolume:number;
  embargoEvents:number;split:string};
 rules:Rule[];summaries:Summary[];
 verdict:string;
};
const display=(v:number|null,fraction=false)=>v===null?"標本不足":
 ((fraction?v*100:v).toFixed(2)+"%");
const groups:[Group,string][]=[
 ["SQUEEZE_UP_BREAKOUT","スクイーズ後"],
 ["OTHER_UP_BREAKOUT","通常の上抜け"]
];
export default function BollingerCombinedStudy(){
 const [report,setReport]=useState<Study|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(true);
 const [group,setGroup]=useState<Group>("SQUEEZE_UP_BREAKOUT");
 const [horizon,setHorizon]=useState(5);
 const load=async()=>{
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/admin/bollinger-breakout-shadow/combined",{cache:"no-store"});
   if(!response.ok)throw Error("READ_FAILED");
   const json=await response.json() as {success:boolean;report?:Study};
   if(!json.success||!json.report)throw Error("DATA_UNAVAILABLE");
   setReport(json.report);
  }catch{
   setReport(null);setError("保存済みの研究データを照合できませんでした。既存データは変更していません。");
  }finally{setBusy(false);}
 };
 useEffect(()=>{void load();},[]);
 const item=(rule:string,period:Period)=>
  report?.summaries.find(s=>s.group===group&&s.horizon===horizon&&
    s.rule===rule&&s.period===period);
 const metric=(s:Summary|undefined)=>{
  if(!s)return "未集計";
  if(!s.qualified)return "30件未満のため非表示";
  return "プラス割合 "+display(s.positiveRate,true)+
   " ／ 平均損益 "+display(s.meanReturnPercent);
 };
 return <section className="rounded-2xl border border-indigo-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
  <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">
   STAGE 6 / 追加取得・DB保存なし
  </p>
  <h2 className="mt-2 text-xl font-black">🔬 複合条件 × 時期別の勝ち負け研究</h2>
  <p className="mt-2 text-sm leading-6">
   RSI・直前トレンド・出来高・上抜け幅の組み合わせを、
   既存の保存結果だけで比較します。前半と後半で結果が変わるかも確認します。
  </p>
  {busy&&<p role="status" className="mt-3 text-sm">研究データを照合中…</p>}
  {error&&<div className="mt-3 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
   {error}
   <button onClick={()=>void load()} className="mt-2 block rounded-lg border border-indigo-400 px-3 py-2 font-bold">
    再確認
   </button>
  </div>}
  {report&&<>
   <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
    <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
     <p className="text-xs text-slate-500">結合できたシグナル</p>
     <p className="text-xl font-black">{report.coverage.signals}件</p>
    </div>
    <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
     <p className="text-xs text-slate-500">期間別結果</p>
     <p className="text-xl font-black">{report.coverage.outcomes}件</p>
    </div>
    <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
     <p className="text-xs text-slate-500">対象銘柄</p>
     <p className="text-xl font-black">{report.coverage.stocks}銘柄</p>
    </div>
   </div>
   <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
    <label className="text-sm font-bold">上抜けの種類
     <select value={group} onChange={e=>setGroup(e.target.value as Group)}
      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 dark:bg-slate-800">
      {groups.map(([value,label])=><option value={value} key={value}>{label}</option>)}
     </select>
    </label>
    <label className="text-sm font-bold">評価期間
     <select value={horizon} onChange={e=>setHorizon(Number(e.target.value))}
      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 dark:bg-slate-800">
      <option value={1}>1営業日後</option>
      <option value={3}>3営業日後</option>
      <option value={5}>5営業日後</option>
     </select>
    </label>
   </div>
   <p className="mt-3 text-xs text-slate-500 leading-5">
    前半：2026年8月31日まで ／ 9月1〜7日は評価から除外 ／
    後半：9月8日以降。前半・後半とも同じ条件で集計し、30件未満の数字は隠します。
   </p>
   <div className="mt-4 space-y-3">
    {report.rules.map(rule=>{
     const early=item(rule.id,"EARLY"),late=item(rule.id,"LATE"),all=item(rule.id,"ALL");
     return <div key={rule.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="font-black text-sm">{rule.name}</h3>
      <p className="mt-1 text-xs text-slate-500">比較対象（除外期間を除く）：{all?.count??0}件
       ／ 銘柄数 {all?.uniqueStocks??0}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
       {([["EARLY","前半・条件探索"],["LATE","後半・時期別点検"]] as const).map(([period,label])=>{
        const s=period==="EARLY"?early:late;
        return <div key={period} className="rounded-lg bg-slate-100 p-3 text-xs leading-5 dark:bg-slate-800">
         <p className="font-bold">{label}：{s?.count??0}件</p>
         <p>{metric(s)}</p>
         {s?.qualified&&<>
          <p>中央値 {display(s.medianReturnPercent)} ／ 平均最大下落 {display(s.meanAdversePercent)}</p>
          <p>対象銘柄 {s.uniqueStocks}銘柄</p>
         </>}
        </div>;
       })}
      </div>
     </div>;
    })}
   </div>
   <p className="mt-4 text-xs leading-5 text-slate-500">
    対象は固定した研究用100銘柄で、市場全体の無作為標本ではありません。
    同じ銘柄の複数イベントは相関する可能性があります。
    以前から見ている過去データの時期別比較であり、未公開データを使う厳密な将来予測検証ではありません。
    良好な候補が見つかっても売買判定・AI POWER・通知には自動反映しません。
   </p>
  </>}
 </section>;
}
