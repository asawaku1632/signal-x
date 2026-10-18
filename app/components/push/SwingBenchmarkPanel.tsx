"use client";

import { useState } from "react";

type Gate = {key:string;label:string;current:number;required:number;passed:boolean;unit?:"%"};
type RiskGroup = {
 key:string;label:string;count:number;observed:number;
 lossAfter5Rate:number|null;closingDrop3Rate:number|null;
 sufficientForDescription:boolean;
};
type Week = {
 weekStart:string;count:number;predictionDays:number;
 meanReturn:number|null;medianReturn:number|null;
 marketAverage:number|null;averageExcess:number|null;
 worstSavedCloseDrop:number|null;riskCoverage:number;
};
type Report = {
 settled:number;predictionDays:number;predictionWeeks:number;
 riseRate:number|null;meanReturn:number|null;medianReturn:number|null;trimmedMeanReturn:number|null;
 marketAverage:number|null;meanExcess:number|null;medianExcess:number|null;
 robustMeanExcess:number|null; comparableWeeks:number;positiveExcessWeeks:number;
 positiveExcessWeekRate:number|null; riskGroups:RiskGroup[];
 trustReviewStatus:"EVIDENCE_COLLECTING"|"MANUAL_REVIEW_REQUIRED";
 marketComparable:number;worstFiveDayReturn:number|null;largestSavedCloseDrop:number|null;
 touchedMinusThreeRate:number|null;riskComparable:number;outliersOverFiftyPercent:number;
 gates:Gate[];gatesPassed:boolean;deliveryEnabled:false;automaticNotificationRelease:false;
 weekly:Week[];notes:string[];
};
function pct(value:number|null) {
 return value===null ? "—" : `${value>=0?"+":""}${value.toFixed(2)}%`;
}

