"use client";
import {useEffect,useState} from "react";
type Snapshot={
 success:boolean;
 evidence:{recorded:number;evaluated:number;distinctTradeDays:number;completedMonths:number;avgReturn5d:number|null;medianReturn5d:number|null;positiveRate5d:number|null;marketRegimes:unknown[]};
 observedMonths:number;
 readiness:{status:string;consistent:boolean;gaps:Array<{category:string;code:string;label:string;nextAction:string}>};
 decision:{status:string;eligibleForHumanReview:boolean;reasons:string[];automaticActivation:false};
 productionApplied:false;notificationEnabled:false;
};
export default function ResearchReviewPage(){
 const [data,setData]=useState<Snapshot|null>(null);
 const [error,setError]=useState("");
 const [integrated,setIntegrated]=useState<{status:string;reasons:string[];historyCount:number;historyTruncated:boolean;entries:{digest:string;valid:boolean;issues:string[]}[]}|null>(null);
 const [integratedError,setIntegratedError]=useState("");
 useEffect(()=>{let active=true;
  fetch("/api/admin/research-review-snapshot",{cache:"no-store"})
   .then(async r=>{if(!r.ok)throw Error("権限または取得状態を確認してください");return r.json()})
   .then(j=>{if(active)setData(j)})
   .catch(()=>{if(active)setError("研究データを読み込めませんでした")});
  fetch("/api/admin/integrated-research-review",{cache:"no-store"})
   .then(async r=>{if(!r.ok)throw Error("照合結果を取得できません");return r.json()})
   .then(j=>{if(active)setIntegrated(j)})
   .catch(()=>{if(active)setIntegratedError("証拠照合は確認できません（未承認）")});
  return ()=>{active=false};
 },[]);
 return <main className="mx-auto max-w-2xl px-4 py-8 text-slate-900">
  <h1 className="text-2xl font-black">研究成果の採用審査・閲覧専用</h1>
  <p className="mt-3 text-sm text-amber-800">本画面は研究の根拠を確認するだけです。売買判断・AI POWER・通知・承認記録を変更しません。</p>
  {error&&<p role="alert" className="mt-5 text-rose-700">{error}</p>}
  {!data&&!error&&<p className="mt-5">研究データを読み込み中…</p>}
  {data&&<section className="mt-6 space-y-4 rounded-xl border p-5">
   <h2 className="font-bold">判定：{data.decision.status==="BLOCKED"?"採用審査の条件不足":"人間による確認候補"}</h2>
   <p>保存 {data.evidence.recorded.toLocaleString()}件 ／ 5日後検証済み {data.evidence.evaluated.toLocaleString()}件</p>
   <p>記録取引日 {data.evidence.distinctTradeDays}日 ／ 観測月数 {data.observedMonths}か月（完成済み検証月とは異なります）</p>
   <p>5日後平均 {data.evidence.avgReturn5d??"未確定"}% ／ 中央値 {data.evidence.medianReturn5d??"未確定"}%</p>
   <p>5日後プラス率 {data.evidence.positiveRate5d===null?"未確定":(data.evidence.positiveRate5d*100).toFixed(1)+"%"}</p>
   <h3 className="font-bold">未達・未検証事項</h3>
   <p className="text-sm">審査基準の整合性：{data.readiness.consistent?"一致":"要調査"}</p>
   <ul className="space-y-2">{data.readiness.gaps.map(g=><li key={g.code} className="rounded-lg border bg-amber-50 p-3 text-sm"><b>{g.label}</b><p className="text-slate-600">{g.nextAction}</p></li>)}</ul>
   <ul className="list-inside list-disc text-sm">{data.decision.reasons.map(x=><li key={x}>{x}</li>)}</ul>
   <p className="text-sm text-slate-600">提供元・利用許諾・独立時刻・ホールドアウト・相場環境は独立検証が済むまで未確認扱いです。</p>
   <p className="text-sm font-semibold">本番反映：なし ／ 通知解禁：なし</p>
  </section>}
  <section aria-label="証拠履歴との統合照合" className="mt-6 rounded-xl border p-5">
   <h2 className="font-bold">保存証拠と研究審査の統合照合（閲覧専用）</h2>
   <p className="mt-2 text-sm">状態：{integrated?.status==="BLOCKED"?"未承認・確認不足":"未確認"}</p>
   {integratedError&&<p role="alert">{integratedError}</p>}
   {integrated&&<><p className="text-sm">取得した履歴 {integrated.historyCount}件{integrated.historyTruncated?"（取得上限あり）":""}</p>
    <ul className="mt-2 list-inside list-disc text-sm">{integrated.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul>
    <ul className="mt-2 space-y-2">{integrated.entries.map((e,i)=><li key={i} className="rounded-md border p-2 text-xs">証拠 {e.digest.slice(0,12)}…：{e.valid?"形式整合":"要確認"}{e.issues.length?" / "+e.issues.join(", "):""}</li>)}</ul></>}
   <p className="mt-2 text-xs text-slate-500">照合結果は本番採用・売買判断・通知解禁を承認しません。</p>
  </section>
 </main>;
}
