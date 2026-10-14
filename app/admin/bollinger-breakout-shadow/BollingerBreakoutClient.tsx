"use client";
import Link from "next/link";
import {useState} from "react";

type Period = {sampleCount:number;missing:number;status:string;
  positiveRate:number|null;meanReturnPercent:number|null;meanMaxAdversePercent:number|null};
type Group = {eventCount:number;horizons:Record<string,Period>;
  nextDayKnownCount:number;nextDayReturnedInsideCount:number};
type Result = {
  success:boolean;status:string;targetDate?:string;calendarVersion?:string;
  reasons?:string[];error?:string;
  report?:{quality:Array<{code:string;ok:boolean;reason:string|null;barCount?:number;events:number}>;
    summary:Record<string,Group>|null};
};
const groups=[["SQUEEZE_UP_BREAKOUT","スクイーズ後の上抜け"],["OTHER_UP_BREAKOUT","通常の上抜け"]] as const;
function percent(value:number|null,fraction=false){
  return value===null?"標本不足":(fraction?value*100:value).toFixed(2)+"%";
}
export default function BollingerBreakoutClient(){
  const [report,setReport]=useState<Result|null>(null);
  const [busy,setBusy]=useState(false);
  const run=async()=>{
    if(busy)return;setBusy(true);setReport(null);
    try{
      const r=await fetch("/api/admin/bollinger-breakout-shadow",{method:"POST",cache:"no-store"});
      setReport(await r.json() as Result);
    }catch{setReport({success:false,status:"FAILED",error:"NETWORK_UNAVAILABLE"});}
    finally{setBusy(false);}
  };
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-3xl space-y-4">
      <Link className="text-sm font-bold text-blue-700 dark:text-blue-300" href="/admin/learning-hub">← 学習管理へ</Link>
      <header className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-black text-indigo-600">OWNER RESEARCH / SHADOW ONLY</p>
        <h1 className="mt-2 text-2xl font-black">ボリンジャーバンド 上抜け比較</h1>
        <p className="mt-2 text-sm leading-6">実際の確定日足を、9984・3762の2銘柄だけで手動検証。売買判定・通知・AI POWER・データベース・定期実行は変更しません。</p>
        <p className="mt-2 text-xs text-slate-500">株価取得：各銘柄1回のみ（計2回）。成果は画面表示だけで保存しません。翌営業日の始値で仮購入し、1・3・5営業日後の終値と比較します。売買の推奨ではありません。</p>
        <button onClick={run} disabled={busy} className="mt-4 w-full rounded-xl bg-indigo-700 px-5 py-3 font-bold text-white disabled:opacity-50">
          {busy?"データ検証中":"2銘柄を読み取って検証"}
        </button>
      </header>
      {report && <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="font-black">検証状態：{report.status}</h2>
        {report.targetDate&&<p className="mt-2 text-sm">対象確定日：{report.targetDate}</p>}
        {report.error&&<p className="mt-2 text-sm text-rose-600">{report.error}</p>}
        {report.reasons?.map(s=><p key={s} className="mt-2 text-sm text-rose-600">{s}</p>)}
        {report.report?.quality.map(q=><p key={q.code} className="mt-2 text-sm">
          {q.code}：{q.ok?"データ品質確認済み":"品質確認NG "+q.reason}
          {q.barCount!==undefined?" / "+q.barCount+"本":""} / 検出{q.events}件</p>)}
      </section>}
      {report?.report?.summary&&groups.map(([id,label])=>{
        const g=report.report!.summary![id];
        if(!g)return null;
        return <section key={id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-black">{label}：{g.eventCount}件</h2>
          <p className="mt-2 text-sm">翌営業日に＋2σの内側へ戻った割合（失速の参考）：
            {g.nextDayKnownCount>=30
              ?(100*g.nextDayReturnedInsideCount/g.nextDayKnownCount).toFixed(1)+"%"
              :"標本不足"}（判定可能 {g.nextDayKnownCount}件）</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[1,3,5].map(h=>{
              const p=g.horizons[String(h)];
              return <div className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800" key={h}>
                <p className="font-black">{h}営業日後</p>
                <p className="mt-1">評価済み {p.sampleCount}件 / 未完了 {p.missing}件</p>
                <p>プラス割合：{percent(p.positiveRate,true)}</p>
                <p>平均損益：{percent(p.meanReturnPercent)}</p>
                <p>平均最大下落：{percent(p.meanMaxAdversePercent)}</p>
              </div>;
            })}
          </div>
        </section>;
      })}
      <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">30件未満では割合や平均成績を出しません。過去データによる再現研究であり、未来の勝率を証明するものではありません。株式分割・営業日欠損・未確定足がある銘柄は、結果を出さず除外します。</p>
    </div>
  </main>;
}
