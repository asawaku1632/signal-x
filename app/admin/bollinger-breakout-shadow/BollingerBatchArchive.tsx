"use client";
import {useEffect,useState} from "react";
const BATCHES=[
  {label:"① 最初の5銘柄",codes:"9984・3762・7203・8035・8306"},
  {label:"② 次の5銘柄",codes:"6758・6501・9983・8058・7974"},
  {label:"③ 次の5銘柄",codes:"9432・6861・4502・9020・5401"},
  {label:"④ 最後の5銘柄",codes:"6098・9101・7011・8001・6367"}
] as const;
type Horizon={sampleCount:number;status:string;positiveRate:number|null;
  meanReturnPercent:number|null;meanMaxAdversePercent:number|null;nextDayReturnInsideRate:number|null};
type Progress={stats:Record<string,{horizons:Record<string,Horizon>}>;
  attempts:Array<{batch_id:number;target_date:string;status:string;new_outcomes:number}>};
type RunResult={success:boolean;status:string;targetDate?:string;batch?:number;
  newOutcomes?:number;reason?:string;progress?:Progress;
  quality?:Array<{code:string;ok:boolean;reason:string|null;events:number}>};
function pct(n:number|null,multiply=false){
  return n===null?"30件未満のため非表示":((multiply?n*100:n).toFixed(2)+"%");
}
export default function BollingerBatchArchive(){
  const [progress,setProgress]=useState<Progress|null>(null);
  const [batch,setBatch]=useState(0);
  const [busy,setBusy]=useState(false);
  const [answer,setAnswer]=useState<RunResult|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    fetch("/api/admin/bollinger-breakout-shadow/batches",{cache:"no-store"})
      .then(r=>r.ok?r.json():Promise.reject(Error("READ_FAILED")))
      .then(data=>setProgress(data.progress))
      .catch(()=>setError("保存履歴を確認できませんでした。"));
  },[]);
  const run=async()=>{
    if(busy)return;
    setBusy(true);setAnswer(null);setError("");
    try{
      const r=await fetch("/api/admin/bollinger-breakout-shadow/batches",{
        method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({batch})});
      const data=await r.json() as RunResult;
      if(data.progress)setProgress(data.progress);
      setAnswer(data);
      if(!r.ok)setError(data.reason??"一部のデータを確認できず、保存は行っていません。");
    }catch{setError("通信エラー。保存状態は履歴で確認してください。");}
    finally{setBusy(false);}
  };
  return <section className="rounded-2xl border border-indigo-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">STAGE 2 / 手動・保存型の隔離研究</p>
    <h2 className="mt-2 text-xl font-black">20銘柄へ研究を拡大</h2>
    <p className="mt-2 text-sm leading-6">5銘柄ずつ確定日足を検証し、評価済みの結果だけを専用DBへ重複なく保存。1つの組につき同じ確定日に実行できるのは1回だけです。前の画面の2銘柄検証とは別に保存されます。</p>
    <label className="mt-4 block text-sm font-bold" htmlFor="bb-study-batch">今回の対象</label>
    <select id="bb-study-batch" value={batch} disabled={busy}
      onChange={e=>setBatch(Number(e.target.value))}
      className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:bg-slate-800 dark:text-white">
      {BATCHES.map((b,i)=><option value={i} key={b.label}>{b.label}（{b.codes}）</option>)}
    </select>
    <button disabled={busy} onClick={run}
      className="mt-3 w-full rounded-xl bg-indigo-700 px-4 py-3 font-black text-white disabled:opacity-50">
      {busy?"検証・保存中…":"選択した5銘柄を検証して保存"}
    </button>
    {error&&<p className="mt-3 text-sm text-rose-600">{error}</p>}
    {answer&&<div className="mt-3 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
      <p className="font-black">結果：{answer.status}</p>
      {answer.targetDate&&<p>確定日：{answer.targetDate}</p>}
      {answer.newOutcomes!==undefined&&<p>今回、新規保存した期間別結果：{answer.newOutcomes}件</p>}
      {answer.quality?.map(q=><p key={q.code}>
        {q.code}：{q.ok?"品質合格":"品質NG "+q.reason} ／ 検出{q.events}件
      </p>)}
      <p className="mt-1 text-xs">ALREADY_CLAIMED は同じ確定日の処理済みを示し、再取得しません。</p>
    </div>}
    <div className="mt-5 space-y-3">
      <h3 className="font-black">蓄積した比較成績（重複排除）</h3>
      {[["SQUEEZE_UP_BREAKOUT","スクイーズ後"],["OTHER_UP_BREAKOUT","通常の上抜け"]].map(([key,label])=>{
        const group=progress?.stats?.[key];
        return <div key={key} className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
          <p className="font-black">{label}</p>
          {[1,3,5].map(h=>{
            const v=group?.horizons?.[String(h)];
            return <p className="mt-2" key={h}>
              {h}営業日後：{v?.sampleCount??0}件 ／ プラス割合 {pct(v?.positiveRate??null,true)}
              <span className="block text-xs">平均損益 {pct(v?.meanReturnPercent??null)} ／ 平均最大下落 {pct(v?.meanMaxAdversePercent??null)}</span>
            </p>;
          })}
        </div>;
      })}
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-500">これは2026年以降の日足による過去検証です。対象20銘柄は固定した研究用の選抜であり、市場全体を代表しません。保存した件数は勝利数ではなく、1・3・5日後の評価数です。AI POWER・売買判定・通知・Cronは変更しません。</p>
    {progress&&<details className="mt-3 text-sm"><summary className="cursor-pointer font-bold">実行履歴を見る</summary>
      <div className="mt-2 space-y-1">
        {progress.attempts.map(a=><p key={a.batch_id+":"+a.target_date}>
          {a.target_date}／第{a.batch_id+1}組：{a.status}・新規{a.new_outcomes}件
        </p>)}
      </div>
    </details>}
  </section>;
}
