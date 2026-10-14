import Link from "next/link";
import {notFound} from "next/navigation";
import pool from "@/app/lib/postgres";
import BottomNav from "@/app/components/BottomNav";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {ENTRY_TIME_SLOTS, summarizeEntryTimes, ENTRY_TIME_SHADOW_VERSION} from "@/app/lib/research/entryTimeShadow.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;
type Entry={time:string;entryPrice:number|null;closePrice:number|null;returnPct:number|null;pnl100:number|null};
type StockResult={code:string;name:string;priorScore:number;rank:number;complete:boolean;closePrice:number|null;entries:Entry[];error?:string};
type DailyRun={trade_date:string;prior_date:string;status:string;cohort:unknown;results:StockResult[];note:string|null};
const yen=(n:number|null)=>n===null?"—":Math.round(n).toLocaleString("ja-JP")+"円";
const pct=(n:number|null)=>n===null?"—":(n>0?"+":"")+n.toFixed(2)+"%";
const signedYen=(n:number|null)=>n===null?"—":(n>0?"+":"")+Math.round(n).toLocaleString("ja-JP")+"円";

export default async function EntryTimingResearchPage(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner) notFound();
  let runs:DailyRun[]=[];let failed=false;
  try {
    const {rows}=await pool.query<DailyRun>(
      "SELECT trade_date::text,prior_date::text,status,cohort,results,note FROM public.entry_time_shadow_runs WHERE policy_version=$1 ORDER BY trade_date DESC LIMIT 60",
      [ENTRY_TIME_SHADOW_VERSION]);
    runs=rows;
  }catch(error){console.error("entry-time shadow archive unavailable",error);failed=true;}
  const completed=runs.flatMap(r=>Array.isArray(r.results)?r.results:[]);
  const eligible=completed.filter(r=>r.complete && r.entries?.length===ENTRY_TIME_SLOTS.length);
  const summary=summarizeEntryTimes(completed);
  const dayCount=new Set(runs.filter(r=>r.status==="COMPLETE").map(r=>r.trade_date)).size;
  const mature=dayCount>=20&&eligible.length>=100;
  return <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-3 px-3 pt-4">
      <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-700">← 学習管理室へ戻る</Link>
      <header className="rounded-2xl border border-blue-100 bg-white p-4">
        <p className="text-xs font-black tracking-widest text-blue-600">OWNER ONLY / SHADOW RESEARCH</p>
        <h1 className="mt-1 text-2xl font-black">⏰ 時間帯別エントリー最適化</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          前日のSIGNALX上位5候補を翌取引日の各時間に100株買えたと仮定。
          同日の大引けに売った場合を、同じ銘柄・同じ決済価格で比較します。
          <b>実際の売買・AI POWER・学習・通知には一切反映しません。</b>
        </p>
      </header>
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">
        自動研究は東証営業日の16:45（日本時間）に最大5銘柄、1日1回だけ実行します。株価はYahooの5分足・各時間足の始値を仮想購入価格に使用します。
        実約定価格とは一致しません。ローソク足が欠けた銘柄は成績から除外します。失敗日の自動再取得なし。
        過去日のSIGNALX候補が無い場合や株価が取得できない場合は推測で補完しません。
      </section>
      <section className="grid grid-cols-3 gap-2">
        {[["研究日数",runs.length+"日"],["完全な比較",eligible.length+"銘柄"],["判定",mature?"暫定比較":"データ収集中"]].map(([label,value])=>
          <div key={label} className="rounded-xl border bg-white p-3 text-center">
            <p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-sm font-black">{value}</p>
          </div>)}
      </section>
      {failed&&<p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">専用研究テーブルを読み込めません。DBの準備・接続状態を確認してください。</p>}
      {!failed&&runs.length===0&&<p className="rounded-xl border bg-white p-4 text-sm">自動保存の初回結果待ちです。初回の条件が揃った取引日の大引け後に蓄積します。</p>}
      <section className="rounded-2xl border bg-white p-3">
        <h2 className="text-lg font-black">📊 同じ候補を6時点で比較</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">同日引けの損益。勝率＝損益がプラスの割合（ゼロは勝ち扱いしない）。手数料・税金・スリッページ・配当を含みません。</p>
        <div className="mt-3 space-y-2">
          {summary.map(slot=><div key={slot.time} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <strong className="text-lg">{slot.time}</strong>
              <span className="text-xs text-slate-500">{slot.samples}件の完全データ</span>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-[10px] text-slate-500">勝率</p><p className="font-black">{slot.winRate===null?"—":slot.winRate.toFixed(1)+"%"}</p></div>
              <div><p className="text-[10px] text-slate-500">100株平均損益</p><p className="font-black">{signedYen(slot.avgHundredSharePnl)}</p></div>
              <div><p className="text-[10px] text-slate-500">最悪騰落率</p><p className="font-black">{pct(slot.worstReturn)}</p></div>
            </div>
          </div>)}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-600">
          {mature?"結果は仮説検証用の暫定データ。今後、別期間でも再検証します。":
          "十分な研究結果が貯まるまで優劣は判定しません（目安：完全日20日・100銘柄以上）。"}
          同日に寄り付いた銘柄だけを後から選ぶことはしていません。
        </p>
      </section>
      <section className="rounded-2xl border bg-white p-3">
        <h2 className="text-lg font-black">💾 自動研究の保存履歴</h2>
        {runs.slice(0,20).map(run=><article key={run.trade_date} className="mt-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>{run.trade_date}（候補基準：{run.prior_date}）</strong>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">{run.status}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">完全：{Array.isArray(run.results)?run.results.filter(x=>x.complete).length:0}銘柄 ／ {run.note??"—"}</p>
          {Array.isArray(run.results)?run.results.map(stock=><div key={stock.code} className="mt-2 border-t pt-2 text-xs">
            <p className="font-bold">{stock.code} {stock.name}（前日AI {stock.priorScore}）{stock.complete?"":" ／ データ不完全"}</p>
            <p className="mt-0.5 text-slate-600">終値参考：{yen(stock.closePrice)}
              {stock.complete?" ／ 9:05仮想損益 "+signedYen(stock.entries.find(e=>e.time==="09:05")?.pnl100??null)+" ／ 11:00 "+signedYen(stock.entries.find(e=>e.time==="11:00")?.pnl100??null):" ／ 成績に含めません"}</p>
          </div>):null}
        </article>)}
      </section>
      <p className="text-xs leading-5 text-slate-500">研究バージョン：{ENTRY_TIME_SHADOW_VERSION}。この第一段階は同日大引けまでの比較であり、翌日・3日・5日保有や11時の再判定ルールはまだ検証していません。</p>
    </div><BottomNav/>
  </main>;
}
