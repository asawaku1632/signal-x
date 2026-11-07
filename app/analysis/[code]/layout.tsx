import Link from "next/link";
import type {ReactNode} from "react";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {SCAN_SNAPSHOT_KEY} from "@/app/lib/scanSnapshot";
import {shapeDirectionGuide} from "@/app/lib/research/shapeReferenceMarks.mjs";
import {chartPatternCatalog} from "@/app/lib/chartPatternCatalog";
export const dynamic="force-dynamic";
export default async function AnalysisLayout({children,params}:{children:ReactNode;params:Promise<{code:string}>;}){
 const {isOwner}=await getLearningOwnerSession();
 if(!isOwner)return <>{children}</>;
 const {code}=await params;
 if(!/^[0-9A-Za-z]{4,5}$/.test(code))return <>{children}</>;
 let at:string|null=null;
 let patternIds:string[]=[];
 let unavailable=false;
 try{
  const {rows}=await pool.query<{updated_at:Date|string;patterns:unknown}>(`
   SELECT d.updated_at,stock->'patternObservations' patterns
   FROM public.display_snapshots d CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(d.payload->'stocks')='array' THEN d.payload->'stocks' ELSE '[]'::jsonb END
   ) stock WHERE d.snapshot_key=$1 AND stock->>'code'=$2 LIMIT 1`,[SCAN_SNAPSHOT_KEY,code]);
  if(rows[0]){
   at=new Date(rows[0].updated_at).toISOString();
   const items=Array.isArray(rows[0].patterns)?rows[0].patterns:[];
   const known=new Set(chartPatternCatalog.map(p=>p.id));
   patternIds=[...new Set(items.flatMap((p:unknown)=>p&&typeof p==="object"&&"id" in p&&typeof p.id==="string"&&known.has(p.id)?[p.id]:[]))];
  }
 }catch{unavailable=true;}
 return <>
  <div className="mx-auto max-w-3xl px-3 pt-3 sm:px-6">
   <Link prefetch={false} href={"/admin/new-buy-events?code="+encodeURIComponent(code)} className="mb-2 block rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">🟢 この銘柄の新規買い条件・成立記録 →</Link>
   {at&&patternIds.length?<details className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200">
    <summary className="min-h-8 cursor-pointer font-black">🔬 参考日足で形を照合（{patternIds.length}種類）<span className="ml-2 text-[10px] font-medium">本人専用・開く</span></summary>
    <p className="mt-1 text-xs">保存された形を選んで、参考チャート・条件・その後を確認</p>
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
     {patternIds.map(id=>{const p=chartPatternCatalog.find(p=>p.id===id)!;const guide=shapeDirectionGuide(p.direction);return <Link key={id} prefetch={false}
      href={"/admin/shape-precision-audit/replay?code="+encodeURIComponent(code)+"&at="+encodeURIComponent(at!)+"&pattern="+encodeURIComponent(id)}
      className="flex min-h-11 items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-bold dark:border-amber-800 dark:bg-slate-800">
      <span className="flex min-w-0 flex-wrap items-center gap-2"><span className={"rounded-full px-2 py-1 text-[10px] "+guide.badge}>{guide.short}</span><span>{p.name}</span></span><span aria-hidden="true">→</span>
     </Link>;})}
    </div>
   </details>:<p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">🔬 日足照合：{unavailable?"保存記録を取得できませんでした。":"この銘柄の形状保存記録は現在ありません。"}</p>}
  </div>{children}
 </>;
}
