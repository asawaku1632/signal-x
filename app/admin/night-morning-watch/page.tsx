import Link from "next/link";
import {notFound} from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {ENTRY_TIME_SHADOW_VERSION} from "@/app/lib/research/entryTimeShadow.mjs";
import {MORNING_FINAL_POLICY} from "@/app/lib/research/morningFinalCheck.mjs";
import {summarizeMorningCaptureHealth} from "@/app/lib/research/morningCaptureHealth.mjs";
import {assessAsOfCatalysts,assessFrozenBudgetMorning} from "@/app/lib/research/nextSessionCatalystAudit.mjs";
import {
  NEXT_SESSION_BUDGET_PRESETS,buildNextSessionBudgetWatch
} from "@/app/lib/research/nextSessionBudgetWatch.mjs";
import {
  NIGHT_MORNING_POLICY, NIGHT_MORNING_MIN_SAMPLES,NIGHT_MORNING_MIN_DAYS,
  nightMorningTradingDates,buildNightMorningCandidates,summarizeNightMorningEvidence
} from "@/app/lib/research/nightMorningWatch.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;

type SavedRow={code:string;name:string;score:number|string;price:number|string;snapshotDate:string};
type NightMorningCandidate={
  code:string;name:string;score:number;referencePrice:number;rank:number;band:string
};
type StudyRun={trade_date:string;results:unknown};
type FrozenBudgetSnapshot={
  policy:string;frozenAt:string;sourceDate:string;tradeDate:string;
  observedUniverseCount:number;expectedUniverseCount:number;
  coverage:number;sha256:string;cohort:unknown[];
  budgets:{budgetYen:number;codes:string[]}[];
};
type FrozenBudgetRow={snapshot:FrozenBudgetSnapshot};
type MorningCaptureRow={trade_date:string;morning_observations:unknown[]};
type MorningFreezeRun={trade_date:string;prior_date:string;frozen_at:string;
  cohort:unknown[];morning_state:string;morning_saved_at:string|null;
  morning_observations:unknown[]};
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
  let morningFreeze:MorningFreezeRun|null=null;
  let freezeReadError=false;
  let fullBudgetSnapshot:FrozenBudgetSnapshot|null=null;
  let fullBudgetFreezeReadError=false;
  let captureRows:MorningCaptureRow[]=[];
  let captureReadError=false;
  if(sourceDate&&tradeDate){
    try {
      const response=await pool.query<SavedRow>(
        "SELECT code,name,score,price,date::text AS \"snapshotDate\" FROM public.daily_stock_results "+
        "WHERE date=$1 AND score>=85 AND score<=100 AND price>0 "+
        "AND code ~ '^[1-9][0-9ACDFGHJKLMNPRSTUWXY][0-9][0-9ACDFGHJKLMNPRSTUWXY]
      rows=response.rows;
    }catch(error){
      console.error("Night morning saved results unavailable",error);
      candidateReadError=true;
    }
    try {
      const result=await pool.query<MorningFreezeRun>(
        "SELECT trade_date::text,prior_date::text,frozen_at::text,cohort, "+
        "morning_state,morning_saved_at::text,morning_observations "+
        "FROM public.morning_final_check_runs "+
        "WHERE policy_version=$1 AND trade_date=$2::date AND prior_date=$3::date "+
        "LIMIT 1",[MORNING_FINAL_POLICY,tradeDate,sourceDate]);
      morningFreeze=result.rows[0]??null;
    }catch(error){
      console.error("budget shadow morning freeze read unavailable",error);
      freezeReadError=true;
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

  if(sourceDate&&tradeDate){
    try {
      // Existing deployments do not yet have the shadow table. Check its
      // existence instead of spamming errors or reconstructing past freezes.
      const found=await pool.query<{present:string|null}>(
        "SELECT to_regclass('public.budget_night_shadow_runs')::text AS present");
      if(found.rows[0]?.present){
        const result=await pool.query<FrozenBudgetRow>(
          "SELECT snapshot FROM public.budget_night_shadow_runs "+
          "WHERE trade_date=$1::date AND prior_date=$2::date LIMIT 1",
          [tradeDate,sourceDate]);
        fullBudgetSnapshot=result.rows[0]?.snapshot??null;
      }
    }catch(error){
      console.error("owner budget shadow snapshot read unavailable",error);
      fullBudgetFreezeReadError=true;
    }
  }
  try {
    const result=await pool.query<MorningCaptureRow>(
      "SELECT trade_date::text,morning_observations "+
      "FROM public.morning_final_check_runs WHERE policy_version=$1 "+
      "ORDER BY trade_date DESC LIMIT 20",[MORNING_FINAL_POLICY]);
    captureRows=result.rows;
  }catch(error){
    console.error("morning capture quality query unavailable",error);
    captureReadError=true;
  }
  const captureHealth=summarizeMorningCaptureHealth(captureReadError?[]:captureRows);
  const candidates:NightMorningCandidate[]=candidateReadError?[]:buildNightMorningCandidates(rows);
  const evidence:Evidence[]=evidenceReadError||!tradeDate?[]:
    summarizeNightMorningEvidence(runs,tradeDate);
  const budgetWatches=sourceDate&&tradeDate&&!candidateReadError?
    NEXT_SESSION_BUDGET_PRESETS.map(budgetYen=>
      buildNextSessionBudgetWatch({
        rows,sourceDate,tradeDate,budgetYen,targetProfitYen:7000,limit:3,
      })): [];
  const budgetUniverseCapped=rows.length>=1500;
  const morningByBudget=new Map(budgetWatches.flatMap(watch=>
    watch.candidates.map(stock=>{
      const key=watch.budgetYen+":"+stock.code;
      const morning=assessFrozenBudgetMorning({
        ...stock,budgetYen:watch.budgetYen,
      },morningFreeze);
      // Until a verified IR feed is connected, never label an event confirmed.
      // Use only the stored (real) frozen timestamp, never an assumed freeze.
      const freezeMs=Date.parse(String(morningFreeze?.frozen_at??""));
      const catalysts=Number.isFinite(freezeMs)?
        assessAsOfCatalysts({code:stock.code,
          freezeAt:new Date(freezeMs).toISOString(),records:[]}):
        {status:"NOT_VERIFIED",accepted:[]};
      return [key,{morning,catalysts}] as const;
    })));
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

      <Link href="/admin/night-entry-holding"
        className="block rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-sm">
        <p className="text-sm font-black text-indigo-900">🔬 新研究：前夜候補 × 購入時刻 × 1・3・5営業日後</p>
        <p className="mt-1 text-xs leading-5 text-indigo-800">
          9:00・9:05・9:15・9:30を前夜の保存価格と比較。事前固定された銘柄だけを検証し、欠損は補完しません。
        </p>
      </Link>

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

      <section className="rounded-2xl border border-amber-200 bg-white p-4">
        <h2 className="text-lg font-black">🕘 朝9:05の保存データ品質</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          事前固定した候補の朝判定を集計。データ不足は「負け」や「見送り」にせず、
          原因を表示します。過去の判定を後から作り直しません。
        </p>
        {captureReadError?<p role="alert" className="mt-2 text-xs text-rose-800">
          朝の判定記録を取得できません。
        </p>:<div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs">
          <p className="font-black">
            {captureHealth.days}営業日・{captureHealth.slots}候補中、
            有効な朝判定 {captureHealth.available}件
            （{captureHealth.availablePct??"—"}%）
          </p>
          <p className="mt-1">データ不足 {captureHealth.unavailable}件 ／ 5分足不足 {captureHealth.missing}件</p>
          {captureHealth.status==="NO_USABLE_MORNING_DECISIONS"?
            <p role="alert" className="mt-2 font-bold text-rose-800">
              朝判定の実績をまだ評価できません。5分足の取得時刻・配信遅延を監査してください。
            </p>:null}
          <p className="mt-2 text-slate-600">
            {captureHealth.reasons.map(x=>x.reason+" "+x.count+"件").join(" ／ ")}
          </p>
        </div>}
      </section>

      <section className="rounded-2xl border border-indigo-200 bg-white p-4">
        <h2 className="text-lg font-black">🔒 全予算候補・前夜固定の状況</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          既存の「AI上位5件」研究とは別に、保存済みの日次全銘柄を確認して
          100株予算別の候補を一度だけ固定する独立したシャドー研究です。
          データカバレッジ80%未満、欠損、対象日不一致の記録では固定しません。
        </p>
        {fullBudgetFreezeReadError?<p role="alert" className="mt-2 text-xs text-rose-700">
          研究テーブルを読み込めません。後から過去の候補を生成しません。
        </p>:fullBudgetSnapshot?<div className="mt-3 rounded-xl bg-indigo-50 p-3 text-xs">
          <p className="font-black text-indigo-950">
            保存済み：{fullBudgetSnapshot.observedUniverseCount} / 
            {fullBudgetSnapshot.expectedUniverseCount} 銘柄
            （カバレッジ {fullBudgetSnapshot.coverage}%）
          </p>
          <p className="mt-1">
            事前固定 {new Date(fullBudgetSnapshot.frozenAt).toLocaleString("ja-JP",
              {timeZone:"Asia/Tokyo"})} / 証跡 {fullBudgetSnapshot.sha256.slice(0,12)}…
          </p>
          {fullBudgetSnapshot.budgets.map(b=><p key={b.budgetYen} className="mt-1">
            予算 {yen(b.budgetYen)}：前夜固定 {b.codes.length}銘柄
          </p>)}
        </div>:<p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs leading-5">
          この取引日には独立した全銘柄の事前固定記録がありません。
          保存失敗や未有効化の記録を後知恵で埋め合わせません。
        </p>}
        <p className="mt-2 text-[11px] text-amber-800">
          新しい記録の作成には研究テーブル準備と管理者の明示的な有効化が必要です。
          現在のプレビューでは新規保存・有料TDnet接続・自動通知は無効です。
        </p>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-white p-4">
        <h2 className="text-lg font-black">💴 翌取引日・予算別の研究候補</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          保存済みAI POWER 85以上から100株単位で計算。10万・30万・35万・50万円の予算別に
          最大3銘柄を表示します。順位は保存AIスコア順で、翌日の上昇率や利益の予測順位ではありません。
          保存価格は実際に購入できる株価と異なるため、9:05以降の最新価格で再判定が必要です。
        </p>
        <p className="mt-2 text-xs font-bold text-blue-800">
          保存日 {sourceDate??"—"} ／ 次の検証対象日 {tradeDate??"—"}
        </p>
        {budgetUniverseCapped?<p role="alert" className="mt-2 text-xs text-amber-800">
          研究データの読込上限1500件に達しました。全銘柄の網羅性を保証しません。
        </p>:null}
        {budgetWatches.map(watch=><div key={watch.budgetYen}
          className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-black">予算 {yen(watch.budgetYen)} ／
            条件に合う保存銘柄 {watch.eligibleCount}件</p>
          {watch.candidates.length===0?<p className="mt-2 text-xs text-slate-600">
            現時点ではこの予算内に条件を満たす候補がありません。
          </p>:null}
          {watch.candidates.map(stock=><div key={stock.code}
            className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="flex justify-between gap-2">
              <b>参考{stock.rank}位｜{stock.code} {stock.name}</b>
              <span className="text-indigo-700 font-black">AI {stock.score}</span>
            </div>
            <p className="mt-1 text-xs leading-5">
              保存価格 {yen(stock.referencePrice)} ・100株参考額 {yen(stock.referenceCostYen)}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              税・手数料・滑りを除き7,000円を得るには、
              100株で1株+{yen(stock.requiredRiseYenPerShare)}（+{stock.requiredRisePercent}%）が必要。
              これは到達予想ではありません。
            </p>
            {(()=>{
              const check=morningByBudget.get(watch.budgetYen+":"+stock.code);
              const morning=check?.morning;
              const labels:Record<string,string>={
                INVALID_WATCH:"候補データ不正",PRIOR_BUDGET_FAIL:"前夜の時点で予算超過",NOT_FROZEN:"事前固定記録なし",
                MORNING_UNVERIFIED:"朝9:05判定の保存待ち",
                OVER_BUDGET:"朝9:05の参考株価では予算超過",
                RESEARCH_CONDITION:"朝9:05研究の条件を通過",
                RESEARCH_WAIT:"朝9:05研究は注意・見送り",
              };
              return <div className="mt-2 space-y-1 text-xs leading-5">
                <p className="font-bold text-indigo-800">
                  前夜固定・9:05照合：{freezeReadError?
                    "研究DBを取得できません":labels[morning?.status??""]??"未検証"}
                </p>
                {morning?.price0905!=null?<p>
                  9:05参考価格 {yen(morning.price0905)} /
                  100株 {yen(morning.referenceCostYen??0)}
                </p>:null}
                <p className="text-amber-800">
                  決算・上方修正・出来高：{check?.catalysts.status==="TIMING_ELIGIBLE_ONLY"?
                    "入力された時刻の整合性のみ確認（内容未検証）":"証拠データ未接続・未検証"}。
                  朝の研究条件を通過しても、実際の約定や利益は保証できません。
                </p>
              </div>;
            })()}
          </div>)}
          {watch.conflictsExcluded>0?<p className="mt-2 text-xs text-amber-800">
            不一致のある重複記録 {watch.conflictsExcluded}銘柄は除外しました。
          </p>:null}
        </div>)}
        <Link href="/admin/morning-final-check"
          className="mt-3 block text-sm font-bold text-blue-700">
          9:05以降の再判定研究へ →
        </Link>
        <Link href="/admin/night-entry-holding"
          className="mt-3 block text-sm font-bold text-blue-700">
          予算別・1/3/5営業日後の答え合わせを見る →
        </Link>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          本機能は管理者限定のシャドー表示です。買い推奨、実注文、通知、一般向けランキングには
          反映していません。材料と出来高を未確認のまま「上がる本命」と断言しません。
        </p>
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
