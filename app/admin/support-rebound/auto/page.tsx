import Link from "next/link";
import pool from "@/app/lib/postgres";
import { getAdminSession } from "@/app/lib/admin";
import { setReboundForwardAuto } from "./actions";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const revalidate=0;
const p=(n:unknown)=>Number(n??0);
const fmt=(n:number)=>n.toLocaleString("ja-JP",{maximumFractionDigits:2});
const iso=(t:unknown)=>t?new Date(String(t)).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"}):"—";
type Signal={code:string;signal_day:string;score:number|null;band:string|null;state:string;entry_price:string|null;return_percent:string|null;reason:string|null};
type Batch={trade_date:string;batch:number;state:string;succeeded:number;failed:number;new_signals:number;started_at:string;finished_at:string|null};
export default async function ReboundAutoPage(){
  const {isAdmin}=await getAdminSession();
  if(!isAdmin)return <main className="mx-auto max-w-xl p-8"><h1 className="text-xl font-black">研究管理者専用</h1><Link href="/login" className="text-blue-600">ログイン</Link></main>;
  let enabled=false,error="",signals:Signal[]=[],batches:Batch[]=[];
  let totals:{total:string;closed:string;open:string;review:string;wins:string;bigloss:string;avg:string|null}=
    {total:"0",closed:"0",open:"0",review:"0",wins:"0",bigloss:"0",avg:null};
  try{
    const [switchRes,signalsRes,batchesRes,sumRes]=await Promise.all([
      pool.query<{enabled:boolean}>("SELECT enabled FROM public.rebound_forward_control WHERE singleton=1"),
      pool.query<Signal>("SELECT code,signal_day::text,score,band,state,entry_price::text,return_percent::text,reason "+
        "FROM public.rebound_forward_signals ORDER BY signal_day DESC,id DESC LIMIT 60"),
      pool.query<Batch>("SELECT trade_date::text,batch,state,succeeded,failed,new_signals,started_at,finished_at "+
        "FROM public.rebound_forward_daily_batches ORDER BY trade_date DESC,batch LIMIT 20"),
      pool.query("SELECT count(*)::text AS total, "+
        "count(*) FILTER(WHERE state='CLOSED')::text closed,"+
        "count(*) FILTER(WHERE state IN('PENDING','OPEN'))::text open,"+
        "count(*) FILTER(WHERE state='REVIEW')::text review,"+
        "count(*) FILTER(WHERE state='CLOSED' AND return_percent>0)::text wins,"+
        "count(*) FILTER(WHERE state='CLOSED' AND return_percent<=-5)::text bigloss,"+
        "round(avg(return_percent) FILTER(WHERE state='CLOSED'),2)::text avg "+
        "FROM public.rebound_forward_signals"),
    ]);
    enabled=switchRes.rows[0]?.enabled===true;signals=signalsRes.rows;batches=batchesRes.rows;totals=sumRes.rows[0]??totals;
  }catch{error="研究専用テーブルがまだ適用されていないか、DBへの接続に失敗しています。自動取得は停止状態です。";}
  const closed=p(totals.closed);
  return <main className="min-h-screen bg-slate-50 p-3 text-slate-900">
    <div className="mx-auto max-w-5xl py-5">
      <Link href="/admin/support-rebound" className="text-sm font-bold text-blue-600">← 支持線反発研究に戻る</Link>
      <header className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-black tracking-widest text-indigo-700">OWNER ONLY / FUTURE SHADOW AUTO</p>
        <h1 className="mt-2 text-2xl font-black">🤖 ③ 毎営業日の自動研究</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">日本株100銘柄を50件ずつ、平日16:45・17:05（日本時間）に自動取得。JPX休日は停止し、当日確定日足以外は新しい予測として記録しません。毎日のサイン日時・スコアを固定し、翌営業日始値→5営業日後始値の仮想成績を照合します。</p>
        {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <p className="mt-3 text-lg font-black">{error?"🔴 未準備":enabled?"🟢 自動研究：有効":"🟡 自動研究：停止中"}</p>
        {!error&&<form action={setReboundForwardAuto} className="mt-3 flex flex-wrap items-center gap-2">
          <button name="enabled" value={enabled?"off":"on"} type="submit"
            className={"rounded-xl px-5 py-3 text-sm font-bold text-white "+(enabled?"bg-rose-700":"bg-indigo-700")}>
            {enabled?"自動研究を安全停止":"自動研究を有効にする"}
          </button>
          <span className="text-xs text-slate-500">停止しても保存済みの研究結果は削除されません。</span>
        </form>}
      </header>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["未来サイン保存",totals.total+"件"],["結果確定",totals.closed+"件"],
          ["結果待ち",totals.open+"件"],["要確認",totals.review+"件"],
          ["確定後の勝率",closed?fmt(100*p(totals.wins)/closed)+"%":"—"],
          ["-5%以下の大損",closed?fmt(100*p(totals.bigloss)/closed)+"%":"—"],
          ["平均騰落率",totals.avg===null?"—":(p(totals.avg)>0?"+":"")+totals.avg+"%"],
        ].map(([label,value])=><div className="rounded-xl border border-slate-200 bg-white p-3" key={label}>
          <p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-black">{value}</p>
        </div>)}
      </div>
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-black">📅 日々の取得結果（直近20バッチ）</h2>
        <p className="mt-1 text-xs text-slate-500">各回50銘柄。成功50・失敗0で正常。失敗や途中停止があった日は自動で過去分を予測実績として補いません。</p>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[570px] text-left text-sm">
          <thead><tr className="bg-slate-100"><th className="p-2">取引日</th><th className="p-2">回</th><th className="p-2">状態</th><th className="p-2">成功</th><th className="p-2">失敗</th><th className="p-2">新③</th><th className="p-2">終了（JST）</th></tr></thead>
          <tbody>{batches.map(b=><tr className="border-t" key={b.trade_date+"-"+b.batch}>
            <td className="p-2">{b.trade_date}</td><td className="p-2">{b.batch+1}</td><td className="p-2">{b.state}</td>
            <td className="p-2">{b.succeeded}/50</td><td className="p-2">{b.failed}</td><td className="p-2">{b.new_signals}</td>
            <td className="p-2">{iso(b.finished_at)}</td></tr>)}</tbody>
        </table>{!batches.length&&<p className="mt-3 text-sm text-slate-500">稼働開始後の初回実行待ちです。</p>}</div>
      </section>
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-black">📊 記録された③（新しい順・最大60件）</h2>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[510px] text-left text-sm">
          <thead><tr className="bg-slate-100"><th className="p-2">銘柄</th><th className="p-2">サイン日</th><th className="p-2">点数</th><th className="p-2">状態</th><th className="p-2">結果</th></tr></thead>
          <tbody>{signals.map((s,i)=><tr className="border-t" key={s.code+s.signal_day+i}>
            <td className="p-2"><Link href={"/chart/"+s.code} className="font-bold text-blue-600">{s.code} ↗</Link></td>
            <td className="p-2">{s.signal_day}</td><td className="p-2">{s.score??"不明"}</td>
            <td className="p-2">{s.state==="REVIEW"?"要確認":s.state==="CLOSED"?"確定":s.state==="OPEN"?"保有中":"購入待ち"}</td>
            <td className="p-2">{s.return_percent===null?s.reason??"—":(p(s.return_percent)>0?"+":"")+fmt(p(s.return_percent))+"%"}</td>
          </tr>)}</tbody>
        </table>{!signals.length&&<p className="mt-3 text-sm text-slate-500">新しいサインが出るまで0件で正常です。</p>}</div>
      </section>
      <p className="mt-4 text-xs leading-6 text-slate-500">研究専用。実売買、疑似売買、AI POWER、LINE通知、既存の検証済み勝率に影響しません。100銘柄・最大100件/営業日のYahoo株価取得（約2,000回/月）、外部データとVercelの従量コストが発生する可能性があります。二重実行・休日の取得は防止しますが、通信障害やProvider側制限では失敗が記録されます。スコアは大損確率ではありません。Chrome端末内の記録とは別のサーバー記録です。</p>
    </div>
  </main>;
}
