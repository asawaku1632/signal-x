"use client";
import {useCallback,useEffect,useRef,useState} from "react";

type Basket={batch:number;codes:string[]};
type Attempt={batch_id:number;target_date:string;status:string;saved_outcomes:number;saved_signals:number;note:string|null};
type Stat={group:string;volumeBucket:string;horizon:number;sampleCount:number;
 positiveRate:number|null;averageReturn:number|null;averageAdverse:number|null};
type Progress={
 policy:string;codesTarget:number;batchCount:number;completedBatches:number;
 baskets:Basket[];base:{signals:number;outcomes:number};
 expansion:{signals:number;outcomes:number};attempts:Attempt[];stats:Stat[];
};
type Response={success:boolean;status:string;batch?:number;targetDate?:string;
 reason?:string;newOutcomes?:number;progress?:Progress};
const format=(n:number|null,rate=false)=>n===null?"30件未満":(n*(rate?100:1)).toFixed(2)+"%";
const kinds=[["SQUEEZE_UP_BREAKOUT","スクイーズ後"],["OTHER_UP_BREAKOUT","通常の上抜け"]] as const;
const volumes=[["HIGH_1_3X","出来高1.3倍以上"],["BELOW_1_3X","1.3倍未満"],["UNKNOWN","出来高不明"]] as const;
export default function BollingerExpansionResearch(){
 const [progress,setProgress]=useState<Progress|null>(null);
 const [chosen,setChosen]=useState(4);
 const [mode,setMode]=useState<"idle"|"single"|"continuous">("idle");
 const [message,setMessage]=useState("");
 const [last,setLast]=useState<Response|null>(null);
 const stop=useRef(false);
 const mounted=useRef(true);
 const load=useCallback(async()=>{
  const r=await fetch("/api/admin/bollinger-breakout-shadow/expand",{cache:"no-store"});
  if(!r.ok)throw Error("RESEARCH_PROGRESS_UNAVAILABLE");
  const json=await r.json();
  if(!json?.success||!json.progress)throw Error("RESEARCH_PROGRESS_UNAVAILABLE");
  if(mounted.current)setProgress(json.progress as Progress);
  return json.progress as Progress;
 },[]);
 useEffect(()=>{
  mounted.current=true;
  load().catch(()=>setMessage("進捗を読み込めませんでした。"));
  return ()=>{stop.current=true;mounted.current=false;};
 },[load]);
 const call=async(batch:number)=>{
  const r=await fetch("/api/admin/bollinger-breakout-shadow/expand",{
   method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
   body:JSON.stringify({batch})});
  const v=await r.json() as Response;
  if(v.progress&&mounted.current)setProgress(v.progress);
  if(mounted.current)setLast(v);
  if(!r.ok||!v.success)throw Error(v.reason??v.status??"BATCH_FAILED");
  // A used date with a failed attempt is NOT permission to retry.
  if(v.status==="ALREADY_CLAIMED")throw Error("SAME_DAY_ALREADY_CLAIMED");
  return v;
 };
 const single=async()=>{
  if(mode!=="idle")return;
  setMode("single");setMessage("第"+(chosen-3)+"組を検証中…");setLast(null);
  try{const v=await call(chosen);setMessage("第"+(chosen-3)+"組："+v.status+"（新規"+(v.newOutcomes??0)+"件）");}
  catch(e){setMessage("安全停止："+String(e instanceof Error?e.message:e));}
  finally{if(mounted.current)setMode("idle");}
 };
 const all=async()=>{
  if(mode!=="idle")return;
  stop.current=false;setMode("continuous");setLast(null);
  try{
   const p=await load();
   const done=new Set(p.attempts.filter(a=>a.status==="COMPLETE").map(a=>a.batch_id));
   for(const b of p.baskets){
    if(stop.current||!mounted.current)break;
    if(done.has(b.batch))continue;
    setChosen(b.batch);
    setMessage("第"+(b.batch-3)+"組 / 16組を検証中。途中で止められるよ。");
    const v=await call(b.batch);
    if(v.status==="COMPLETE"||v.status==="ALREADY_COMPLETE")done.add(b.batch);
    else throw Error("NON_COMPLETED_BATCH");
    if(stop.current)break;
    // Polite request pacing; never parallelize groups.
    await new Promise(resolve=>setTimeout(resolve,1100));
   }
   if(mounted.current)setMessage(stop.current?
     "停止しました。保存済みの結果は保持。続きから再開できます。":
     "今回の連続実行が終了！進捗と検証結果を確認してね。");
  }catch(e){
   if(mounted.current)setMessage("品質または通信の問題で連続実行を安全停止："+String(e instanceof Error?e.message:e));
  }finally{if(mounted.current)setMode("idle");}
 };
 const attemptOf=(batch:number)=>progress?.attempts.find(a=>a.batch_id===batch);
 const completed=progress?.completedBatches??0;
 return <section className="rounded-2xl border border-violet-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
  <p className="text-xs font-black text-violet-600">STAGE 4 / 本人専用・手動開始</p>
  <h2 className="mt-1 text-xl font-black">📈 ボリンジャーバンド 100銘柄研究</h2>
  <p className="mt-2 text-sm leading-6">既存20銘柄を残し、さらに80銘柄を追加。1組5銘柄ずつ検証して結果・出来高を別保存し、合計100銘柄の比較を進めます。</p>
  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
   <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
    <p className="text-xs text-slate-500">追加80銘柄の完了組</p>
    <p className="text-xl font-black">{completed}/16組</p>
   </div>
   <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
    <p className="text-xs text-slate-500">新規保存結果</p>
    <p className="text-xl font-black">{progress?.expansion.outcomes??"—"}件</p>
   </div>
  </div>
  <p className="mt-2 text-xs text-slate-500">従来分：{progress?.base.signals??"—"}シグナル・{progress?.base.outcomes??"—"}期間別結果。追加分：{progress?.expansion.signals??"—"}シグナル。</p>
  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
   <div className="h-full rounded-full bg-indigo-600" style={{width:(completed/16*100)+"%"}}/>
  </div>
  <button disabled={mode!=="idle"||!progress||completed===16}
    onClick={all} className="mt-4 w-full rounded-xl bg-indigo-700 p-3 font-black text-white disabled:opacity-50">
    {mode==="continuous"?"5銘柄ずつ連続検証中…":"未完了の組を順番に検証（最大80銘柄）"}
  </button>
  {mode==="continuous"&&<button onClick={()=>{stop.current=true;setMessage("今の5銘柄が終わったら停止します。");}}
   className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-bold dark:border-slate-600">
   次の組へ進まず停止
  </button>}
  <div className="mt-4 flex gap-2">
   <select aria-label="個別の研究組" disabled={mode!=="idle"} value={chosen}
    onChange={e=>setChosen(Number(e.target.value))}
    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:bg-slate-800 dark:text-white">
    {progress?.baskets.map(b=><option value={b.batch} key={b.batch}>
      第{b.batch-3}組 {b.codes.join("・")} {attemptOf(b.batch)?.status==="COMPLETE"?"✅":""}
    </option>)}
   </select>
   <button disabled={mode!=="idle"||!progress||attemptOf(chosen)?.status==="COMPLETE"}
    onClick={single} className="rounded-lg border border-indigo-500 px-3 text-sm font-bold text-indigo-700 disabled:opacity-40 dark:text-indigo-300">
     1組検証
   </button>
  </div>
  {message&&<p role="status" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">{message}</p>}
  {last?.quality&&<details className="mt-2 text-xs"><summary>直近の銘柄別品質を確認</summary>
   {last.quality.map((x:{code:string;ok:boolean;reason:string|null;events:number})=>
    <p key={x.code}>{x.code}：{x.ok?"品質合格":"除外 "+x.reason} / 検出{x.events}件</p>)}
  </details>}
  <details className="mt-4">
   <summary className="cursor-pointer text-sm font-bold">100銘柄の条件別成績（詳細）</summary>
   <p className="mt-2 text-xs text-slate-500">30件未満の区分は非表示。すべて過去検証で、将来の利益を保証しません。</p>
   {kinds.map(([group,title])=><div key={group} className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <p className="font-black">{title}</p>
    {volumes.map(([v,name])=><div key={v} className="mt-2 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
     <p className="font-bold">{name}</p>
     {[1,3,5].map(h=>{
      const s=progress?.stats.find(r=>r.group===group&&r.volumeBucket===v&&r.horizon===h);
      return <p key={h} className="mt-1 text-xs">
       {h}営業日後：{s?.sampleCount??0}件 / プラス割合 {format(s?.positiveRate??null,true)}
       <span className="block">平均損益 {format(s?.averageReturn??null)} / 平均最大下落 {format(s?.averageAdverse??null)}</span>
      </p>;
     })}
    </div>)}
   </div>)}
  </details>
  <p className="mt-3 text-xs leading-5 text-slate-500">
    連続実行は画面を開いている間だけ動き、1回の通信は5銘柄・同時取得2件まで。データ不備や取得失敗で止まり、再取得は同じ確定日にはしません。完了組は次回飛ばします。元の300件は不変更、AI POWER・実売買・LINE通知・Cronにも影響しません。
  </p>
 </section>;
}
