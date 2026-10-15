"use client";
import {useCallback,useEffect,useRef,useState} from "react";

type Basket={id:number;codes:string[]};
type Attempt={batch_id:number;target_date:string;status:string;new_factors:number;note:string|null};
type Stat={factor:string;group:string;bucket:string;horizon:number;
 sampleCount:number;positiveRate:number|null;meanReturn:number|null;meanAdverse:number|null};
type Progress={version:string;batches:Basket[];attempts:Attempt[];
 completeCount:number;coverage:{factor_count:number;signal_count:number};stats:Stat[]};
type RunResponse={success:boolean;status:string;batch?:number;targetDate?:string;
 savedFactors?:number;verifiedSignals?:number;reason?:string;progress?:Progress};
const labels:Record<string,string>={
 RSI_70_PLUS:"RSI 70以上",RSI_50_TO_70:"RSI 50〜69.9",RSI_BELOW_50:"RSI 50未満",
 TREND_UP_5_PLUS:"直前10日 +5%以上",TREND_FLAT_TO_5:"直前10日 0〜+5%未満",
 TREND_NEGATIVE:"直前10日 マイナス",
 BREAKOUT_2_PLUS:"＋2σより2%以上上",BREAKOUT_BELOW_2:"＋2σから2%未満上"};
const buckets:Record<string,string[]>={
 RSI:["RSI_70_PLUS","RSI_50_TO_70","RSI_BELOW_50"],
 TREND_10D:["TREND_UP_5_PLUS","TREND_FLAT_TO_5","TREND_NEGATIVE"],
 BREAKOUT_STRENGTH:["BREAKOUT_2_PLUS","BREAKOUT_BELOW_2"]};