export default function SwingBenchmarkPanel(){
 const [open,setOpen]=useState(false);
 const [loading,setLoading]=useState(false);
 const [data,setData]=useState<Report|null>(null);
 const [error,setError]=useState("");

 async function load(){
  setLoading(true);setError("");
  try{
   const response=await fetch("/api/push/swing-benchmark",{cache:"no-store"});
   if(!response.ok){setError(response.status===404?"この詳細は管理者専用です。":"比較データを取得できませんでした。");return;}
   const result=await response.json() as Report & {success?:boolean};
   if(!result.success||!Array.isArray(result.gates)||!Array.isArray(result.weekly))throw new Error("Invalid report");
   setData(result);
  }catch{setError("比較データを取得できませんでした。時間をおいて再度お試しください。");}
  finally{setLoading(false);}
 }

 function toggle(){
  if(!open&&!data&&!loading)void load();
  setOpen(!open);
 }

 return (
  <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3">
    <button type="button" onClick={toggle} aria-expanded={open}
      className="flex w-full items-center justify-between gap-3 text-left">
      <span className="text-sm font-black text-slate-900">📈 スイング候補・詳細比較</span>
      <span className="shrink-0 text-xs font-black text-blue-700">{open?"閉じる ▲":"確認する ▼"}</span>
    </button>
    {open && <div className="mt-3 space-y-3">
      <p className="text-xs leading-5 text-slate-600">
        5営業日後まで結果がある候補だけを市場全体と比較。予測週ごとの成績と保存終値ベースの途中下落も確認します。
      </p>
      {loading&&<p className="text-xs text-slate-600" role="status">保存データを照合しています…</p>}
      {error&&<p className="text-xs font-bold text-amber-800" role="status">{error}</p>}
      {data&&<>
       <div className="rounded-xl border border-slate-200 bg-white p-3">
         <div className="flex items-center justify-between gap-2">
           <h4 className="text-sm font-black text-slate-900">🔎 信頼性の自動評価</h4>
           <span className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
             {data.trustReviewStatus === "MANUAL_REVIEW_REQUIRED" ? "定量条件クリア・人の審査待ち" : "実績を蓄積中"}
           </span>
         </div>
         <p className="mt-2 text-xs leading-5 text-slate-600">
           検証基準 {data.gates.filter(g=>g.passed).length}/{data.gates.length}項目達成。
           値動きの偏りや予測の独立性も確認するため、基準を満たしても通知は自動解禁しません。
         </p>
         <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-700">
           <div>市場平均を超えた週
             <p className="mt-1 text-base font-black">{data.positiveExcessWeeks}/{data.comparableWeeks}週</p>
           </div>
           <div>外れ値を抑えた市場超過平均
             <p className="mt-1 text-base font-black">{pct(data.robustMeanExcess)}</p>
           </div>
         </div>
         {data.outliersOverFiftyPercent>0 && <p className="mt-2 text-xs leading-5 font-bold text-amber-800">
           50%以上の極端な値動きが{data.outliersOverFiftyPercent}件あります。株式分割や価格補正も含め、人による確認が必要です。
         </p>}
       </div>
       <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-700">
          <div>候補5日後の平均 <p className="mt-1 text-lg font-black">{pct(data.meanReturn)}</p></div>
          <div>同期間の全銘柄平均 <p className="mt-1 text-lg font-black">{pct(data.marketAverage)}</p></div>
          <div>市場平均との差 <p className="mt-1 text-lg font-black">{pct(data.meanExcess)}</p></div>
          <div>候補の中央値 <p className="mt-1 text-lg font-black">{pct(data.medianReturn)}</p></div>
          <div>上下10%除外平均 <p className="mt-1 text-base font-black">{pct(data.trimmedMeanReturn)}</p></div>
          <div>市場平均との差の中央値 <p className="mt-1 text-base font-black">{pct(data.medianExcess)}</p></div>
          <div>最も大きい5日後の損失 <p className="mt-1 text-base font-black">{pct(data.worstFiveDayReturn)}</p></div>
          <div>途中の最大下落（保存終値）<p className="mt-1 text-base font-black">{pct(data.largestSavedCloseDrop)}</p></div>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          途中に−3%以上下落した割合：
          <b>{data.touchedMinusThreeRate===null?"—":data.touchedMinusThreeRate.toFixed(1)+"%"}</b>
          （途中5営業日の価格がそろった{data.riskComparable}件）
        </p>
        <p className="mt-1 text-xs text-slate-600">
          50%以上の極端な騰落：<b>{data.outliersOverFiftyPercent}件</b>（統計から勝手には除外しません）
        </p>
       </div>
       <div className="rounded-xl border border-slate-200 bg-white p-3">
        <h4 className="text-sm font-black text-slate-900">通知解禁に必要な検証量</h4>
        <p className="mt-1 text-xs text-slate-600">
          {data.gates.filter(g=>g.passed).length}/{data.gates.length}条件達成。
          全部満たしても自動的には配信しません。
        </p>
        <div className="mt-2 space-y-2">
          {data.gates.map(g=><div key={g.key} className="flex justify-between gap-3 text-xs">
            <span className="text-slate-700">{g.passed?"✓":"◯"} {g.label}</span>
            <b className={g.passed?"text-emerald-700":"text-slate-600"}>
              {g.current}{g.unit??""} / {g.required}{g.unit??""}
            </b>
          </div>)}
        </div>
       </div>
       <div className="rounded-xl border border-slate-200 bg-white p-3">
         <h4 className="text-sm font-black text-slate-900">⚠️ AI評価・予測時株価別の下落リスク</h4>
         <p className="mt-1 text-xs text-slate-500">5日後の下落率と途中−3%以上下落した割合。十分な予測日が集まるまで目安として表示します。</p>
         <div className="mt-3 space-y-2">
           {data.riskGroups.map(g=><div key={g.key} className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
             <p className="font-black">{g.label}（{g.count}件）</p>
             <p className="mt-1">5日後に下落：{g.lossAfter5Rate===null?"—":g.lossAfter5Rate.toFixed(1)+"%"} ／
               途中−3%：{g.closingDrop3Rate===null?"—":g.closingDrop3Rate.toFixed(1)+"%"}</p>
             {!g.sufficientForDescription&&<p className="mt-1 text-amber-800">検証日または件数が不足・結論は保留</p>}
           </div>)}
         </div>
       </div>
       <div className="rounded-xl border border-slate-200 bg-white p-3">
        <h4 className="text-sm font-black text-slate-900">予測週ごとの5日後成績</h4>
        {data.weekly.length===0?<p className="mt-2 text-xs text-slate-600">まだ5日後の結果がありません。</p>:
        <div className="mt-2 space-y-2">
         {data.weekly.map(w=><div key={w.weekStart} className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
           <p className="font-black">{w.weekStart} の週・{w.count}件（予測{w.predictionDays}日）</p>
           <p className="mt-1">候補平均 {pct(w.meanReturn)} ／ 全銘柄平均 {pct(w.marketAverage)}</p>
           <p>市場との差 {pct(w.averageExcess)} ／ 中央値 {pct(w.medianReturn)}</p>
           <p>途中最大下落 {pct(w.worstSavedCloseDrop)}（確認{w.riskCoverage}件）</p>
         </div>)}
        </div>}
       </div>
       <div className="space-y-1">
        {data.notes.map(note=><p key={note} className="text-[11px] leading-5 text-slate-600">・{note}</p>)}
       </div>
       <button type="button" onClick={()=>void load()} disabled={loading}
         className="rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50">
         最新データで再比較
       </button>
      </>}
    </div>}
  </div>
 );
}
