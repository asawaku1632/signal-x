"use client";
import {useEffect,useState} from "react";
type Summary={cohort:string;candidates:number;codes:number;first_date:string;last_date:string};
type Outcome={cohort:string;horizon:number;completed:number;mean_return_percent:string|null};
type Report={success:boolean;error?:string;summary?:Summary[];outcomes?:Outcome[]};
const names:Record<string,string>={PRE_SURGE_V1:"急騰前兆",SURGE_START_V1:"急騰開始"};
export default function DualSurgeClient(){
 const [data,setData]=useState<Report|null>(null);
 useEffect(()=>{const controller=new AbortController();fetch("/api/admin/dual-surge-shadow",{cache:"no-store",signal:controller.signal})
  .then(async r=>{const j=await r.json() as Report;if(!r.ok)throw Error(j.error||"取得不可");return j;})
  .then(setData).catch(e=>{if(!controller.signal.aborted)setData({success:false,error:String(e.message||"取得不可")});});
  return ()=>controller.abort();},[]);
 const readiness=<section className="mt-6 rounded-lg border border-amber-300 p-4" aria-label="研究利用の確認状況"><h2 className="font-bold">STEP 581〜600｜正式利用の確認状況</h2><p className="mt-2 text-sm">現在：BLOCKED（正式利用未承認）</p><p className="mt-2 text-sm text-slate-600">データ提供元の利用許可、鮮度、検証証拠、環境分離、CIと承認記録がすべて確認されるまで本番利用しません。これは保存済み証拠の自動判定結果ではありません。</p></section>;
 if(!data)return <>{readiness}<p className="mt-6 text-slate-600">研究記録を確認中…</p></>;
 if(!data.success)return <>{readiness}<section className="mt-6 rounded-lg border p-4"><p className="font-bold">研究データは現在利用できません</p><p className="mt-2 text-sm text-slate-600">{data.error==="RESEARCH_DISABLED"?"研究はまだ有効化されていません。架空の実績は表示しません。":"安全のため集計を表示できません。"}</p></section></>;
 return <>{readiness}<div className="mt-6 space-y-5">{(["PRE_SURGE_V1","SURGE_START_V1"] as const).map(cohort=>{
  const s=data.summary?.find(x=>x.cohort===cohort);const results=data.outcomes?.filter(x=>x.cohort===cohort)||[];
  return <section key={cohort} className="rounded-xl border p-4"><h2 className="text-lg font-bold">{names[cohort]}</h2>
   <p className="mt-2 text-sm">候補 {s?.candidates??0}件 ／ 対象 {s?.codes??0}銘柄</p>
   {!s?<p className="mt-2 text-sm text-slate-600">事前保存された実データはまだありません。</p>:<p className="mt-1 text-xs text-slate-500">記録期間 {s.first_date} ～ {s.last_date}</p>}
   <h3 className="mt-4 font-semibold">将来成績（完了分のみ）</h3>
   {results.length===0?<p className="mt-2 text-sm text-slate-600">検証済みの結果はありません。勝率・平均利益は算出しません。</p>:<ul className="mt-2 space-y-2 text-sm">{results.map(r=><li key={r.horizon}>{r.horizon}営業日後：完了 {r.completed}件 ／ 平均騰落率 {r.mean_return_percent??"算出不可"}%</li>)}</ul>}
  </section>;
 })}</div></>;
}
