import Link from "next/link";
import {notFound} from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {nightMorningTradingDates} from "@/app/lib/research/nightMorningWatch.mjs";
import {
  MORNING_FINAL_POLICY,MIN_MATCHED_STOCK_DAYS,MIN_OBSERVED_DAYS,
  LABELS,summarizeForwardResearch
} from "@/app/lib/research/morningFinalCheck.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;
type Frozen={code:string;name:string;score:number;referencePrice:number;rank:number};
type Observation={code:string;label:string;reasons:string[];
  open0900:number|null;price0905:number|null;gapPct:number|null;
  rangePct:number|null;movePct:number|null;volume0900:number|null};
type Outcome={code:string;complete:boolean;pnl100?:number;
  observedEntry?:number;closePrice?:number;reason?:string};
type DbRow={trade_date:string;prior_date:string;policy_version:string;
  frozen_at:string;cohort:Frozen[];morning_state:string;
  morning_observations:Observation[];morning_saved_at:string|null;
  closing_state:string;closing_results:Outcome[];closing_saved_at:string|null;
  note:string|null};
type Stats={samples:number;days:number;sufficient:boolean;
  allPnl100:number|null;gatedPnl100:number|null;
  avoidedLoss100:number|null;missedProfit100:number|null;
  labels:{label:string;count:number;wins:number;positiveRate:number|null;
    avgPnl100:number|null}[]};

const money=(n:number|null|undefined)=>typeof n!=="number"||!Number.isFinite(n)?
  "—":Math.round(n).toLocaleString("ja-JP")+"円";
const signedMoney=(n:number|null|undefined)=>typeof n!=="number"||!Number.isFinite(n)?
  "—":(n>0?"+":"")+money(n);
const percent=(n:number|null|undefined)=>typeof n!=="number"||!Number.isFinite(n)?
  "—":(n>0?"+":"")+n.toFixed(2)+"%";
const status:Record<string,string>={
  PENDING:"時刻待ち",CLAIMED:"処理中",COMPLETE:"保存済み",
  PARTIAL:"一部データ不足",FAILED:"取得・保存エラー"};
const tones:Record<string,string>={
  BUY_CANDIDATE:"border-emerald-200 bg-emerald-50 text-emerald-900",
  CAUTION:"border-amber-200 bg-amber-50 text-amber-950",
  SKIP:"border-rose-200 bg-rose-50 text-rose-900",
  UNAVAILABLE:"border-slate-200 bg-slate-100 text-slate-700"};

