import Link from "next/link";
import {notFound} from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {nightMorningTradingDates} from "@/app/lib/research/nightMorningWatch.mjs";
import {
  WEAK_REBOUND_VERSION,WEAK_REBOUND_MIN_DAYS,WEAK_REBOUND_MIN_STOCK_DAYS,
  summarizeWeakOutcomes
} from "@/app/lib/research/weakAiRebound.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;

type Frozen={code:string;name:string;score:number;referencePrice:number;bucket:string;rank:number};
type DbRun={entry_date:string;source_date:string;cohort:Frozen[];
  frozen_at:string;entry_state:string;entry_finished_at:string|null;note:string|null};
type Position={entry_date:string;code:string;name:string;rank:number;
  ai_power:number|string;ai_bucket:string;prior_price:number|string;
  entry_status:string;entry_price:number|string|null;close_price:number|string|null;
  same_day_return:number|string|null;max_adverse_pct:number|string|null;
  max_favorable_pct:number|string|null;gap_pct:number|string|null;
  open5_move_pct:number|string|null;open5_range_pct:number|string|null;
  entry_reason:string|null;return_1d:number|string|null;
  return_3d:number|string|null;return_5d:number|string|null;
  return_10d:number|string|null;};
type Period={days:number;checked:number;distinctDates:number;up:number;
  plus3:number;minus3:number;averagePct:number|null;positiveRate:number|null;
  reboundRate:number|null;worstPct:number|null};

const n=(v:number|string|null|undefined)=>v==null?null:Number(v);
const pct=(v:number|string|null|undefined)=>{
  const value=n(v);
  return value===null||!Number.isFinite(value)?"待ち":(value>0?"+":"")+value.toFixed(2)+"%";
};
const yen=(v:number|string|null|undefined)=>{
  const value=n(v);
  return value===null||!Number.isFinite(value)?"—":Math.round(value).toLocaleString("ja-JP")+"円";
};
const stateText:Record<string,string>={
  PENDING:"保存待ち",CLAIMED:"取得中",COMPLETE:"保存済み",
  PARTIAL:"一部不足",FAILED:"保存失敗",UNAVAILABLE:"データ不足"
};
const buckets=["0–19","20–39","40–54"] as const;

