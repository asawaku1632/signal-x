"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stat={profile_key:string;confirmation_key:string;signal_version:string;sample_count:number;completed_5d_count:number;avg_return_5d:number|null;median_return_5d:number|null;positive_rate_5d:number|null;distinct_codes:number;distinct_dates:number;validation_status:string;status_reason:string};
type Candidate={trade_date:string;code:string;name:string;profile_key:string;confirmation_key:string;current_ai_power:number;prev3_avg_ai_power:number;prev3_max_ai_power:number;ai_power_drop_from_peak:number;result_1d:number|null;result_3d:number|null;result_5d:number|null;signal_version:string};
type Payload={stats:Stat[];candidates:Candidate[]};

const pct=(v:number|null)=>v==null?"—":`${Number(v)>=0?"+":""}${Number(v).toFixed(2)}%`;
const label=(v:string)=>v==="EXPLOSIVE_REBOUND"?"爆発反発型":v==="STABLE_REBOUND"?"安定反発型":v==="BASE"?"基本観測":v;
const progress=(c:Candidate)=>c.result_5d!=null?"5日完了":c.result_3d!=null?"3日判定済み":c.result_1d!=null?"1日判定済み":"発生直後";
const review=(v:number|null)=>v==null?null:v>=0.5?{text:"成功",cls:"bg-emerald-50 text-emerald-700"}:v<=-0.5?{text:"失敗",cls:"bg-red-50 text-red-700"}:{text:"横ばい",cls:"bg-amber-50 text-amber-700"};

export default function MomentumMemoryAdminPage(){
 const [data,setData]=useState<Payload|null>(null); const [error,setError]=useState("");
 useEffect(()=>{fetch("/api/admin/momentum-memory",{cache:"no-store"}).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error??"取得に失敗しました");setData(p)}).catch(e=>setError(e instanceof Error?e.message:"取得に失敗しました"))},[]);
 return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950"><div className="mx-auto max-w-7xl">
  <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
   <Link href="/admin/learning-status" className="text-sm font-bold text-blue-600">← 学習監視</Link>
   <p className="mt-4 text-xs font-black tracking-[0.16em] text-blue-600">ADMIN FORWARD VALIDATION</p>
   <h1 className="mt-2 text-3xl font-black">Momentum Memory 監視</h1>
   <p className="mt-2 text-sm text-slate-500">未来データだけでMM_V1を検証します。BUY判定・AI POWERには未接続です。管理者Web Pushのみ有効です。</p>
  </header>
  {error&&<p className="mt-5 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</p>}
  {!data&&!error&&<p className="mt-5 rounded-2xl bg-white p-6 text-slate-500">読み込み中...</p>}
  {data&&<>
   <section className="mt-5 grid gap-3 md:grid-cols-2">
    {data.stats.length===0?<div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="font-black">FORWARD候補はまだ0件</p><p className="mt-1 text-sm text-slate-500">条件成立後、自動的にここへ集計されます。</p></div>:data.stats.map(s=><div key={s.profile_key+s.confirmation_key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
     <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">{label(s.profile_key)} + MACD_GC</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{s.validation_status}</span></div>
     <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric l="候補" v={s.sample_count}/><Metric l="5日完了" v={s.completed_5d_count}/><Metric l="銘柄数" v={s.distinct_codes}/><Metric l="取引日" v={s.distinct_dates}/><Metric l="5日平均" v={pct(s.avg_return_5d)}/><Metric l="プラス率" v={s.positive_rate_5d==null?"—":Number(s.positive_rate_5d).toFixed(1)+"%"}/></div>
     <p className="mt-3 text-xs text-slate-500">{s.status_reason}</p>
    </div>)}
   </section>
   <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black">FORWARD候補一覧</h2><p className="mt-1 text-xs text-slate-500">5日評価: +0.5%以上=成功 / -0.5%以下=失敗 / その間=横ばい。検証表示用で売買判定には使用しません。</p></div>{data.candidates.some(c=>c.result_5d!=null)&&<div className="flex gap-2 text-xs font-black"><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">成功 {data.candidates.filter(c=>c.result_5d!=null&&Number(c.result_5d)>=0.5).length}</span><span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">横ばい {data.candidates.filter(c=>c.result_5d!=null&&Number(c.result_5d)>-0.5&&Number(c.result_5d)<0.5).length}</span><span className="rounded-full bg-red-50 px-3 py-1 text-red-700">失敗 {data.candidates.filter(c=>c.result_5d!=null&&Number(c.result_5d)<=-0.5).length}</span></div>}</div>
    {data.candidates.length===0?<p className="mt-3 text-sm text-slate-500">まだ候補はありません。</p>:<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b text-left text-slate-500">{["日付","銘柄","進捗","5日評価","タイプ","現在AI","直近3日平均","直近ピーク","落差","1日","3日","5日","確認"].map(x=><th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{data.candidates.map(c=><tr key={c.trade_date+c.code} className="border-b border-slate-100"><td className="p-2">{String(c.trade_date).slice(0,10)}</td><td className="p-2 font-black">{c.name} <span className="text-slate-400">{c.code}</span></td><td className="p-2"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{progress(c)}</span></td><td className="p-2">{review(c.result_5d)?<span className={`rounded-full px-2 py-1 text-xs font-black ${review(c.result_5d)!.cls}`}>{review(c.result_5d)!.text}</span>:<span className="text-slate-400">—</span>}</td><td className="p-2">{label(c.profile_key)}</td><td className="p-2">{Number(c.current_ai_power).toFixed(1)}</td><td className="p-2">{Number(c.prev3_avg_ai_power).toFixed(1)}</td><td className="p-2">{Number(c.prev3_max_ai_power).toFixed(1)}</td><td className="p-2">{Number(c.ai_power_drop_from_peak).toFixed(1)}</td><td className="p-2">{pct(c.result_1d)}</td><td className="p-2">{pct(c.result_3d)}</td><td className="p-2">{pct(c.result_5d)}</td><td className="p-2"><div className="flex gap-2"><Link href={`/analysis/${c.code}`} className="font-black text-blue-600 hover:underline">分析</Link><Link href={`/chart/${c.code}`} className="font-black text-blue-600 hover:underline">チャート</Link></div></td></tr>)}</tbody></table></div>}
   </section>
  </>}
 </div></main>
}
function Metric({l,v}:{l:string;v:number|string}){return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-bold text-slate-500">{l}</p><p className="mt-1 font-black">{v}</p></div>}
