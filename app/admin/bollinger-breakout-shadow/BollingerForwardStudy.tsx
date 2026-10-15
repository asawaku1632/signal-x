"use client";
import {useEffect,useState} from "react";
type Summary={group:string;horizon:number;n:number;winRate:number|null;
 meanReturn:number|null;meanAdverse:number|null};
type Run={trade_date:string;batch_id:number;status:string;observed_count:number;
 failed_count:number;new_signals:number;outcome_rows:number};
type Report={enabled:boolean;activationDate:string|null;version:string;
 coverage:{signals:number;completed:number;halts:number;failed:number;
  sampledStocksPerTradingDay:number;fixedUniverse:number};
 runs:Run[];results:Summary[]};
const percent=(n:number|null,fraction=false)=>n===null?"標本不足":
 (n*(fraction?100:1)).toFixed(2)+"%";
export default function BollingerForwardStudy(){
 const [report,setReport]=useState<Report|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const load=async()=>{
  const r=await fetch("/api/admin/bollinger-breakout-shadow/forward",{cache:"no-store"});
  const json=await r.json() as {success:boolean;report?:Report};
  if(!r.ok||!json.success||!json.report)throw Error("STATUS_UNAVAILABLE");
  setReport(json.report);
 };
 useEffect(()=>{void load().catch(()=>setError("将来研究の状態を確認できませんでした。"));},[]);
 const change=async(enabled:boolean)=>{
  if(busy)return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/admin/bollinger-breakout-shadow/forward",{
    method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({enabled})});
   const json=await r.json() as {success:boolean;report?:Report};
   if(!r.ok||!json.success||!json.report)throw Error("CONTROL_UNAVAILABLE");
   setReport(json.report);
  }catch{setError("設定が反映できませんでした。もう一度状態を確認してください。");}
  finally{setBusy(false);}
 };
 return <section className="rounded-2xl border border-indigo-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
  <p className="text-xs font-black text-indigo-700">STAGE 7 / 将来検証専用・独立研究</p>
  <h2 className="mt-2 text-xl font-black">📅 明日以降の上抜けを自動記録</h2>
  <p className="mt-2 text-sm leading-6">過去の1,424件とは別に、これから発生するシグナルだけを保存します。固定した100銘柄を、1営業日20銘柄ずつ巡回。前日の情報を後から「当時の予測」に書き換えません。</p>
  <div className="mt-3 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
   <p className="font-black">自動研究：{!report?"確認中…":report.enabled?"実行待ち・有効":"停止中"}</p>
   {report?.enabled&&<p className="mt-1">記録開始日：{report.activationDate}（引け後17:30ごろ）</p>}
   <p className="mt-2 text-xs text-slate-500">1日20銘柄を観測。前日に保存したシグナルの1・3・5営業日後は、別途最大10銘柄まで評価します。</p>
  </div>
  {report&&<button disabled={busy} onClick={()=>void change(!report.enabled)}
   className={"mt-3 w-full rounded-xl px-4 py-3 font-black text-white disabled:opacity-50 "+
    (report.enabled?"bg-slate-600":"bg-indigo-700")}>
    {busy?"設定中…":report.enabled?"自動研究を停止":"次の取引日から自動研究を開始"}
  </button>}
  {error&&<p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
   <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
    <p className="text-xs text-slate-500">将来シグナル（凍結保存）</p>
    <p className="text-xl font-black">{report?.coverage.signals??"—"}件</p>
   </div>
   <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
    <p className="text-xs text-slate-500">評価済み（期間別）</p>
    <p className="text-xl font-black">{report?.coverage.completed??"—"}件</p>
   </div>
  </div>
  {report&&<p className="mt-2 text-xs text-slate-500">データ品質・取得失敗 {report.coverage.failed}件／元データ修正で停止 {report.coverage.halts}件。見送った営業日のシグナルは後から補充しません。</p>}
  <details className="mt-4">
   <summary className="cursor-pointer text-sm font-black">将来研究の成績（30件以上で表示）</summary>
   {(["SQUEEZE_UP_BREAKOUT","OTHER_UP_BREAKOUT"] as const).map(group=>
    <div key={group} className="mt-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
     <p className="font-bold">{group==="SQUEEZE_UP_BREAKOUT"?"スクイーズ後":"通常の上抜け"}</p>
     {[1,3,5].map(h=>{
      const s=report?.results.find(x=>x.group===group&&x.horizon===h);
      return <p key={h} className="mt-2 text-xs leading-5">
       {h}営業日後：{s?.n??0}件 ／ プラス割合 {percent(s?.winRate??null,true)}
       <span className="block">平均損益 {percent(s?.meanReturn??null)} ／ 平均最大下落 {percent(s?.meanAdverse??null)}</span>
      </p>;
     })}
    </div>)}
  </details>
  <details className="mt-3">
   <summary className="cursor-pointer text-sm font-bold">直近の自動研究実行履歴</summary>
   {!report?.runs.length&&<p className="mt-2 text-xs">まだ自動研究は実行されていません。</p>}
   {report?.runs.map(r=><p key={r.trade_date+":"+r.batch_id} className="mt-2 text-xs">
    {r.trade_date}：{r.status}／観測 {r.observed_count}/20 ／ 取得失敗 {r.failed_count} ／ 新規シグナル {r.new_signals}件 ／ 評価 {r.outcome_rows}件
   </p>)}
  </details>
  <p className="mt-4 text-xs leading-5 text-slate-500">
   自動研究を開始するボタンを押すまでは株価の追加取得はありません。価格取得・データベースへの書き込みは研究専用で、既存の買い判定・AI POWER・LINE通知・紙上取引には一切反映しません。観測できた20銘柄のみがその日の対象で、100銘柄すべてを毎日観測した研究ではありません。
  </p>
 </section>;
}