const pct=(v:number|null,rate=false)=>v===null?"30件未満":(v*(rate?100:1)).toFixed(2)+"%";
export default function BollingerAsOfFactorResearch(){
 const [progress,setProgress]=useState<Progress|null>(null);
 const [choice,setChoice]=useState(0);
 const [factor,setFactor]=useState("RSI");
 const [group,setGroup]=useState("SQUEEZE_UP_BREAKOUT");
 const [horizon,setHorizon]=useState(5);
 const [busy,setBusy]=useState(false);
 const [running,setRunning]=useState(false);
 const [result,setResult]=useState("");
 const stop=useRef(false);
 const live=useRef(true);
 const reload=useCallback(async()=>{
  const resp=await fetch("/api/admin/bollinger-breakout-shadow/factors",{cache:"no-store"});
  if(!resp.ok)throw Error("STATUS_UNAVAILABLE");
  const json=await resp.json() as {success:boolean;progress:Progress};
  if(!json.success)throw Error("STATUS_UNAVAILABLE");
  if(live.current)setProgress(json.progress);
  return json.progress;
 },[]);
 useEffect(()=>{
  live.current=true;
  reload().catch(()=>setResult("保存状況を読み取れませんでした。"));
  return()=>{live.current=false;stop.current=true;};
 },[reload]);
 const execute=async(id:number)=>{
  const response=await fetch("/api/admin/bollinger-breakout-shadow/factors",{
   method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
   body:JSON.stringify({batch:id})});
  const body=await response.json() as RunResponse;
  if(body.progress&&live.current)setProgress(body.progress);
  if(!response.ok||!body.success)throw Error(body.reason??body.status??"REJECTED");
  if(body.status==="ALREADY_CLAIMED")throw Error("当日処理済みのため再取得しません");
  return body;
 };
 const once=async()=>{
  if(busy)return;
  setBusy(true);setResult("第"+(choice+1)+"組を確認中…");
  try{
   const r=await execute(choice);
   setResult("第"+(choice+1)+"組："+r.status+"／追加"+(r.savedFactors??0)+"件");
  }catch(e){setResult("安全停止："+String(e instanceof Error?e.message:e));}
  finally{if(live.current)setBusy(false);}
 };
 const runAll=async()=>{
  if(busy)return;
  stop.current=false;setRunning(true);setBusy(true);
  try{
   const initial=await reload();
   const finished=new Set(initial.attempts.filter(a=>a.status==="COMPLETED").map(a=>a.batch_id));
   for(const basket of initial.batches){
    if(stop.current||!live.current)break;
    if(finished.has(basket.id))continue;
    setChoice(basket.id);
    setResult("第"+(basket.id+1)+"組／20組：元データと照合中");
    const r=await execute(basket.id);
    if(!["COMPLETED","ALREADY_COMPLETED"].includes(r.status))
      throw Error("NOT_COMPLETED");
    finished.add(basket.id);
    await new Promise(done=>setTimeout(done,1100));
   }
   if(live.current)setResult(stop.current?"停止しました。保存済みの組は次回飛ばせます。":
    "順番に確認を終えました。結果の件数と成績を見てね。");
  }catch(e){
   if(live.current)setResult("品質・通信の問題で安全停止："+String(e instanceof Error?e.message:e));
  }finally{if(live.current){setBusy(false);setRunning(false);}}
 };
 const completed=progress?.completeCount??0;
 const statusOf=(id:number)=>progress?.attempts.find(a=>a.batch_id===id);
 return <section className="rounded-2xl border border-indigo-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
  <p className="text-xs font-black text-indigo-600">STAGE 5 / 研究専用・売買判定への反映なし</p>
  <h2 className="mt-1 text-xl font-black">🔬 勝ち負けの分岐点を研究</h2>
  <p className="mt-2 text-sm leading-6">100銘柄の上抜けを、<strong>RSI・直前10日間のトレンド・＋2σからの上抜け幅</strong>で分類。元の株価履歴と保存済みの指紋が完全一致したシグナルだけ記録するよ。</p>
  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
   <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
    <p className="text-xs text-slate-500">元データ照合済みの組</p>
    <p className="text-xl font-black">{completed} / 20組</p>
   </div>
   <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
    <p className="text-xs text-slate-500">新しい特徴を保存済み</p>
    <p className="text-xl font-black">{progress?.coverage.factor_count??"—"} / {progress?.coverage.signal_count??"—"}件</p>
   </div>
  </div>
  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
   <div className="h-full bg-indigo-600" style={{width:(completed/20*100)+"%"}}/>
  </div>
  <button disabled={busy||!progress||completed===20} onClick={runAll}
    className="mt-4 w-full rounded-xl bg-indigo-700 p-3 font-black text-white disabled:opacity-50">
    {running?"5銘柄ずつ照合中…":"未完了の組をまとめて安全検証"}
  </button>
  {running&&<button onClick={()=>{stop.current=true;setResult("今の5銘柄を処理後に停止します。");}}
    className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm font-bold dark:border-slate-600">
    次の組へ進まず停止
  </button>}
  <div className="mt-3 flex gap-2">
   <select value={choice} disabled={busy} onChange={e=>setChoice(Number(e.target.value))}
    aria-label="研究する5銘柄組" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:bg-slate-800 dark:text-white">
    {progress?.batches.map(b=><option value={b.id} key={b.id}>
     第{b.id+1}組 {b.codes.join("・")} {statusOf(b.id)?.status==="COMPLETED"?"✅":""}
    </option>)}
   </select>
   <button onClick={once} disabled={busy||!progress||statusOf(choice)?.status==="COMPLETED"}
     className="rounded-lg border border-indigo-400 px-3 text-sm font-bold disabled:opacity-40">
    1組検証
   </button>
  </div>
  {result&&<p role="status" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">{result}</p>}
  <details className="mt-4">
   <summary className="cursor-pointer font-bold">条件別の実績を比較する</summary>
   <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
    <label className="text-sm">調べる条件
     <select value={factor} onChange={e=>setFactor(e.target.value)}
       className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-800">
      <option value="RSI">RSI14</option>
      <option value="TREND_10D">直前10日の値動き</option>
      <option value="BREAKOUT_STRENGTH">上抜け幅</option>
     </select>
    </label>
    <label className="text-sm">上抜けの種類
     <select value={group} onChange={e=>setGroup(e.target.value)}
       className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-800">
      <option value="SQUEEZE_UP_BREAKOUT">スクイーズ後</option>
      <option value="OTHER_UP_BREAKOUT">通常の上抜け</option>
     </select>
    </label>
    <label className="text-sm">評価期間
     <select value={horizon} onChange={e=>setHorizon(Number(e.target.value))}
       className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-800">
      <option value={1}>1営業日後</option><option value={3}>3営業日後</option>
      <option value={5}>5営業日後</option>
     </select>
    </label>
   </div>
   {buckets[factor].map(bucket=>{
    const s=progress?.stats.find(s=>s.factor===factor&&s.group===group&&
      s.horizon===horizon&&s.bucket===bucket);
    return <div key={bucket} className="mt-2 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
     <p className="font-black">{labels[bucket]}</p>
     <p className="mt-1">評価済み {s?.sampleCount??0}件 ／ プラス割合 {pct(s?.positiveRate??null,true)}</p>
     <p>平均損益 {pct(s?.meanReturn??null)} ／ 平均最大下落 {pct(s?.meanAdverse??null)}</p>
    </div>;
   })}
  </details>
  <p className="mt-3 text-xs leading-5 text-slate-500">RSIは直近14営業日の単純平均方式。指標は上抜け日の引け後に確定し、翌営業日の始値で買えたと仮定した過去検証です。30件未満は勝率を隠します。最も成績の良い区分を探すだけでは過剰適合になるため、売買条件への採用には別期間の検証が必要です。画面を閉じると連続実行は止まります。</p>
 </section>;
}
