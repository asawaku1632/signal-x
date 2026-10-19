import Link from "next/link";
import {notFound} from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {ENTRY_TIME_SHADOW_VERSION} from "@/app/lib/research/entryTimeShadow.mjs";
import {
  NIGHT_MORNING_POLICY, NIGHT_MORNING_MIN_SAMPLES,NIGHT_MORNING_MIN_DAYS,
  nightMorningTradingDates,buildNightMorningCandidates,summarizeNightMorningEvidence
} from "@/app/lib/research/nightMorningWatch.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;

type SavedRow={code:string;name:string;score:number|string;price:number|string};
type NightMorningCandidate={
  code:string;name:string;score:number;referencePrice:number;rank:number;band:string
};
type StudyRun={trade_date:string;results:unknown};
type Evidence={
  band:string;count:number;wins:number;days:number;sufficient:boolean;
  observedPositiveRate:number|null;avgPnl100:number|null
};
const yen=(n:number)=>Math.round(n).toLocaleString("ja-JP")+"円";
const signedYen=(n:number)=>(n>0?"+":"")+yen(n);

export default async function NightMorningWatchPage(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();

  let sourceDate:string|null=null;
  let tradeDate:string|null=null;
  let dateError=false;
  try {
    const dates=nightMorningTradingDates(new Date(),isTseTradingDate);
    sourceDate=dates.sourceDate;
    tradeDate=dates.tradeDate;
  }catch(error){
    console.error("Night morning trading calendar unavailable",error);
    dateError=true;
  }

  let rows:SavedRow[]=[];
  let runs:StudyRun[]=[];
  let candidateReadError=false;
  let evidenceReadError=false;
  if(sourceDate&&tradeDate){
    try {
      const response=await pool.query<SavedRow>(
        "SELECT code,name,score,price FROM public.daily_stock_results "+
        "WHERE date=$1 AND score>=85 AND price>0 AND code ~ '^[0-9]{4}$' "+
        "ORDER BY score DESC,code ASC LIMIT 5",[sourceDate]);
      rows=response.rows;
    }catch(error){
      console.error("Night morning saved results unavailable",error);
      candidateReadError=true;
    }
    try {
      const response=await pool.query<StudyRun>(
        "SELECT trade_date::text,results FROM public.entry_time_shadow_runs "+
        "WHERE policy_version=$1 AND trade_date<$2::date "+
        "ORDER BY trade_date DESC LIMIT 60",
        [ENTRY_TIME_SHADOW_VERSION,tradeDate]);
      runs=response.rows;
    }catch(error){
      console.error("Night morning research history unavailable",error);
      evidenceReadError=true;
    }
  }

  const candidates:NightMorningCandidate[]=candidateReadError?[]:buildNightMorningCandidates(rows);
  const evidence:Evidence[]=evidenceReadError||!tradeDate?[]:
    summarizeNightMorningEvidence(runs,tradeDate);
  const byBand=new Map(evidence.map(e=>[e.band,e]));
  const samples=evidence.reduce((sum,e)=>sum+e.count,0);
  const hasError=dateError||candidateReadError;

  return <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-3 px-3 pt-4">
      <Link href="/admin/learning-hub" className="text-sm font-black text-blue-700">
        ← 学習管理室へ戻る
      </Link>
      <header className="rounded-2xl border border-indigo-200 bg-white p-4">
        <p className="text-[11px] font-black tracking-widest text-indigo-600">OWNER PRIVATE / NIGHT WATCH / SHADOW ONLY</p>
        <h1 className="mt-2 text-2xl font-black">🌙 翌朝9時・勝率重視候補</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          夜に確認できる、翌取引日の朝向けAI候補。前営業日に保存された
          AI POWER 85以上の上位5銘柄を表示します。価格とAI順位は
          <strong>前営業日の保存値</strong>であり、翌朝の購入価格ではありません。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">判定元の保存日</p>
            <p className="mt-1 text-base font-black">{sourceDate??"—"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">翌朝の研究対象日</p>
            <p className="mt-1 text-base font-black">{tradeDate??"—"}</p>
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          保存日の切替は東証営業日の18:00（日本時間）以降。該当日の保存データが
          まだなければ、古い候補で穴埋めせず空欄にします。
        </p>
      </header>

      <section className="rounded-2xl border border-violet-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black">🔎 前夜時点の注目候補</h2>
          <span className="text-xs font-bold text-violet-700">{candidates.length} / 最大5銘柄</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          AI POWER順の参考リストです。順位は「翌朝の勝率順」ではありません。
          9:00ちょうどの仮想約定値は未保存のため、答え合わせは9:05の5分足始値から同日大引けまでで行います。
        </p>
        {hasError?<p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">
          {dateError?"営業日カレンダーを確認できません。":"前夜の保存データを読み込めません。"}
          推測した候補は表示しません。
        </p>:null}
        {!hasError&&candidates.length===0?<p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6">
          この日付の保存データが未完了か、AI POWER 85以上の対象銘柄がありません。
          保存後に再表示してください。
        </p>:null}
        {!hasError&&candidates.length>0?<div className="mt-3 space-y-2">
          {candidates.map(stock=>{
            const past=byBand.get(stock.band);
            return <div key={stock.code} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-slate-500">参考順位 {stock.rank}位</p>
                  <p className="mt-0.5 text-base font-black">{stock.code} {stock.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">前日AI POWER</p>
                  <p className="text-xl font-black text-indigo-700">{stock.score}</p>
                </div>
              </div>
              <p className="mt-2 text-sm">
                保存参考価格 <b>{yen(stock.referencePrice)}</b>
                <span className="ml-2 text-slate-600">100株参考額 {yen(stock.referencePrice*100)}</span>
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                過去の同スコア帯（AI {stock.band}）：
                {evidenceReadError?"記録を読めません":
                  past?.sufficient?
                    "9:05→引けのプラス率 "+past.observedPositiveRate?.toFixed(1)+"%（"+past.wins+"/"+past.count+"件、"+past.days+"営業日）":
                    "検証不足（"+(past?.count??0)+"件 / "+(past?.days??0)+"営業日）"}
              </p>
              <p className="mt-1 text-[11px] text-amber-800">
                このプラス率は過去の観測値で、翌朝の的中確率を示す数字ではありません。
              </p>
              <div className="mt-2 flex gap-5 text-sm font-bold">
                <Link href={"/analysis/"+stock.code} className="text-blue-700">個別解析 →</Link>
                <Link href={"/chart/"+stock.code} className="text-blue-700">チャート →</Link>
              </div>
            </div>;
          })}
        </div>:null}
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">📊 過去の答え合わせ</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          前日AI上位5候補のうち、9:05・その他5時刻・大引け価格が
          すべて保存できた銘柄日だけ集計。同じ銘柄を複数日で観測した場合は別件です。
          {evidenceReadError?" 現在、研究履歴を取得できていません。":""}
        </p>
        <p className="mt-2 text-sm font-bold">検証可能 {evidenceReadError?"—":samples+"件"} 
          <span className="ml-2 text-xs font-normal text-slate-500">
            最低目安：各スコア帯{NIGHT_MORNING_MIN_SAMPLES}件・{NIGHT_MORNING_MIN_DAYS}営業日
          </span>
        </p>
        {!evidenceReadError&&<div className="mt-3 space-y-2">
          {evidence.map(b=><div key={b.band} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <div><b>AI {b.band}</b><p className="mt-1 text-xs text-slate-500">{b.count}件・{b.days}営業日</p></div>
            <div className="text-right">
              <b>{b.sufficient?b.observedPositiveRate?.toFixed(1)+"%":"検証不足"}</b>
              {b.sufficient&&b.avgPnl100!==null?<p className="mt-1 text-xs text-slate-500">平均100株 {signedYen(b.avgPnl100)}</p>:null}
            </div>
          </div>)}
        </div>}
        <Link href="/admin/entry-time-shadow" className="mt-3 block text-sm font-bold text-blue-700">
          時間帯別エントリー研究・詳細を見る →
        </Link>
      </section>

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">
        ⚠ これは管理者専用の読み取り研究です。AIの前日スコアだけでは
        翌朝の利益を高確率で予測できると確認されていません。
        過去のスコア帯実績も小標本・選択偏りがあり、実際の9:00約定、
        寄り付きの気配・急変動・値幅制限、手数料・税・スリッページは考慮していません。
        候補は画面を開いた時点の保存データで、夜間の不変スナップショットとしては
        まだ固定されていません。学習・通知・ランキング・実売買は変更しません。
      </p>
      <p className="px-1 text-[10px] text-slate-500">{NIGHT_MORNING_POLICY}</p>
    </div>
    <BottomNav />
  </main>;
}
