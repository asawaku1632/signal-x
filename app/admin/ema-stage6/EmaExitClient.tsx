"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {EMA_RESEARCH_UNIVERSE,EMA_VALIDATION_CUTOFF} from "@/app/lib/emaRegimeResearch";
import type {EmaStudyInput,EmaStudyPhase} from "@/app/lib/emaRegimeResearch";
import type {EmaCandle} from "@/app/lib/emaCrossoverBacktest";
import {EMA_EXIT_IDS,EMA_EXIT_RULES,exitResearchSummary} from "@/app/lib/emaExitRiskResearch";
import type {EmaExitId} from "@/app/lib/emaExitRiskResearch";

type Item={code:string;input?:EmaStudyInput;error?:string};
type StockPayload={success:true;code:string;candles:EmaCandle[];splitEvents?:number[]};
const yen=(n:number)=>(n>0?"+":"")+n.toLocaleString("ja-JP",{maximumFractionDigits:2})+"円";
const n=(v:number|null)=>(v===null?"—":v.toLocaleString("ja-JP",{maximumFractionDigits:2}));
const pct=(v:number|null)=>v===null?"—":n(v)+"%";
const phases:{id:EmaStudyPhase;name:string}[]=[
 {id:"ALL",name:"全期間"},{id:"TRAIN",name:"過去前半"},{id:"TEST",name:"過去後半（確認用）"},
];
const codeNames=new Map<string,string>(EMA_RESEARCH_UNIVERSE.map((x)=>[x.code,x.name]));
const signedColor=(value:number)=>value>=0?"text-emerald-600":"text-red-600";