export default async function WeakAiReboundPage(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  let target:string|null=null;
  let dateError=false;
  try{target=nightMorningTradingDates(new Date(),isTseTradingDate).tradeDate;}
  catch(error){console.error("weak reversal calendar unavailable",error);dateError=true;}
  let run:DbRun|null=null, positions:Position[]=[];
  let history:Position[]=[];
  let dataError=false;
  if(target){
    try{
      const [r,p,h]=await Promise.all([
        pool.query<DbRun>(
          "SELECT entry_date::text,source_date::text,cohort,frozen_at::text,"+
          "entry_state,entry_finished_at::text,note FROM public.weak_ai_rebound_runs "+
          "WHERE entry_date=$1::date AND rule_version=$2",[target,WEAK_REBOUND_VERSION]),
        pool.query<Position>(
          "SELECT entry_date::text,code,name,rank,ai_power,ai_bucket,prior_price,"+
          "entry_status,entry_price,close_price,same_day_return,max_adverse_pct,"+
          "max_favorable_pct,gap_pct,open5_move_pct,open5_range_pct,entry_reason,"+
          "return_1d,return_3d,return_5d,return_10d "+
          "FROM public.weak_ai_rebound_positions WHERE entry_date=$1::date ORDER BY rank",
          [target]),
        pool.query<Position>(
          "SELECT entry_date::text,code,name,rank,ai_power,ai_bucket,prior_price,"+
          "entry_status,entry_price,close_price,same_day_return,max_adverse_pct,"+
          "max_favorable_pct,gap_pct,open5_move_pct,open5_range_pct,entry_reason,"+
          "return_1d,return_3d,return_5d,return_10d "+
          "FROM public.weak_ai_rebound_positions WHERE entry_date<$1::date "+
          "ORDER BY entry_date DESC,rank LIMIT 650",[target])
      ]);
      run=r.rows[0]??null;
      positions=p.rows;
      history=h.rows;
    }catch(error){console.error("weak reversal study load failed",error);dataError=true;}
  }
  const all:Period[]=summarizeWeakOutcomes(history);
  const perBucket=buckets.map(bucket=>({
    bucket,observed:history.filter(row=>row.ai_bucket===bucket).length,
    summary:summarizeWeakOutcomes(history.filter(row=>row.ai_bucket===bucket)) as Period[]
  }));
  const status=run?.entry_state??"PENDING";
  return <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-3 px-3 pt-4">
      <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-700">
        ← 学習管理室へ戻る
      </Link>
      <header className="rounded-2xl border border-rose-200 bg-white p-4">
        <p className="text-[11px] font-black tracking-widest text-rose-700">
          OWNER PRIVATE / FORWARD-ONLY SHADOW
        </p>
        <h1 className="mt-2 text-2xl font-black">🔬 弱いAI判定からの逆張り反発研究</h1>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          前夜のAI POWERが55未満の銘柄から、決めた抽出規則で5銘柄だけを固定。
          翌営業日の9:10参考価格を基準に、同日および1・3・5・10取引日後の
          反発と続落を追跡します。
        </p>
        <p className="mt-2 text-xs leading-5 font-bold text-rose-800">
          ⚠ これは疑似保有の「撤退候補」とは違う、AI POWERの低さだけを使った
          逆張り仮説です。買い推奨や利益確率ではありません。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">研究対象日</p>
            <p className="mt-1 font-black">{target??"—"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">前夜固定</p>
            <p className="mt-1 font-black">{run?.cohort.length??0} / 最大5銘柄</p>
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          前営業日18:25に固定 → 翌営業日16:55に当日の5分足を一度だけ取得
          → 各取引日17:35に保存参考価格で追跡。9:10購入は後から再現する仮想価格で、
          9:10に買い判断を配信する機能ではありません。
        </p>
      </header>

      {dateError||dataError?<section className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-bold text-rose-800" role="alert">
        {dateError?"営業日カレンダーを確認できません。":"研究用データの取得に失敗しました。"}
        欠損を0件の成功や下落判定として計上しません。
      </section>:null}

      {!dateError&&!dataError&&!run?<section className="rounded-2xl border bg-white p-4">
        <h2 className="text-base font-black">前夜の固定記録を待っています</h2>
        <p className="mt-2 text-sm text-slate-600">
          開始前の日付をさかのぼって「予測できた」として登録しません。
          夜の固定処理が成功すると対象5銘柄が表示されます。
        </p>
      </section>:null}

      {run&&<section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">📋 今回の5銘柄</h2>
        <p className="mt-1 text-xs text-slate-500">
          基準保存日 {run.source_date} ／ 取得状況 {stateText[status]??"確認待ち"}
        </p>
        <div className="mt-3 space-y-2">
          {positions.map(stock=><div key={stock.code} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500">固定 {stock.rank}位 / AI {stock.ai_bucket}</p>
                <p className="mt-1 font-black">{stock.code} {stock.name}</p>
              </div>
              <span className="text-sm font-black text-rose-700">AI {stock.ai_power}</span>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              前日参考株価 {yen(stock.prior_price)} ／ 9:10参考 {yen(stock.entry_price)} ／
              100株参考額 {stock.entry_price===null?"—":yen(Number(stock.entry_price)*100)}
            </p>
            {stock.entry_status==="COMPLETE"?<div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs">
              当日引け {pct(stock.same_day_return)}　
              途中の最大下落 {pct(stock.max_adverse_pct)}
              <p className="mt-1">9:00〜9:05の値動き：値幅 {pct(stock.open5_range_pct)} ／
                寄付き後の変化 {pct(stock.open5_move_pct)}</p>
            </div>:<p className="mt-2 text-xs text-amber-800">
              {stock.entry_status==="PENDING"?"翌営業日の5分足を待っています":
                "必要な5分足が欠けたため、勝敗は集計しません"}
            </p>}
            <div className="mt-2 grid grid-cols-4 gap-1">
              {([1,3,5,10] as const).map(days=>{
                const value=stock[`return_${days}d` as keyof Position];
                const percent=n(value);
                return <div key={days} className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-[10px] text-slate-500">{days}日後</p>
                  <p className={"mt-1 text-xs font-black "+(percent===null?"text-slate-400":
                    percent>=0?"text-emerald-700":"text-rose-700")}>{pct(value as number|string|null)}</p>
                </div>;
              })}
            </div>
            <Link href={"/analysis/"+stock.code} className="mt-3 block text-xs font-bold text-blue-700">
              個別解析 →
            </Link>
          </div>)}
        </div>
      </section>}

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">📊 反発と続落の検証</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          同じ9:10参考価格からの変化率。プラス＝上昇、＋3%以上＝強い反発、
          −3%以下＝大きな続落。観測できた日付だけ母数に含めます。
        </p>
        <div className="mt-3 space-y-2">
          {all.map(x=><div key={x.days} className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <b>{x.days}取引日後</b>
              <span className="text-xs text-slate-600">検証済み {x.checked}件 / {x.distinctDates}日</span>
            </div>
            <p className="mt-2 text-xs">
              上昇 {x.up}件 ・ +3%以上 {x.plus3}件 ・ −3%以下 {x.minus3}件
            </p>
            <p className="mt-1 text-sm font-bold">
              {x.positiveRate===null?"勝率・平均は検証不足":
                "上昇割合 "+pct(x.positiveRate)+" ／ 平均 "+pct(x.averagePct)}
            </p>
          </div>)}
        </div>
        <p className="mt-3 text-xs leading-5 text-amber-900">
          数値公開の最低目安：各集計{WEAK_REBOUND_MIN_STOCK_DAYS}銘柄日・
          {WEAK_REBOUND_MIN_DAYS}営業日。検証母数が増えても、
          観測上の割合は将来の保証確率ではありません。
        </p>
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">🧪 AI POWER帯別の違い</h2>
        <p className="mt-1 text-xs text-slate-600">
          AI 0–19、20–39、40–54から事前規則で抽出した銘柄を比較。
          極端に弱いほど反発するか、それとも続落するかを研究します。
        </p>
        {perBucket.map(group=><div key={group.bucket} className="mt-3 rounded-xl border p-3">
          <b>AI {group.bucket}</b>
          <p className="mt-1 text-xs text-slate-600">保存記録 {group.observed}件</p>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {group.summary.map(item=><div key={item.days} className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-[10px] text-slate-500">{item.days}日後</p>
              <p className="mt-1 text-[11px] font-bold">
                {item.positiveRate===null?"検証不足":pct(item.positiveRate)}
              </p>
              <p className="text-[10px] text-slate-500">{item.checked}件</p>
            </div>)}
          </div>
        </div>)}
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">📚 あわせて見る</h2>
        <div className="mt-3 space-y-2 text-sm font-bold">
          <Link href="/simulation/universe-check" className="block text-blue-700">
            📊 全950銘柄の判定別・1/3/5/10日後検証 →
          </Link>
          <Link href="/simulation/exit-check" className="block text-blue-700">
            🔴 疑似保有ポジションの本当の撤退候補を検証 →
          </Link>
        </div>
      </section>

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">
        ⚠ 研究専用・管理者限定。自動売買・通知・既存のAI学習には接続しません。
        無償の5分足データは欠損・遅延があります。9:10の始値は実際に注文できた価格とは限りません。
        100株を買えた場合の仮定であり、手数料・税・スリッページ・板の厚さは除外。
        株式分割・価格訂正・ストップ高安は別途検証が必要です。
        観測日数の少ない研究で優位性を主張したり、今すぐ購入する目安にはしません。
      </p>
      <p className="text-[10px] text-slate-500">{WEAK_REBOUND_VERSION}</p>
    </div>
    <BottomNav/>
  </main>;
}
