import Link from "next/link";
import type {ReactNode} from "react";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {SCAN_SNAPSHOT_KEY} from "@/app/lib/scanSnapshot";

export const dynamic="force-dynamic";

export default async function AnalysisLayout({children,params}:{
 children:ReactNode;params:Promise<{code:string}>;
}){
 const {isOwner}=await getLearningOwnerSession();
 if(!isOwner)return <>{children}</>;
 const {code}=await params;
 if(!/^[0-9A-Za-z]{4,5}$/.test(code))return <>{children}</>;
 let at:string|null=null;
 try{
  const {rows}=await pool.query<{updated_at:Date|string}>(`
   SELECT d.updated_at FROM public.display_snapshots d
   WHERE d.snapshot_key=$1 AND EXISTS(
    SELECT 1 FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(d.payload->'stocks')='array' THEN d.payload->'stocks' ELSE '[]'::jsonb END
    ) stock WHERE stock->>'code'=$2 AND EXISTS(
      SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(stock->'patternObservations')='array' THEN stock->'patternObservations' ELSE '[]'::jsonb END
      ) pattern WHERE pattern->>'id'='pattern002'
    )
   ) LIMIT 1`,[SCAN_SNAPSHOT_KEY,code]);
  if(rows[0])at=new Date(rows[0].updated_at).toISOString();
 }catch{
  // The optional research link must not block the individual analysis page.
 }
 return <>
  <div className="mx-auto max-w-3xl px-3 pt-3 sm:px-6">
   {at?<Link prefetch={false}
    href={"/admin/shape-precision-audit/replay?code="+encodeURIComponent(code)+"&at="+encodeURIComponent(at)}
    className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-black text-amber-950 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200">
     <span>🔬 参考日足で形を照合 <span className="text-[10px] font-medium">本人専用・ダブルボトム</span></span>
     <span aria-hidden="true">→</span>
   </Link>:<p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">🔬 日足照合：この銘柄のダブルボトム保存記録は現在ありません。</p>}
  </div>
  {children}
 </>;
}