export default async function MorningFinalCheckPage(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();

  let target:string|null=null;
  let dateError=false;
  try{target=nightMorningTradingDates(new Date(),isTseTradingDate).tradeDate;}
  catch(error){console.error("morning study calendar unavailable",error);dateError=true;}
  let today:DbRow|null=null;
  let history:DbRow[]=[];
  let dataError=false;
  if(target){
    try{
      const current=await pool.query<DbRow>(
        "SELECT trade_date::text,prior_date::text,policy_version,frozen_at::text,"+
        "cohort,morning_state,morning_observations,morning_saved_at::text,"+
        "closing_state,closing_results,closing_saved_at::text,note "+
        "FROM public.morning_final_check_runs "+
        "WHERE trade_date=$1::date AND policy_version=$2",[target,MORNING_FINAL_POLICY]);
      today=current.rows[0]??null;
      const recent=await pool.query<DbRow>(
        "SELECT trade_date::text,prior_date::text,policy_version,frozen_at::text,"+
        "cohort,morning_state,morning_observations,morning_saved_at::text,"+
        "closing_state,closing_results,closing_saved_at::text,note "+
        "FROM public.morning_final_check_runs "+
        "WHERE trade_date<$1::date AND policy_version=$2 "+
        "ORDER BY trade_date DESC LIMIT 90",[target,MORNING_FINAL_POLICY]);
      history=recent.rows;
    }catch(error){console.error("morning final archive unavailable",error);dataError=true;}
  }
  const stats:Stats=summarizeForwardResearch(dataError?[]:history);
  const observations=new Map((Array.isArray(today?.morning_observations)?
    today.morning_observations:[]).map(m=>[String(m.code),m]));
  const outcomes=new Map((Array.isArray(today?.closing_results)?
    today.closing_results:[]).map(m=>[String(m.code),m]));
  const cohort=Array.isArray(today?.cohort)?today.cohort:[];
  const morningLabels=Array.from(observations.values()).reduce<Record<string,number>>(
    (a,r)=>({...a,[r.label]:(a[r.label]??0)+1}),{});
  return <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-3 px-3 pt-4">
      <Link href="/admin/learning-hub" className="text-sm font-black text-blue-700">
        ← 学習管理室へ戻る
      </Link>
      <header className="rounded-2xl border border-indigo-200 bg-white p-4">
        <p className="text-xs font-black tracking-widest text-indigo-600">
          OWNER PRIVATE / FORWARD STUDY ONLY
        </p>
        <h1 className="mt-1 text-2xl font-black">☀️ 朝9:05 最終チェック</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          前夜に固定した同じ最大5銘柄を、最初の5分足を使って
          「買い候補・注意・見送り」に仮分類します。
          <strong>実売買の推奨や翌朝の勝率予測ではありません。</strong>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">研究対象日</p>
            <p className="mt-1 font-black">{target??"—"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">前夜固定候補</p>
            <p className="mt-1 font-black">{cohort.length}銘柄</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-600">
          夜18:10固定 → 翌営業日9:08ごろ朝判定 → 同日17:05に大引け照合。
          無料価格データは遅延する場合があり、時刻通りに確認できなければ「データ不足」です。
          9:05の値は5分足の始値による参考値で、実際の約定価格ではありません。
        </p>
      </header>

      {dateError||dataError?<section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800" role="alert">
        {dateError?"営業日カレンダーが確認できません。":"専用研究データを読み込めません。DBの準備と接続を確認してください。"}
        過去の候補や推定価格で埋め合わせません。
      </section>:null}

      {!dateError&&!dataError&&!today?<section className="rounded-2xl border bg-white p-4">
        <h2 className="font-black">まだ前夜固定記録がありません</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          この研究は導入後、前営業日の18:10に実際に保存できた候補から開始します。
          すでに過ぎた朝の9:05判定を後付けで作ることはしません。
        </p>
      </section>:null}

      {today&&<section className="rounded-2xl border bg-white p-3">
        <h2 className="text-lg font-black">📋 今日の研究状況</h2>
        <p className="mt-1 text-xs text-slate-500">
          前夜保存日 {today.prior_date} / 固定 {today.frozen_at?.slice(0,16)??"—"} UTC
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">9:05朝判定</p>
            <p className="mt-1 text-sm font-black">{status[today.morning_state]??"確認待ち"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">大引け答え合わせ</p>
            <p className="mt-1 text-sm font-black">{status[today.closing_state]??"確認待ち"}</p>
          </div>
        </div>
        {today.morning_state!=="PENDING"&&<p className="mt-3 text-xs font-semibold">
          🟢 買い候補 {morningLabels.BUY_CANDIDATE??0}件　
          🟡 注意 {morningLabels.CAUTION??0}件　
          🔴 見送り {morningLabels.SKIP??0}件　
          ⚪ 不足 {morningLabels.UNAVAILABLE??0}件
        </p>}
        <div className="mt-3 space-y-2">
          {cohort.map(stock=>{
            const o=observations.get(stock.code),out=outcomes.get(stock.code);
            return <div key={stock.code} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] text-slate-500">前夜固定 {stock.rank}位</p>
                  <p className="mt-1 text-lg font-black">{stock.code} {stock.name}</p>
                </div>
                <span className="text-sm font-black text-indigo-700">AI {stock.score}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                前日参考 {money(stock.referencePrice)} / 100株参考額 {money(stock.referencePrice*100)}
              </p>
              <div className={"mt-3 rounded-lg border p-3 text-sm "+(tones[o?.label??"UNAVAILABLE"]??tones.UNAVAILABLE)}>
                <p className="font-black">{o?LABELS[o.label as keyof typeof LABELS]??"データ不足":"朝の判定待ち"}</p>
                {o?<><p className="mt-1 text-xs">
                  9:00 始値 {money(o.open0900)} / 9:05参考 {money(o.price0905)} / 前日比 {percent(o.gapPct)}
                </p>
                <p className="mt-1 text-xs">
                  5分間変化 {percent(o.movePct)} / 値幅 {percent(o.rangePct)} / 出来高 {o.volume0900===null?"—":o.volume0900.toLocaleString("ja-JP")}
                </p>
                <p className="mt-2 text-xs">{Array.isArray(o.reasons)?o.reasons.join("・"):""}</p></>:null}
              </div>
              {out?.complete?<p className="mt-2 text-xs font-bold">
                引け {money(out.closePrice)} ／ 100株仮想損益 {signedMoney(out.pnl100)}
                {o?.label==="BUY_CANDIDATE"?"（購入候補として集計）":"（見送り時の参考結果）"}
              </p>:today.closing_state!=="PENDING"?
                <p className="mt-2 text-xs text-slate-500">引け照合：データ不足・比較対象外</p>:null}
              <div className="mt-3 flex gap-5 text-sm font-bold">
                <Link href={"/analysis/"+stock.code} className="text-blue-700">個別解析 →</Link>
                <Link href={"/chart/"+stock.code} className="text-blue-700">チャート →</Link>
              </div>
            </div>;
          })}
        </div>
      </section>}

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">📊 朝判定は本当に役立つ？</h2>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          事前に保存された判定だけを使って、同じ銘柄・同じ日・同じ終値で比較。
          朝9:05に全件買った場合と、🟢だけ買った場合を比べます。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">比較できた銘柄日</p>
            <p className="mt-1 text-lg font-black">{stats.samples}件</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">研究日数</p>
            <p className="mt-1 text-lg font-black">{stats.days}営業日</p>
          </div>
        </div>
        {!stats.sufficient?<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          検証中（目安：{MIN_MATCHED_STOCK_DAYS}件・{MIN_OBSERVED_DAYS}営業日）。
          小標本の勝率や損益で優劣を断定しません。
        </p>:<div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
          <p>全件仮想購入の合計 {signedMoney(stats.allPnl100)}</p>
          <p>🟢だけ仮想購入の合計 {signedMoney(stats.gatedPnl100)}</p>
          <p>見送りで回避できた損失 {signedMoney(stats.avoidedLoss100)}</p>
          <p>見送りで逃した利益 {signedMoney(stats.missedProfit100)}</p>
        </div>}
        {stats.labels.map(item=><div key={item.label} className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
          <div><b>{LABELS[item.label as keyof typeof LABELS]}</b>
            <p className="text-xs text-slate-500">{item.count}件</p></div>
          <div className="text-right font-black">
            {stats.sufficient&&item.positiveRate!==null?item.positiveRate.toFixed(1)+"%":"検証不足"}
            {stats.sufficient&&item.avgPnl100!==null?<p className="text-xs text-slate-500">
              100株平均 {signedMoney(item.avgPnl100)}</p>:null}
          </div>
        </div>)}
        <Link href="/admin/night-morning-watch" className="mt-3 block text-sm font-bold text-blue-700">
          🌙 前夜候補のページに戻る →
        </Link>
      </section>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">
        ⚠ 研究専用・自動売買なし。前日AIスコアや5分足から将来利益を保証できません。
        板の厚さ・スプレッド・寄付き未成立・売買停止・約定可否・手数料・税・スリッページは
        検証していません。判定は朝の取得に成功した参考価格だけに基づき、
        欠損は見送り扱いにしません。買値と実際の約定値は異なります。
        本研究は既存のAI評価、学習、通知、スキャン、実注文には接続しません。
      </p>
      <p className="text-[10px] text-slate-500">{MORNING_FINAL_POLICY}</p>
    </div>
    <BottomNav/>
  </main>;
}
