"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EMA_RESEARCH_UNIVERSE, EMA_VALIDATION_CUTOFF } from "@/app/lib/emaRegimeResearch";
import type { EmaStudyInput, EmaStudyPhase } from "@/app/lib/emaRegimeResearch";
import type { EmaCandle } from "@/app/lib/emaCrossoverBacktest";
import { EMA_STAGE5_IDS, EMA_STAGE5_RULES, stage5Summary, riskStatistics } from "@/app/lib/emaStage5Research";
import type { EmaStage5Id } from "@/app/lib/emaStage5Research";

type Success = {
  success: true;
  code: string;
  candles: EmaCandle[];
  splitEvents?: number[];
};
type LoadResult = { code: string; input?: EmaStudyInput; error?: string };
const phases: Array<{id:EmaStudyPhase; label:string}> = [
  {id:"ALL",label:"全期間"},
  {id:"TRAIN",label:"過去前半"},
  {id:"TEST",label:"過去後半（確認用）"},
];
const fmt=(value:number)=>value.toLocaleString("ja-JP",{maximumFractionDigits:2});
const money=(value:number)=>(value>0?"+":"")+fmt(value)+"円";
const pct=(value:number|null)=>value===null?"—":fmt(value)+"%";
const pf=(value:number|null,grossLoss:number,trades:number)=>trades===0?"—":grossLoss===0?"算出不可（負け0）":value===null?"—":fmt(value);
const color=(number:number)=>number>=0?"text-emerald-600":"text-red-600";

