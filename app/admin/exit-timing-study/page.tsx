import Link from "next/link";
import {notFound} from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {nightMorningTradingDates} from "@/app/lib/research/nightMorningWatch.mjs";
import {jstParts,ENTRY_TIME_SHADOW_VERSION} from "@/app/lib/research/entryTimeShadow.mjs";
import {MORNING_FINAL_POLICY} from "@/app/lib/research/morningFinalCheck.mjs";
import {
  EXIT_TIME_COMPARE_VERSION,EXIT_TIME_MIN_DAYS,EXIT_TIME_MIN_STOCK_DAYS,
  EXIT_TIMES,pairExitResearch,summarizeExitResearch
} from "@/app/lib/research/exitTimingStudy.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;
type Frozen={code:string;name:string;score:number;referencePrice:number;rank:number};
type MorningRun={trade_date:string;prior_date:string;
  cohort:Frozen[];morning_observations:unknown[];morning_saved_at:string|null};
type ClosingRun={trade_date:string;prior_date:string;status:string;results:unknown[]};
type ExitResult={time:string;complete:boolean;exitPrice:number;pnl100:number;returnPct:number;
  maxAdversePct:number;maxAdversePnl100:number;maxFavorablePct:number};
type PairedRow={date:string;code:string;name:string;label:string;
  priorScore:number;entryPrice:number;exits:ExitResult[]};
type Aggregate={time:string;count:number;positiveCount:number;
  positiveRate:number|null;avgPnl100:number|null;worstPnl100:number|null;
  avgMaxAdversePct:number|null;worstAdversePct:number|null;
  avgMaxFavorablePct:number|null};
type Stats={count:number;days:number;sufficient:boolean;
  morningOnly:number;nearHighThenLoss:number;greenCount:number;
  all:Aggregate[];green:Aggregate[]};
const yen=(n:number|null)=>n===null?"—":(n>0?"+":"")+Math.round(n).toLocaleString("ja-JP")+"円";
const pct=(n:number|null)=>n===null?"—":(n>0?"+":"")+n.toFixed(2)+"%";
const labelText:Record<string,string>={
  BUY_CANDIDATE:"🟢買い候補",CAUTION:"🟡注意",SKIP:"🔴見送り"
};

