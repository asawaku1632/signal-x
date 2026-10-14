"use client";
import {useEffect,useState} from "react";

type Stat={group:string;volumeBucket:string;horizon:number;n:number;eligible:boolean;
  positiveRate:number|null;averageReturn:number|null;averageAdverse:number|null};
type Progress={statistics:Stat[];coverage:{observed_events:number;eligible_events:number};
  attempts:Array<{batch_id:number;target_date:string;status:string;saved_count:number}>};
type Response={status:string;success:boolean;reason?:string;verified?:number;
  inserted?:number;targetDate?:string;progress?:Progress};
const CODE_GROUPS=[
 "① 9984・3762・7203・8035・8306",
 "② 6758・6501・9983・8058・7974",
 "③ 9432・6861・4502・9020・5401",
 "④ 6098・9101・7011・8001・6367"
];
const groupNames=[
 ["SQUEEZE_UP_BREAKOUT","スクイーズ後"],
 ["OTHER_UP_BREAKOUT","通常の上抜け"]
] as const;
const volumeNames=[
 ["HIGH_1_3X","出来高1.3倍以上"],
 ["BELOW_1_3X","出来高1.3倍未満"],
 ["UNKNOWN","出来高不明"]
] as const;
const rate=(n:number|null,multiplier=1)=>n===null?"30件未満":(n*multiplier).toFixed(2)+"%";
export default function BollingerVolumeResearch(){
 const [p,setP]=useState<Progress|null>(null);
 const [batch,setBatch]=useState(0);
 const [busy,setBusy]=useState(false);
 const [answer,setAnswer]=useState<Response|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{
  fetch("/api/admin/bollinger-breakout-shadow/volume",{cache:"no-store"})
   .then(r=>{if(!r.ok)throw Error("DATA_UNAVAILABLE");return r.json();})
   .then(d=>setP(d.progress as Progress))
   .catch(()=>setError("出来高の保存状態を取得できませんでした。"));
 },[]);
 const run=async()=>{
  if(busy)return;setBusy(true);setAnswer(null);setError("");
  try{
   const r=await fetch("/api/admin/bollinger-breakout-shadow/volume",{
    method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({batch})
   });
   const json=await r.json() as Response;
   if(json.progress)setP(json.progress);
   setAnswer(json);
   if(!r.ok)setError(json.reason??"元データとの一致確認で停止しました。");
  }catch{setError("通信できませんでした。実行履歴を確認してね。");}
  finally{setBusy(false);}
 };
 return <section className="rounded-2xl border border-indigo-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
  <p className="text-xs font-black text-indigo-600">STAGE 3 / 元データ一致確認つき</p>
  <h2 className="mt-1 text-xl font-black">📊 ボリンジャーバンド × 出来高</h2>
  <p className="mt-2 text-sm leading-6">既に保存した上抜けの当日出来高を、過去20営業日の平均と比較します。
    元の保存価格データが一致しない場合は、結果を保存しません。
    1組5銘柄まで・手動のみ・重複排除で、売買判定は変えません。</p>
  <div className="mt-3 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
   出来高を確認済み：<strong>{p?.coverage?.observed_events??"—"}件</strong>
   ／ 上抜けイベント：{p?.coverage?.eligible_events??"—"}件
  </div>
  <select aria-label="出来高研究の銘柄組" disabled={busy} value={batch}
    onChange={e=>setBatch(Number(e.target.value))}
    className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:bg-slate-800">
    {CODE_GROUPS.map((item,i)=><option value={i} key={i}>{item}</option>)}
  </select>
  <button onClick={run} disabled={busy}
    className="mt-3 w-full rounded-xl bg-indigo-700 px-4 py-3 font-black text-white disabled:opacity-50">
    {busy?"元データと照合中…":"選択した5銘柄の出来高を検証・保存"}
  </button>
  {answer&&<div className="mt-3 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
    <p className="font-bold">結果：{answer.status}</p>
    {answer.targetDate&&<p>対象確定日：{answer.targetDate}</p>}
    {answer.verified!==undefined&&<p>元の株価と一致：{answer.verified}イベント</p>}
    {answer.inserted!==undefined&&<p>今回追加した出来高：{answer.inserted}イベント</p>}
    {answer.reason&&<p>詳細：{answer.reason}</p>}
  </div>}
  {error&&<p className="mt-3 text-sm font-bold text-rose-600">{error}</p>}
  <h3 className="mt-5 text-base font-black">出来高の有無で比較</h3>
  <p className="mt-1 text-xs text-slate-500">上抜けの種類・出来高の条件ごとに30件以上のときだけ成績を表示。</p>
  {groupNames.map(([key,name])=><div key={key} className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <p className="font-black">{name}</p>
    {volumeNames.map(([vol,title])=><div key={vol} className="mt-2 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
      <p className="font-bold">{title}</p>
      {[1,3,5].map(h=>{
       const s=p?.statistics.find(x=>x.group===key&&x.volumeBucket===vol&&x.horizon===h);
       return <p key={h} className="mt-2 text-xs leading-5">{h}営業日後：{s?.n??0}件
         <span className="block">プラス割合：{rate(s?.positiveRate??null,100)}
          ／ 平均損益：{rate(s?.averageReturn??null)}
          ／ 平均最大下落：{rate(s?.averageAdverse??null)}</span>
       </p>;
      })}
    </div>)}
  </div>)}
  <details className="mt-4 text-xs">
    <summary className="cursor-pointer font-bold">出来高研究の実行履歴</summary>
    {p?.attempts.map(a=><p className="mt-2" key={a.batch_id+":"+a.target_date}>
      {a.target_date} 第{a.batch_id+1}組：{a.status}／新規 {a.saved_count}件
    </p>)}
  </details>
  <p className="mt-4 text-xs leading-5 text-slate-500">当日の出来高倍率は引け後に確定するため、同じ日の朝9時に使えたシグナルではありません。翌営業日の始値で仮購入する研究です。
  旧データのAI POWER・9時/11時の実購入価格は補完していません。買い推奨や実資金取引には反映しません。</p>
 </section>;
}
