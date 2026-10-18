import Link from "next/link";
import {notFound} from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";

export const dynamic="force-dynamic";
export const revalidate=0;
export const runtime="nodejs";
type Event={id:string;date:string;previous_date:string;index_return:number|string;selected_at:string;version:string};
type Row={code:string;name:string;category:"RESISTANCE"|"REBOUND_WATCH";rank:number;
 price:number|string;relative_return:number|string;daily_return:number|string;
 status:string|null;next_date:string|null;next_return:number|string|null;excess_return:number|string|null;beat:boolean|null};
const fmt=(value:number|string|null)=>value===null?"未観測":(Number(value)>0?"+":"")+Number(value).toFixed(2)+"%";
const yen=(value:number|string)=>Math.round(Number(value)*100).toLocaleString("ja-JP")+"円";
export default async function CrashForwardPage(){
 const {isOwner}=await getLearningOwnerSession();
 if(!isOwner)notFound();
 const all=await pool.query<Event>(`
   SELECT id,trade_date::text AS date,previous_trade_date::text AS previous_date,
     nikkei_day_return AS index_return,selected_at,captured_version AS version
   FROM public.crash_forward_events ORDER BY trade_date DESC LIMIT 12`);
 const events=all.rows;
 let rows:Row[]=[];
 if(events[0]){
  const r=await pool.query<Row>(`
    SELECT c.code,c.name,c.category,c.rank,c.signal_close AS price,
      c.excess_return AS relative_return,c.daily_return,
      o.status,o.next_trade_date::text AS next_date,
      o.stock_return AS next_return,o.excess_return,o.beat_nikkei AS beat
    FROM public.crash_forward_candidates c
    LEFT JOIN public.crash_forward_outcomes o ON o.candidate_id=c.id
    WHERE c.event_id=$1 ORDER BY c.category,c.rank`,[events[0].id]);
  rows=r.rows;
 }
 const latest=events[0];
 const kinds=[
  {id:"RESISTANCE",title:"🟢 暴落耐性型",description:"急落日でも日経平均より相対的に強かった銘柄"},
  {id:"REBOUND_WATCH",title:"🔄 急反発候補型",description:"急落日に市場以上に売られ、翌取引日の反発を確認する銘柄"},
 ] as const;
 return <main className="min-h-screen bg-slate-50 px-3 pb-28 pt-4 text-slate-950">
  <div className="mx-auto max-w-5xl space-y-3">
   <Link href="/admin/crash-strength" className="font-black text-blue-700">← 暴落後ランキングへ戻る</Link>
   <header className="rounded-2xl border border-blue-100 bg-white p-4">
    <p className="text-xs font-black tracking-widest text-indigo-700">OWNER PRIVATE / FROZEN FORWARD STUDY</p>
    <h1 className="mt-2 text-2xl font-black">📋 暴落研究・事前固定検証</h1>
    <p className="mt-2 text-sm leading-6 text-slate-600">
      実際の暴落日に候補・価格・時刻を独立保存し、その後の翌取引日の結果を照合します。
      株価の保存参考終値であり、実際の売買価格や利益は保証しません。</p>
   </header>
   {!latest?<section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
    <h2 className="text-lg font-black">次の暴落日を待っています</h2>
    <p className="mt-2 text-sm leading-6">現時点で事前保存された暴落候補はありません。過去のランキングを事後的に「事前予測」として登録することはしません。</p>
    <p className="mt-2 text-xs">条件：当日の日経平均−2%以上／株価保存800銘柄以上／平日16:55以降に自動判定。</p>
   </section>:<>
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
     <h2 className="text-lg font-black">最新の事前固定日：{latest.date}</h2>
     <p className="mt-1 text-sm">日経平均 <span className="font-black text-rose-700">{fmt(latest.index_return)}</span></p>
     <p className="mt-1 text-xs text-slate-500">候補固定時刻：{new Date(latest.selected_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})} ／ {latest.version}</p>
     <p className="mt-2 text-xs text-slate-600">過去の固定記録：{events.length}日（最大12日表示）</p>
    </section>
    {kinds.map(kind=>{
     const stocks=rows.filter(r=>r.category===kind.id);
     const observed=stocks.filter(r=>r.status==="OBSERVED");
     const winners=observed.filter(r=>r.beat).length;
     const average=observed.length?observed.reduce((s,r)=>s+Number(r.excess_return),0)/observed.length:null;
     return <section key={kind.id} className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-xl font-black">{kind.title}</h2>
      <p className="mt-1 text-xs text-slate-500">{kind.description}</p>
      <p className="mt-2 text-xs">固定 {stocks.length}銘柄 ／ 検証済 {observed.length}銘柄 ／ 市場を上回った {winners}銘柄</p>
      {observed.length>0&&<p className="mt-1 text-sm font-black">平均市場超過 {fmt(average)}</p>}
      <div className="mt-3 divide-y divide-slate-100">
       {stocks.map(item=><div key={item.code} className="grid grid-cols-[minmax(0,1fr)_80px] gap-2 py-3">
        <div className="min-w-0">
         <p className="text-sm font-black">{item.rank}. {item.name} <span className="font-normal text-slate-500">({item.code})</span></p>
         <p className="mt-1 text-xs text-slate-500">100株参考額 {yen(item.price)} ／ 暴落日 {fmt(item.daily_return)}</p>
         <p className="text-xs text-slate-500">翌日：{item.status==="OBSERVED"?fmt(item.next_return):item.status==="REVIEW_PRICE_JUMP"?"急変動・要精査":item.status==="MISSING_PRICE"?"株価欠損":"検証待ち"}</p>
        </div>
        <div className="text-right">
         <p className={"text-sm font-black "+(Number(item.relative_return)>=0?"text-emerald-700":"text-rose-700")}>
          {fmt(item.relative_return)}</p>
         <Link href={"/chart/"+item.code} className="mt-1 block text-xs font-black text-blue-700">CHART →</Link>
        </div>
       </div>)}
      </div>
     </section>;
    })}
   </>}
   <p className="rounded-xl bg-blue-50 p-3 text-xs leading-6 text-slate-600">
    研究専用・取引と通知への接続なし。少数日の結果は精度保証ではありません。
    株式分割、ストップ高・ストップ安、寄付き約定、価格修正は別途検証が必要です。</p>
  </div>
  <BottomNav/>
 </main>;
}