function Stat({name,value}:{name:string;value:string}){
 return <div className="min-w-0 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
  <p className="text-xs font-bold text-slate-500">{name}</p>
  <p className="mt-1 break-words text-base font-black">{value}</p>
 </div>;
}
export default function EmaExitClient(){
 const [selectedSize,setSelectedSize]=useState<20|40>(20);
 const [activeSize,setActiveSize]=useState<20|40>(20);
 const [run,setRun]=useState(0);
 const [items,setItems]=useState<Item[]>([]);
 const [progress,setProgress]=useState(0);
 const [busy,setBusy]=useState(false);
 const [phase,setPhase]=useState<EmaStudyPhase>("TEST");
 const [cost,setCost]=useState<0|0.0015>(0.0015);
 const [sortRule,setSortRule]=useState<EmaExitId>("STOP");
 const [showAll,setShowAll]=useState(false);

 useEffect(()=>{
  if(run===0)return;
  const abort=new AbortController();
  const codes=EMA_RESEARCH_UNIVERSE.slice(0,activeSize).map(x=>x.code);
  const load=async()=>{
   setBusy(true);setItems([]);setProgress(0);
   const results:Item[]=[];
   for(let i=0;i<codes.length&&!abort.signal.aborted;i+=2){
    const batch=await Promise.all(codes.slice(i,i+2).map(async(code):Promise<Item>=>{
     try{
      const r=await fetch("/api/admin/ema-signals?code="+code+"&range=2y",{cache:"no-store",signal:abort.signal});
      const d=await r.json();
      if(!r.ok||d.success!==true)throw Error(d.error??"株価取得失敗");
      const payload=d as StockPayload;
      return {code,input:{code,candles:payload.candles,splitEvents:payload.splitEvents??[]}};
     }catch(e){return {code,error:abort.signal.aborted?"中断":e instanceof Error?e.message:"取得失敗"};}
    }));
    if(abort.signal.aborted)break;
    results.push(...batch);setItems([...results]);setProgress(results.length);
   }
   if(!abort.signal.aborted)setBusy(false);
  };
  void load();
  return ()=>abort.abort();
 },[run,activeSize]);

 const inputs=useMemo(()=>items.flatMap(x=>x.input?[x.input]:[]),[items]);
 const research=useMemo(()=>exitResearchSummary(inputs,phase,cost),[inputs,phase,cost]);
 const loaded=run>0&&!busy&&progress===activeSize;
 const failed=items.filter(x=>x.error);
 const reference=research.summaries.EMA;
 const sortedStocks=useMemo(()=>[...research.summaries[sortRule].byStock]
  .filter(x=>x.stats.trades>0)
  .sort((a,b)=>{
   const aGood=a.stats.trades>=3,bGood=b.stats.trades>=3;
   if(aGood!==bGood)return aGood?-1:1;
   return (b.stats.avgReturnPercent??-Infinity)-(a.stats.avgReturnPercent??-Infinity);
  }),[research,sortRule]);

 return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
  <div className="mx-auto max-w-7xl">
   <div className="flex flex-wrap items-center justify-between gap-2"><Link href="/admin/ema-stage5" className="text-sm font-bold text-blue-600">← 第5段階・売買条件の研究へ戻る</Link><Link href="/admin/ema-forward" className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-black text-violet-700">📡 第7段階・未来の成績追跡 →</Link></div>
   <header className="mt-3 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <p className="text-xs font-black tracking-widest text-violet-600">ADMIN / RESEARCH ONLY</p>
    <h1 className="mt-2 text-2xl font-black">🛡️ 第6段階・損切り・利確・保有日数の検証</h1>
    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">第5段階の③「EMA＋BB＋上昇基調」の買い条件は変えず、売り方だけ4通り比較。勝率だけでなくコストを差し引いた利益、中央値、PF、大損、連敗数を確認します。</p>
    <div className="mt-4 flex flex-wrap items-end gap-3">
     <label className="flex flex-col gap-1 text-sm font-bold">検証対象
      <select value={selectedSize} disabled={busy} onChange={e=>setSelectedSize(Number(e.target.value) as 20|40)}
       className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900">
       <option value={20}>20銘柄（推奨）</option><option value={40}>40銘柄</option>
      </select>
     </label>
     <button type="button" disabled={busy} onClick={()=>{setActiveSize(selectedSize);setRun(x=>x+1);setShowAll(false);}}
      className="min-h-12 rounded-xl bg-violet-600 px-5 font-black text-white disabled:opacity-50">{busy?"取得中…":"研究を開始・再実行"}</button>
    </div>
    <p className="mt-2 text-xs text-slate-500">データ取得はボタンを押したときだけ。データベースへの保存や通知はありません。</p>
   </header>

   <section className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
    {EMA_EXIT_IDS.map(id=><article key={id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
     <p className="font-black">{EMA_EXIT_RULES[id].label}</p>
     <p className="mt-1 text-xs leading-5 text-slate-500">{EMA_EXIT_RULES[id].desc}</p>
    </article>)}
   </section>
   {run===0&&<p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm font-bold text-blue-800">「研究を開始・再実行」を押すと20銘柄の日足を取得します。</p>}
   {run>0&&<section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <h2 className="font-black">📥 データ取得 {progress}/{activeSize}銘柄 {busy?"（進行中）":"（終了）"}</h2>
    <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-violet-500" style={{width:100*progress/activeSize+"%"}}/></div>
    <p className="mt-2 text-xs text-slate-500">集計可能 {research.eligible}件／価格確認待ち {research.excluded}件／取得失敗 {failed.length}件</p>
    {failed.length>0&&<p className="mt-2 text-sm text-amber-700">取得失敗：{failed.map(x=>x.code).join("、")}（結果に含まず）</p>}
    {research.excluded>0&&<details className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
     <summary className="cursor-pointer font-bold">⚠ 株式分割・価格異常の保留理由</summary>
     <p className="mt-2">{research.stocks.filter(x=>x.reason).map(x=>x.code+" "+x.reason).join("／")}</p>
    </details>}
    {!loaded&&<p className="mt-2 text-xs font-bold text-amber-700">集計途中の数字は暫定値。読み込みがすべて終了してから評価してください。</p>}
   </section>}

   {inputs.length>0&&research.eligible>0&&<>
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
     <h2 className="text-lg font-black">⚙️ 比較設定</h2>
     <div className="mt-3 flex flex-wrap gap-2">
      {phases.map(p=><button type="button" key={p.id} onClick={()=>setPhase(p.id)} aria-pressed={phase===p.id}
       className={"rounded-lg px-3 py-2 text-sm font-black "+(phase===p.id?"bg-blue-600 text-white":"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100")}>{p.name}</button>)}
     </div>
     <label className="mt-3 flex flex-col gap-1 text-sm font-bold">片道あたりの仮定取引コスト（手数料＋スリッページ）
      <select value={cost} onChange={e=>setCost(Number(e.target.value) as 0|0.0015)}
       className="mt-1 min-h-12 w-fit rounded-xl border border-slate-300 bg-white px-3 text-slate-900">
       <option value={0.0015}>片道0.15%（往復約0.30%）</option>
       <option value={0}>コスト0%（比較用）</option>
      </select>
     </label>
     <p className="mt-2 text-xs leading-5 text-slate-500">コストは各売買時の約定代金から率で概算。税金・配当・実際の板や売買可能性は含めません。期間境界：{EMA_VALIDATION_CUTOFF}、跨ぐ取引は前半後半から除外。</p>
    </section>

    <section className="mt-5">
     <h2 className="text-xl font-black">📊 売り方4通りの成績</h2>
     <p className="mt-1 text-xs text-slate-500">確定取引のみ／1銘柄100株固定／同一資金の運用成績ではありません</p>
     <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {EMA_EXIT_IDS.map(id=>{
       const row=research.summaries[id],m=row.stats;
       return <article key={id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-base font-black">{EMA_EXIT_RULES[id].label}</h3>
        <p className="mt-3 text-xs text-slate-500">コスト控除後の確定損益</p>
        <p className={"mt-1 break-words text-xl font-black "+signedColor(m.totalPnlYen)}>{m.trades?yen(m.totalPnlYen):"—"}</p>
        <p className="mt-2 text-xs text-slate-500">勝率・決済取引数</p>
        <p className="text-xl font-black">{pct(m.winRatePercent)} <span className="text-sm font-medium">({m.trades}回)</span></p>
        <p className="mt-1 text-xs text-slate-500">{m.wins}勝 {m.losses}敗／対象 {row.tradedStocks}/{research.eligible}銘柄</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
         <Stat name="平均損益率" value={pct(m.avgReturnPercent)}/>
         <Stat name="中央値損益率" value={pct(m.medianReturnPercent)}/>
         <Stat name="プロフィットファクター" value={m.grossLossYen===0?"算出不可":n(m.profitFactor)}/>
         <Stat name="最長連敗" value={m.trades?m.longestLosingStreak+"回":"—"}/>
         <Stat name="最悪の1取引" value={m.worstTradeYen===null?"—":yen(m.worstTradeYen)}/>
         <Stat name="確定損益最大DD" value={m.trades?n(m.maxRealizedDrawdownYen)+"円":"—"}/>
        </div>
        <p className="mt-3 text-xs text-slate-500">コスト合計 {yen(-row.totalFrictionYen)}</p>
        {m.trades<30&&<p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-800">⚠ 30件未満：参考値</p>}
       </article>;
      })}
     </div>
    </section>

    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
     <h2 className="text-lg font-black">🔬 従来のEMA売りとの比較</h2>
     <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[650px] text-xs">
       <thead><tr className="border-b text-slate-500"><th className="p-2 text-left">売り方</th><th className="p-2 text-right">勝率差</th><th className="p-2 text-right">累計損益差</th><th className="p-2 text-right">最悪取引</th><th className="p-2 text-right">保留ポジション</th></tr></thead>
       <tbody>{EMA_EXIT_IDS.map(id=>{
        const x=research.summaries[id],w=x.stats.winRatePercent,b=reference.stats.winRatePercent;
        return <tr key={id} className="border-b border-slate-100 dark:border-slate-800">
         <td className="p-2 font-bold">{EMA_EXIT_RULES[id].label}</td>
         <td className="p-2 text-right">{w===null||b===null?"—":(w-b>0?"+":"")+n(Number((w-b).toFixed(2)))+"pt"}</td>
         <td className="p-2 text-right">{x.stats.trades&&reference.stats.trades?yen(Number((x.stats.totalPnlYen-reference.stats.totalPnlYen).toFixed(2))):"—"}</td>
         <td className="p-2 text-right">{x.stats.worstTradeYen===null?"—":yen(x.stats.worstTradeYen)}</td>
         <td className="p-2 text-right">{x.openPositions}銘柄</td>
        </tr>;
       })}</tbody>
      </table>
     </div>
     <p className="mt-3 text-xs text-slate-500">早期に決済しても次の適格なEMA買い交差まで再購入しません。売り方によって取引回数と保有日数が変わるため、成績差は同じ取引を単純に置換した効果とは限りません。</p>
    </section>

    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
     <h2 className="text-lg font-black">📍 売却理由・利益集中のチェック</h2>
     <div className="mt-3 grid gap-2 md:grid-cols-2">
      {EMA_EXIT_IDS.map(id=>{
       const x=research.summaries[id];
       return <article key={id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="font-black">{EMA_EXIT_RULES[id].label}</p>
        <p className="mt-2 text-xs">EMA売り {x.reasons.EMA}回／損切り {x.reasons.STOP}回／利確 {x.reasons.TAKE}回／期間上限 {x.reasons.TIME}回</p>
        <p className="mt-2 text-sm">最高利益銘柄：<b>{x.maximumContributor??"—"}</b></p>
        <p className="mt-1 text-xs text-slate-500">その銘柄を除いた合計（コスト控除後）</p>
        <p className={"mt-1 text-lg font-black "+signedColor(x.excludingMaximumContributorYen??0)}>{x.excludingMaximumContributorYen===null?"—":yen(x.excludingMaximumContributorYen)}</p>
       </article>;
      })}
     </div>
    </section>

    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
     <h2 className="text-lg font-black">🔎 銘柄別・平均損益率と大損確認</h2>
     <label className="mt-3 flex flex-col gap-1 text-sm font-bold">表示する売り方
      <select value={sortRule} onChange={e=>{setSortRule(e.target.value as EmaExitId);setShowAll(false);}}
       className="w-fit min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-900">
       {EMA_EXIT_IDS.map(id=><option key={id} value={id}>{EMA_EXIT_RULES[id].label}</option>)}
      </select>
     </label>
     <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[560px] text-xs">
       <thead><tr className="border-b text-slate-500"><th className="p-2 text-left">銘柄</th><th className="p-2 text-right">取引数</th><th className="p-2 text-right">勝率</th><th className="p-2 text-right">平均利益率</th><th className="p-2 text-right">最悪1件</th><th className="p-2 text-right">確定損益</th></tr></thead>
       <tbody>{(showAll?sortedStocks:sortedStocks.slice(0,10)).map(row=><tr key={row.code} className="border-b border-slate-100 dark:border-slate-800">
        <td className="p-2 font-bold">{row.code} <span className="font-normal text-slate-500">{codeNames.get(row.code)}</span></td>
        <td className="p-2 text-right">{row.stats.trades}</td>
        <td className="p-2 text-right">{pct(row.stats.winRatePercent)}</td>
        <td className="p-2 text-right">{pct(row.stats.avgReturnPercent)}</td>
        <td className="p-2 text-right">{row.stats.worstTradeYen===null?"—":yen(row.stats.worstTradeYen)}</td>
        <td className={"p-2 text-right font-black "+signedColor(row.stats.totalPnlYen)}>{yen(row.stats.totalPnlYen)}</td>
       </tr>)}</tbody>
      </table>
      {sortedStocks.length===0&&<p className="py-3 text-sm text-slate-500">選択期間に確定取引がありません。</p>}
     </div>
     {sortedStocks.length>10&&<button type="button" onClick={()=>setShowAll(v=>!v)} className="mt-3 rounded-lg border px-3 py-2 text-sm font-bold">{showAll?"先頭10銘柄":"全"+sortedStocks.length+"銘柄を表示"}</button>}
     <p className="mt-2 text-xs text-slate-500">平均損益率順は3取引以上を先に表示。個別成績が良い銘柄を過去結果から選ぶと、過剰最適化のリスクがあります。</p>
    </section>
   </>}

   <footer className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-900">
    <p className="font-black">🔒 検証の前提と限界</p>
    <p className="mt-2">損切りは日中安値・利確は日中高値で閾値に到達したと仮定。寄付きが閾値より不利なら寄付きで決済し、ストップ価格で必ず売れるとは仮定しません。日足からは板状況・実際の約定順序・急変時の滑りを再現できません。コストは固定率の概算。</p>
    <p className="mt-2">保有期限は20営業日が経過した次の営業日始値で決済。買い・EMA売りは確定サインの翌営業日始値。途中の利確・損切り・期限売りは再買いを誘発せず、次の適格な買い交差を待ちます。</p>
    <p className="mt-2">過去前半は{EMA_VALIDATION_CUTOFF}より前に決済、後半はその日以降の買いを集計。境界跨ぎ取引は前半・後半から除外。後半も既知の過去データのため独立した将来検証ではありません。</p>
    <p className="mt-2">固定銘柄に生存バイアスがあります。分割・価格異常や不正な日足データは保留。損益は100株ずつの合算で資金制約を再現しません。最大DDは確定損益ベースで保有中の評価損、税金、配当、約定不能は含めません。実験室・AI POWER・DB・LINE通知・Cron・疑似購入・本番売買判定は変更しません。</p>
   </footer>
  </div>
 </main>;
}
