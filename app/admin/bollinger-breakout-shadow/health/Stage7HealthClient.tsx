"use client";

import {useEffect,useState} from "react";

type Health={
 success:boolean;studyEnabled?:boolean;activationDate?:string;
 latestRun?:{trade_date?:string;status?:string;observed_count?:number;failed_count?:number}|null;
 recentRuns?:{tradeDate:string;status:string;observedCount:number;failedCount:number}[];
 pendingByHorizon?:Record<string,number>;
 maturity?:{notDue:number;dueAwaitingRun:number;overdue:number;calendarUnknown:number};
 missingTradingRuns?:string[];
 totals?:{signals:number;completedOutcomes:number;failedChecks:number;sourceHalts:number};
 warnings?:string[];error?:string;
};
const num=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v.toLocaleString("ja-JP"):"—";
export default function Stage7HealthClient(){
 const [data,setData]=useState<Health|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 async function refresh(){
  setLoading(true);setError("");
  try{
   const res=await fetch("/api/admin/bollinger-breakout-shadow/forward-health",{cache:"no-store"});
   const json:Health=await res.json();
   if(!res.ok||!json.success)throw Error(json.error||"診断結果を取得できません");
   setData(json);
  }catch(e){setError(e instanceof Error?e.message:"診断結果を取得できません");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 const warnings=data?.warnings??[];
 return <main style={{maxWidth:850,margin:"0 auto",padding:"24px 16px",lineHeight:1.7}}>
  <a href="/admin/bollinger-breakout-shadow">← ボリンジャーバンド研究に戻る</a>
  <h1>STAGE 7 稼働診断</h1>
  <p>管理者専用・読み取り専用。既存の予測・取引・通知には影響しません。</p>
  <button type="button" onClick={()=>void refresh()} disabled={loading} style={{padding:"8px 16px",cursor:"pointer"}}>{loading?"確認中…":"最新状態に更新"}</button>
  {error&&<p role="alert" style={{color:"#d33"}}>取得エラー：{error}</p>}
  {data&&<div>
   <h2>{!data.studyEnabled?"研究停止中":warnings.length?"要確認項目あり":"記録上は正常"}</h2>
   <p>研究開始日：{data.activationDate??"—"} ／ 最新実行：{data.latestRun?.trade_date??"記録なし"}（{data.latestRun?.status??"—"}）</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
    {([["将来シグナル",data.totals?.signals],["評価完了",data.totals?.completedOutcomes],["取得失敗記録",data.totals?.failedChecks],["元データ変更による停止",data.totals?.sourceHalts]] as const).map(([label,value])=>
     <section key={label} style={{border:"1px solid #8886",borderRadius:8,padding:14}}><div>{label}</div><strong style={{fontSize:24}}>{num(value)}</strong></section>)}
   </div>
   <h2>評価待ちの内訳</h2>
   <p>まだ評価日前：{num(data.maturity?.notDue)} ／ 当日処理待ち：{num(data.maturity?.dueAwaitingRun)} ／ 要確認：{num(data.maturity?.overdue)} ／ カレンダー確認：{num(data.maturity?.calendarUnknown)}</p>
   <p>未記録の評価：1営業日後 {num(data.pendingByHorizon?.["1"])}件・3営業日後 {num(data.pendingByHorizon?.["3"])}件・5営業日後 {num(data.pendingByHorizon?.["5"])}件</p>
   <p style={{fontSize:13}}>未記録には正常な評価待ちも含まれます。要確認は直ちに障害を意味しません。</p>
   <h2>実行漏れ候補</h2>
   {data.missingTradingRuns?.length?<p role="status">{data.missingTradingRuns.join("、")}</p>:<p>直近の確認範囲では実行漏れ候補なし</p>}
   <h2>注意事項</h2>
   {warnings.length?<ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul>:<p>現在の診断条件では警告なし</p>}
   <h2>直近の実行履歴</h2>
   <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}>
    <thead><tr><th>営業日</th><th>状態</th><th>観測数</th><th>失敗</th></tr></thead>
    <tbody>{(data.recentRuns??[]).map((r,i)=><tr key={r.tradeDate+"-"+i}><td>{r.tradeDate}</td><td>{r.status}</td><td>{num(r.observedCount)}</td><td>{num(r.failedCount)}</td></tr>)}</tbody>
   </table></div>
  </div>}
 </main>;
}