export default async function ExitTimingStudyPage(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  let cutoffDate=jstParts(new Date()).date;
  let calendarError=false;
  try{cutoffDate=nightMorningTradingDates(new Date(),isTseTradingDate).tradeDate;}
  catch(error){console.error("exit timing market calendar unavailable",error);calendarError=true;}
  let mornings:MorningRun[]=[];
  let closings:ClosingRun[]=[];
  let readError=false;
  if(!calendarError){
    try{
      const [m,c]=await Promise.all([
        pool.query<MorningRun>(
          "SELECT trade_date::text,prior_date::text,cohort,"+
          "morning_observations,morning_saved_at::text "+
          "FROM public.morning_final_check_runs "+
          "WHERE policy_version=$1 AND trade_date<$2::date AND "+
          "morning_state IN ('COMPLETE','PARTIAL') "+
          "ORDER BY trade_date DESC LIMIT 90",
          [MORNING_FINAL_POLICY,cutoffDate]),
        pool.query<ClosingRun>(
          "SELECT trade_date::text,prior_date::text,status,results "+
          "FROM public.entry_time_shadow_runs "+
          "WHERE policy_version=$1 AND trade_date<$2::date "+
          "AND status IN ('COMPLETE','PARTIAL') "+
          "ORDER BY trade_date DESC LIMIT 90",
          [ENTRY_TIME_SHADOW_VERSION,cutoffDate])
      ]);
      mornings=m.rows;closings=c.rows;
    }catch(error){console.error("exit timing saved study read failed",error);readError=true;}
  }
  const paired:{matched:PairedRow[];excluded:unknown[]}=(!readError&&!calendarError)?
    pairExitResearch(mornings,closings,cutoffDate):{matched:[],excluded:[]};
  const stats:Stats=summarizeExitResearch(paired.matched);
  const recent=paired.matched.slice().sort((a,b)=>b.date.localeCompare(a.date)||a.code.localeCompare(b.code)).slice(0,8);

  return <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-3 px-3 pt-4">
      <Link href="/admin/learning-hub" className="text-sm font-black text-blue-700">
        ← 学習管理室へ戻る
      </Link>
      <header className="rounded-2xl border border-violet-200 bg-white p-4">
        <p className="text-[11px] font-black tracking-widest text-violet-700">
          OWNER ONLY / FOUR EXIT TIMES / FORWARD SHADOW
        </p>
        <h1 className="mt-1 text-2xl font-black">⏰ 朝9:10に買って、何時に売る？</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          前夜に固定した最大5銘柄を、朝9:08に判定し、
          9:10の5分足始値で100株仮想購入した場合を比較。
          同じ株・同じ日に9:30／10:00／11:30／15:30に売った
          参考損益と途中の最大下落を検証します。
        </p>
        <p className="mt-2 text-xs leading-5 text-amber-900">
          9:08の判定結果が9:10より前に保存されている日だけを利用。
          9:10は仮想の参考購入価格であり、実際の注文や約定を意味しません。
        </p>
      </header>

      {readError||calendarError?<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
        {calendarError?"営業日カレンダーが取得できません。":"保存済み研究記録を読み込めません。"}
        0件の正常結果と誤認しないため、集計を停止しています。
      </p>:null}

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">📊 4つの売り時刻を比べる</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-[11px] text-slate-500">同じ銘柄で比較</p>
            <p className="mt-1 text-lg font-black">{stats.count}件</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-[11px] text-slate-500">研究日数</p>
            <p className="mt-1 text-lg font-black">{stats.days}日</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-[11px] text-slate-500">🟢限定</p>
            <p className="mt-1 text-lg font-black">{stats.greenCount}件</p>
          </div>
        </div>
        {!stats.sufficient?<p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950">
          検証中：最低目安は{EXIT_TIME_MIN_STOCK_DAYS}銘柄日・{EXIT_TIME_MIN_DAYS}営業日。
          利益率が高い時間をデータ不足の段階で「正解」と表示しません。
        </p>:null}
        {([["前夜5銘柄全体",stats.all],["🟢買い候補限定",stats.green]] as const).map(([title,items])=>
          <div key={title} className="mt-4">
            <h3 className="text-sm font-black">{title}</h3>
            <div className="mt-2 space-y-2">
              {items.map(item=><div key={item.time} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-lg">{item.time}に売る</b>
                  <span className="text-xs text-slate-500">{item.count}件</span>
                </div>
                {!stats.sufficient?<p className="mt-1 text-xs text-slate-600">勝率・損益・最大下落は検証不足</p>:
                item.count===0?<p className="mt-1 text-xs text-slate-600">対象銘柄なし</p>:
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <p>プラス率 <b className="block text-base">{pct(item.positiveRate)}</b></p>
                  <p>100株平均 <b className="block text-base">{yen(item.avgPnl100)}</b></p>
                  <p>100株最悪例 <b className="block">{yen(item.worstPnl100)}</b></p>
                  <p>途中の平均最大下落 <b className="block">{pct(item.avgMaxAdversePct)}</b></p>
                </div>}
              </div>)}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">📉 朝だけ上がって下がる？</h2>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          同じ銘柄で「9:30ならプラス・15:30ならプラスでない」ケースと、
          9:30までに一時2%以上上昇したのに15:30ではマイナスになったケースを追跡。
        </p>
        {stats.sufficient?
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs">9:30は利益／引けは非利益</p>
              <p className="mt-1 text-lg font-black">{stats.morningOnly}件</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs">朝一時＋2%以上→引け損失</p>
              <p className="mt-1 text-lg font-black">{stats.nearHighThenLoss}件</p>
            </div>
          </div>:
          <p className="mt-2 text-xs text-amber-800">データが揃ってから結果を公開します。</p>}
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">🧾 直近の同一銘柄・答え合わせ</h2>
        <p className="mt-1 text-xs text-slate-600">
          小標本でも個別記録は確認できます。4時刻が揃った銘柄だけです。
          未来の値動きから前夜候補や朝判定を変更しません。
        </p>
        {!readError&&!calendarError&&recent.length===0?
          <p className="mt-3 text-sm text-slate-600">前夜固定と朝9:10前の判定、4時刻の価格が全て揃う日を待っています。</p>:null}
        <div className="mt-3 space-y-2">
          {recent.map(x=><details key={x.date+x.code} className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-black">
              {x.date} {x.code} {x.name} / {labelText[x.label]??"研究"}
            </summary>
            <p className="mt-2 text-xs">9:10参考購入 {yen(x.entryPrice).replace(/^\+/,"")}</p>
            {x.exits.map(e=><div key={e.time} className="mt-2 flex justify-between gap-2 border-t pt-2 text-xs">
              <span>{e.time} 売却 {yen(e.exitPrice).replace(/^\+/,"")}</span>
              <span className="font-bold">{yen(e.pnl100)}</span>
              <span className="text-slate-500">最大下落 {pct(e.maxAdversePct)}</span>
            </div>)}
            <div className="mt-2 flex gap-5 text-sm font-bold">
              <Link href={"/analysis/"+x.code} className="text-blue-700">個別解析 →</Link>
              <Link href={"/chart/"+x.code} className="text-blue-700">チャート →</Link>
            </div>
          </details>)}
        </div>
        <Link href="/admin/morning-final-check" className="mt-3 block text-sm font-bold text-blue-700">
          ☀️ 朝9:05 最終チェックへ →
        </Link>
      </section>

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">
        ⚠ 研究専用・注文やLINE通知への接続なし。5分足の始値・終値は実約定を保証しません。
        9:30・10:00・11:30の値は直前5分足の終値、15:30は既存研究と同じ引け参考価格です。
        売買停止・寄付き未成立・手数料・税・スリッページ、板の厚さは未検証。
        保有時間や売却タイミングによってリスクが異なります。
        値動きの判定条件は事前固定し、十分な観測が貯まるまで優劣は未判定です。
      </p>
      <p className="text-[10px] text-slate-500">{EXIT_TIME_COMPARE_VERSION}</p>
    </div><BottomNav/>
  </main>;
}