function RiskCard({name, data, countStocks, tradesStocks}:{name:string;data:ReturnType<typeof riskStatistics>;countStocks:number;tradesStocks:number}) {
  return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <h3 className="text-base font-black">{name}</h3>
    <p className="mt-2 text-xs font-bold text-slate-500">勝率 / 決済済み取引</p>
    <p className="mt-1 text-2xl font-black tabular-nums">{pct(data.winRatePercent)} <span className="text-sm font-medium text-slate-500">({data.trades}回)</span></p>
    <p className="mt-1 text-xs text-slate-500">{data.wins}勝・{data.losses}敗・{data.flats}引分 / 取引成立 {tradesStocks}/{countStocks}銘柄</p>
    <p className="mt-3 text-xs font-bold text-slate-500">100株ずつの確定損益合計</p>
    <p className={"mt-1 break-words text-xl font-black tabular-nums "+color(data.totalPnlYen)}>{data.trades?money(data.totalPnlYen):"—"}</p>
    <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-3 text-xs">
      <div><p className="text-slate-500">平均損益率</p><p className="mt-1 font-black">{pct(data.avgReturnPercent)}</p></div>
      <div><p className="text-slate-500">中央値損益率</p><p className="mt-1 font-black">{pct(data.medianReturnPercent)}</p></div>
      <div><p className="text-slate-500">平均損益（円）</p><p className="mt-1 break-words font-black">{data.avgPnlYen===null?"—":money(data.avgPnlYen)}</p></div>
      <div><p className="text-slate-500">中央値損益（円）</p><p className="mt-1 break-words font-black">{data.medianPnlYen===null?"—":money(data.medianPnlYen)}</p></div>
      <div><p className="text-slate-500">PF（総利益÷総損失）</p><p className="mt-1 font-black">{pf(data.profitFactor,data.grossLossYen,data.trades)}</p></div>
      <div><p className="text-slate-500">最長連敗</p><p className="mt-1 font-black">{data.trades?data.longestLosingStreak+"回":"—"}</p></div>
      <div><p className="text-slate-500">最悪1取引</p><p className="mt-1 break-words font-black">{data.worstTradeYen===null?"—":money(data.worstTradeYen)}</p></div>
      <div><p className="text-slate-500">確定損益ベース最大DD</p><p className="mt-1 break-words font-black">{data.trades?fmt(data.maxRealizedDrawdownYen)+"円":"—"}</p></div>
    </div>
    {data.trades<30&&<p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">⚠ 30取引未満：勝率・PFなどは参考値</p>}
  </article>;
}

export default function EmaStage5Client() {
  const [size,setSize]=useState<20|40>(20);
  const [activeSize,setActiveSize]=useState<20|40>(20);
  const [run,setRun]=useState(0);
  const [progress,setProgress]=useState(0);
  const [busy,setBusy]=useState(false);
  const [items,setItems]=useState<LoadResult[]>([]);
  const [phase,setPhase]=useState<EmaStudyPhase>("TEST");
  const [sort,setSort]=useState<"RETURN"|"WORST">("RETURN");
  const [selected,setSelected]=useState<EmaStage5Id>("BB_UP_HIGH");
  const [showAll,setShowAll]=useState(false);

  useEffect(()=>{
    if(run===0)return;
    const controller=new AbortController();
    const codes=EMA_RESEARCH_UNIVERSE.slice(0,activeSize).map(x=>x.code);
    const fetchAll=async()=>{
      setBusy(true);setProgress(0);setItems([]);
      const results:LoadResult[]=[];
      // Explicit, bounded requests. Do not change background schedules.
      for(let i=0;i<codes.length&&!controller.signal.aborted;i+=2){
        const batch=await Promise.all(codes.slice(i,i+2).map(async(code):Promise<LoadResult>=>{
          try {
            const r=await fetch("/api/admin/ema-signals?code="+code+"&range=2y",{
              cache:"no-store",signal:controller.signal,
            });
            const data=await r.json();
            if(!r.ok||data.success!==true)throw new Error(data.error||"取得失敗");
            const result=data as Success;
            return {code,input:{code,candles:result.candles,splitEvents:result.splitEvents??[]}};
          }catch(error){
            return {code,error:controller.signal.aborted?"中断":error instanceof Error?error.message:"取得失敗"};
          }
        }));
        if(controller.signal.aborted)break;
        results.push(...batch);
        setProgress(results.length);
        setItems([...results]);
      }
      if(!controller.signal.aborted)setBusy(false);
    };
    void fetchAll();
    return ()=>controller.abort();
  },[run,activeSize]);

  const inputs=useMemo(()=>items.flatMap(item=>item.input?[item.input]:[]),[items]);
  const summary=useMemo(()=>stage5Summary(inputs),[inputs]);
  const errors=items.filter(item=>!!item.error);
  const completed=run>0&&!busy&&progress===activeSize;
  const metrics=summary.phases[phase];
  const ranked=useMemo(()=>{
    const current=summary.phases[phase][selected].byStock.filter(row=>row.risk.trades>0);
    return [...current].sort((a,b)=>{
      if(sort==="WORST")return (a.risk.worstTradeYen??Infinity)-(b.risk.worstTradeYen??Infinity);
      // >=3 completed trades for stability; below threshold always placed after eligible stocks.
      const aq=a.risk.trades>=3, bq=b.risk.trades>=3;
      if(aq!==bq)return aq?-1:1;
      return (b.risk.avgReturnPercent??-Infinity)-(a.risk.avgReturnPercent??-Infinity);
    });
  },[summary,phase,selected,sort]);
  const codesByName=new Map<string,string>(EMA_RESEARCH_UNIVERSE.map(item=>[item.code,item.name]));

  return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-7xl">
      <Link href="/admin/ema-regimes" className="text-sm font-bold text-blue-600">← 第4段階・相場環境研究に戻る</Link>
      <header className="mt-3 rounded-2xl border border-violet-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-black tracking-widest text-violet-600">ADMIN RESEARCH / READ ONLY</p>
        <h1 className="mt-2 text-2xl font-black">🧪 第5段階・EMA＋BB複合条件＆リスク比較</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          EMA単独→BB→上昇基調→高ボラと買い条件を追加し、翌営業日始値の100株仮想売買で比較。
          勝率だけでなく利益率・中央値・PF・大損・連敗も見る研究専用ページです。
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-bold">調査する銘柄数（約2年）
            <select disabled={busy} value={size} onChange={e=>setSize(Number(e.target.value) as 20|40)}
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 disabled:opacity-50">
              <option value={20}>20銘柄（推奨）</option>
              <option value={40}>40銘柄</option>
            </select>
          </label>
          <button type="button" disabled={busy} onClick={()=>{setActiveSize(size);setRun(n=>n+1);setShowAll(false);}}
            className="min-h-12 rounded-xl bg-violet-600 px-5 font-black text-white disabled:opacity-50">
            {busy?"研究中…":"研究を開始・再実行"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">研究開始ボタンを押したときだけ取得。DB保存・通知・既存AIの変更はなし。</p>
      </header>

      <section className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {EMA_STAGE5_IDS.map(id=><div key={id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="font-black">{EMA_STAGE5_RULES[id].label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{EMA_STAGE5_RULES[id].detail}</p>
        </div>)}
      </section>

      {run===0&&<p className="mt-4 rounded-xl bg-blue-50 p-4 font-bold text-blue-800">まず「研究を開始・再実行」を押してね。20銘柄の過去データを取得します。</p>}
      {run>0&&<section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="font-black">📥 読み込み {progress}/{activeSize}銘柄 {busy?"（進行中）":"（終了）"}</h2>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-violet-500" style={{width:(100*progress/activeSize)+"%"}}/></div>
        <p className="mt-2 text-xs text-slate-500">集計対象 {summary.eligible}件／価格要確認 {summary.excluded}件／取得失敗 {errors.length}件</p>
        {errors.length>0&&<p className="mt-2 text-sm font-bold text-amber-700">取得失敗：{errors.map(x=>x.code).join("、")}（集計から除外）</p>}
        {summary.excluded>0&&<details className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <summary className="cursor-pointer font-black">⚠ 株式分割・異常価格の保留銘柄を確認</summary>
          <p className="mt-2">{summary.stocks.filter(s=>s.reason).map(s=>s.code+" "+s.reason).join("／")}</p>
        </details>}
        {busy&&<p className="mt-2 text-sm font-bold text-amber-700">読み込み途中の数字は暫定値です。すべて終わってから比較してください。</p>}
      </section>}

      {inputs.length>0&&summary.eligible>0&&<>
        <section className="mt-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-black">📊 4条件の勝率・利益・リスク比較</h2>
              <p className="mt-1 text-xs text-slate-500">固定の分割境界：{EMA_VALIDATION_CUTOFF}／境界をまたぐ取引は前半・後半の両方から除外</p>
            </div>
            {!completed&&<span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">集計途中</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {phases.map(p=><button key={p.id} type="button" onClick={()=>{setPhase(p.id);setShowAll(false);}} aria-pressed={phase===p.id}
              className={"rounded-xl px-3 py-2 text-sm font-black "+(phase===p.id?"bg-blue-600 text-white":"bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-100")}>{p.label}</button>)}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {EMA_STAGE5_IDS.map(id=><RiskCard key={id} name={EMA_STAGE5_RULES[id].label}
              data={metrics[id].metrics} countStocks={metrics[id].eligibleStocks} tradesStocks={metrics[id].tradedStocks}/>)}
          </div>
          <p className="mt-3 text-xs leading-6 text-slate-500">利益は100株ずつの仮想取引を足したもので同一資金の運用結果ではありません。PFは利益総額÷損失総額。最大DDと連敗は複数銘柄の決済順に並べた確定損益から計算（未決済・値洗いリスク・同時保有の資金制約を含まない）。</p>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">🧭 条件を厳しくしたときの変化</h2>
          <p className="mt-1 text-xs text-slate-500">同じ期間のEMA＋BB（②）を基準に比較。少数取引の高い勝率を成功と判定しません。</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr className="border-b text-slate-500"><th className="p-2 text-left">条件</th><th className="p-2 text-right">取引</th><th className="p-2 text-right">勝率差</th><th className="p-2 text-right">累計損益差</th><th className="p-2 text-right">平均損益率差</th></tr></thead>
              <tbody>{EMA_STAGE5_IDS.map(id=>{
                const m=metrics[id].metrics, baseline=metrics.BB.metrics;
                const winDiff=m.winRatePercent!==null&&baseline.winRatePercent!==null?m.winRatePercent-baseline.winRatePercent:null;
                const avgDiff=m.avgReturnPercent!==null&&baseline.avgReturnPercent!==null?m.avgReturnPercent-baseline.avgReturnPercent:null;
                return <tr key={id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="p-2 font-bold">{EMA_STAGE5_RULES[id].label}</td>
                  <td className="p-2 text-right">{m.trades}</td>
                  <td className="p-2 text-right">{winDiff===null?"—":(winDiff>0?"+":"")+fmt(Number(winDiff.toFixed(1)))+"pt"}</td>
                  <td className="p-2 text-right">{m.trades&&baseline.trades?money(m.totalPnlYen-baseline.totalPnlYen):"—"}</td>
                  <td className="p-2 text-right">{avgDiff===null?"—":(avgDiff>0?"+":"")+fmt(Number(avgDiff.toFixed(2)))+"pt"}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">🎯 利益集中の監査（各条件別）</h2>
          <p className="mt-1 text-xs text-slate-500">最大利益の1銘柄を外しても損益が残るか確認。最悪取引や平均損益率と一緒に判断。</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {EMA_STAGE5_IDS.map(id=>{
              const row=metrics[id];
              return <div key={id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="font-black">{EMA_STAGE5_RULES[id].label}</p>
                <p className="mt-2 text-sm">最大利益銘柄：<b>{row.highestProfitStock??"—"}</b> {row.highestProfitYen===null?"":money(row.highestProfitYen)}</p>
                <p className="mt-1 text-xs text-slate-500">その1銘柄を除いた合計</p>
                <p className={"mt-1 text-lg font-black "+color(row.excludingHighestProfitYen??0)}>
                  {row.excludingHighestProfitYen===null?"—":money(row.excludingHighestProfitYen)}
                </p>
              </div>;
            })}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">🔎 銘柄別・平均損益率ランキング＆大損監査</h2>
          <p className="mt-1 text-xs text-slate-500">確認したい条件と並び順を選択。平均損益率順は3取引以上を先に表示。条件の採否を自動で決める機能ではありません。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-xs font-bold">比較する条件
              <select value={selected} onChange={e=>{setSelected(e.target.value as EmaStage5Id);setShowAll(false);}}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900">
                {EMA_STAGE5_IDS.map(id=><option key={id} value={id}>{EMA_STAGE5_RULES[id].label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold">並び順
              <select value={sort} onChange={e=>setSort(e.target.value as "RETURN"|"WORST")}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900">
                <option value="RETURN">平均損益率の高い順</option><option value="WORST">最悪損失が大きい順</option>
              </select>
            </label>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[570px] text-left text-xs">
              <thead><tr className="border-b text-slate-500"><th className="p-2">銘柄</th><th className="p-2 text-right">取引</th><th className="p-2 text-right">勝率</th><th className="p-2 text-right">平均損益率</th><th className="p-2 text-right">中央値</th><th className="p-2 text-right">最悪取引</th><th className="p-2 text-right">100株損益</th></tr></thead>
              <tbody>{(showAll?ranked:ranked.slice(0,10)).map(row=><tr key={row.code} className="border-b border-slate-100 dark:border-slate-800">
                <td className="p-2 font-bold">{row.code} <span className="font-normal text-slate-500">{codesByName.get(row.code)}</span></td>
                <td className="p-2 text-right">{row.risk.trades}</td>
                <td className="p-2 text-right">{pct(row.risk.winRatePercent)}</td>
                <td className="p-2 text-right">{pct(row.risk.avgReturnPercent)}</td>
                <td className="p-2 text-right">{pct(row.risk.medianReturnPercent)}</td>
                <td className="p-2 text-right">{row.risk.worstTradeYen===null?"—":money(row.risk.worstTradeYen)}</td>
                <td className={"p-2 text-right font-bold "+color(row.risk.totalPnlYen)}>{money(row.risk.totalPnlYen)}</td>
              </tr>)}</tbody>
            </table>
            {ranked.length===0&&<p className="py-3 text-sm text-slate-500">決済済みの取引がありません。条件が厳しすぎる可能性があります。</p>}
          </div>
          {ranked.length>10&&<button type="button" onClick={()=>setShowAll(v=>!v)}
            className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold">{showAll?"先頭10銘柄に戻す":"全"+ranked.length+"銘柄を表示"}</button>}
        </section>
      </>}

      <footer className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        <p className="font-black">🔒 研究結果の扱い</p>
        <p className="mt-1">
          すべての買いフィルターは交差した当日までのデータだけを使用。売買価格は次の営業日の始値と仮定し、売りルールは全条件共通。前半は{EMA_VALIDATION_CUTOFF}より前に決済、後半はその日以降に買付、境界をまたぐ取引は双方から除外。全期間では含む。
          銘柄と条件は過去成績を見て選んでいるので、後半も純粋な未知データでの将来検証ではありません。必ず後日新たなデータで再検証してください。
        </p>
        <p className="mt-2">
          株式分割イベント／極端な始値ギャップを検知した銘柄は過去価格の調整整合が確認されるまで全4条件から除外。
          固定の20/40銘柄には生存バイアスがあります。買付資金量、税金、手数料、スリッページ、配当、実際の約定可能性、同時保有、含み損と未決済の資金リスクは含めていません。
        </p>
        <p className="mt-2">実験室・DB・Cron・LINE通知・AI POWER・疑似購入・本番売買判定は変更しません。</p>
      </footer>
    </div>
  </main>;
}
