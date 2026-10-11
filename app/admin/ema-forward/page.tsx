import Link from "next/link";
import pool from "@/app/lib/postgres";
import { headers } from "next/headers";
import { shouldRunForwardOnHost } from "@/app/lib/emaForwardShadowCore.ts";
import { getAdminSession } from "@/app/lib/admin";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const jst=(t:unknown)=>t==null?"—":new Date(Number(t)*1000).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"});
const num=(x:unknown)=>Number(x??0);
const yen=(v:number)=>(v>0?"+":"")+v.toLocaleString("ja-JP",{maximumFractionDigits:2})+"円";
type Trade={code:string;strategy:string;status:string;signal_time:string;entry_time:string|null;exit_time:string|null;entry_price:string|null;exit_price:string|null;exit_reason:string|null;net_pnl_yen:string|null;return_percent:string|null;observed_at:string};
export default async function EmaForwardPage(){
 const {isAdmin}=await getAdminSession();
 if(!isAdmin)return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">管理者専用</h1><Link href="/login" className="text-blue-600">ログイン画面へ</Link></main>;
 let trades:Trade[]=[],state:{code:string;last_bar_time:string|null;halted:boolean;halt_reason:string|null}[]=[],failure="";
 try{
  const [a,b]=await Promise.all([
   pool.query("SELECT code,strategy,status,signal_time,entry_time,exit_time,entry_price,exit_price,exit_reason,net_pnl_yen,return_percent,observed_at FROM ema_forward_shadow_trades ORDER BY id DESC LIMIT 150"),
   pool.query("SELECT code,last_bar_time,halted,halt_reason FROM ema_forward_shadow_state ORDER BY code"),
  ]);
  trades=a.rows as Trade[];state=b.rows;
 }catch(e){failure=e instanceof Error?e.message:"DB read failed";}
 const host=(await headers()).get("host")?.split(":")[0]??"";
 const ready=shouldRunForwardOnHost(host,process.env.EMA_FORWARD_SHADOW_ENABLED,process.env.VERCEL_ENV);
 const completed=trades.filter(x=>x.status==="CLOSED");
 const results=(["TAKE","TIME"] as const).map(strategy=>{
  const records=completed.filter(x=>x.strategy===strategy),profit=records.reduce((s,x)=>s+num(x.net_pnl_yen),0);
  const wins=records.filter(x=>num(x.net_pnl_yen)>0).length;
  return {strategy,completed:records.length,wins,profit,winPct:records.length?Number((100*wins/records.length).toFixed(1)):null};
 });
 const newest=state.map(x=>Number(x.last_bar_time??0)).filter(Boolean).sort((a,b)=>b-a)[0];
 return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
  <div className="mx-auto max-w-5xl">
   <Link href="/admin/ema-stage6" className="text-sm font-bold text-blue-600">← 第6段階・出口戦略研究に戻る</Link>
   <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <p className="text-xs font-black tracking-widest text-violet-600">ADMIN / FORWARD SHADOW ONLY</p>
    <h1 className="mt-2 text-2xl font-black">📡 第7段階・未来の売買成績を追跡</h1>
    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">過去検証の③＋15%利確と④最長20営業日を固定し、今後の確定日足で新しく発生した買いサインだけを保存。翌営業日始値を仮想買付価格として、決済まで追跡します。過去の取引は遡って登録しません。</p>
    <p className="mt-3 text-sm font-bold">{failure?"⚠ DB設定確認待ち":ready?"🟢 定期追跡設定：有効":"🟡 定期追跡設定：無効"}　／　最新観測：{newest?jst(newest):"まだありません"}</p>
    {failure&&<p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">新規の研究用テーブルへの接続確認が必要です。既存AIの成績や通知には影響しません。</p>}
   </section>
   <section className="mt-4 grid gap-3 sm:grid-cols-2">
    {results.map(r=><article key={r.strategy} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
     <h2 className="font-black">{r.strategy==="TAKE"?"③ ＋15%利確":"④ 最長20営業日"}</h2>
     <p className="mt-3 text-xs text-slate-500">今後の確定取引数</p>
     <p className="text-2xl font-black">{r.completed}回</p>
     <p className="mt-3 text-xs text-slate-500">コスト控除後の仮想損益（100株）</p>
     <p className={"text-xl font-black "+(r.profit>=0?"text-emerald-600":"text-red-600")}>{r.completed?yen(r.profit):"—"}</p>
     <p className="mt-2 text-sm">勝率：{r.winPct===null?"—":r.winPct+"%"}／{r.wins}勝</p>
    </article>)}
   </section>
   <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <h2 className="text-lg font-black">📋 保存された観測と取引</h2>
    <p className="mt-1 text-xs text-slate-500">観測銘柄 {state.length}/40、停止・要確認 {state.filter(x=>x.halted).length}銘柄。新規シグナルがまだなければ、取引履歴は空のままで正常です。</p>
    {state.some(x=>x.halted)&&<details className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><summary className="font-bold">停止中の銘柄を見る</summary><p className="mt-2">{state.filter(x=>x.halted).map(x=>x.code+" "+x.halt_reason).join("／")}</p></details>}
    <div className="mt-3 overflow-x-auto">
     <table className="w-full min-w-[640px] text-xs">
      <thead><tr className="border-b text-slate-500"><th className="p-2 text-left">銘柄</th><th className="p-2">戦略</th><th className="p-2">サイン日</th><th className="p-2">買付日</th><th className="p-2">状況</th><th className="p-2">売却日・理由</th><th className="p-2 text-right">損益</th></tr></thead>
      <tbody>{trades.map((r,i)=><tr key={i} className="border-b border-slate-100 dark:border-slate-800">
       <td className="p-2 font-bold">{r.code}</td><td className="p-2">{r.strategy==="TAKE"?"③ 利確":"④ 20日"}</td>
       <td className="p-2">{jst(r.signal_time)}</td><td className="p-2">{jst(r.entry_time)}</td><td className="p-2">{r.status}</td>
       <td className="p-2">{jst(r.exit_time)} {r.exit_reason??""}</td>
       <td className="p-2 text-right font-bold">{r.net_pnl_yen===null?"—":yen(num(r.net_pnl_yen))}</td>
      </tr>)}</tbody>
     </table>
     {!trades.length&&<p className="py-5 text-center text-sm text-slate-500">今後の初回シグナルを待っています。</p>}
    </div>
   </section>
   <p className="mt-4 rounded-xl border p-4 text-xs leading-6 text-slate-500">実験室、AI POWER、通知、紙上取引、注文機能とは完全に独立した観測記録です。片道0.15%の仮定コスト・100株で計算。高値到達での利確は日足による仮定であり実際の約定保証はありません。急な株式分割やデータ欠損が検出された銘柄は追跡を停止し、履歴を捏造しません。過去成績との公平な比較には、将来十分な取引が成立するまで待つ必要があります。</p>
  </div>
 </main>;
}
