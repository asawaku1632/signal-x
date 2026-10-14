import Link from "next/link";
import {notFound} from "next/navigation";
import pool from "@/app/lib/postgres";
import BottomNav from "@/app/components/BottomNav";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {ENTRY_TIME_SLOTS, summarizeEntryTimes, compareEarlyVsWait, summarizeEntryRisk, ENTRY_TIME_SHADOW_VERSION} from "@/app/lib/research/entryTimeShadow.mjs";
import {evaluateRecheckEntryStrategy, RECHECK_ENTRY_POLICY_VERSION} from "@/app/lib/research/recheckEntryStrategy.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;
type Entry={time:string;entryPrice:number|null;closePrice:number|null;returnPct:number|null;pnl100:number|null;maxAdversePct?:number|null;maxAdversePnl100?:number|null};
type PairedStock={date:string;code:string;name:string;earlyEntry:number;lateEntry:number;earlyPnl100:number;latePnl100:number;earlyAdvantage100:number};
type RiskSlot={time:string;samples:number;avgMaxAdversePct:number|null;worstMaxAdversePct:number|null;avgMaxAdversePnl100:number|null};
type RecheckGateRow={
  trade_date:string;prior_date:string;time_slot:string;code:string;
  prior_rank:number|string;ai_power:number|string|null;
  quote_timestamp:string;snapshot_saved_at:string;
};
type RecheckStudyStock={
  date:string;code:string;name:string;priorScore:number;recheckScore:number;
  decision:string;earlyEntry:number;lateEntry:number;closePrice:number;
  earlyPnl100:number;alwaysLatePnl100:number;gatedPnl100:number;
  missedProfit100:number;avoidedLoss100:number;
};
type StockResult={code:string;name:string;priorScore:number;rank:number;complete:boolean;closePrice:number|null;entries:Entry[];error?:string};
type DailyRun={trade_date:string;prior_date:string;status:string;cohort:unknown;results:StockResult[];note:string|null};
const yen=(n:number|null)=>n===null?"—":Math.round(n).toLocaleString("ja-JP")+"円";
const pct=(n:number|null)=>n===null?"—":(n>0?"+":"")+n.toFixed(2)+"%";
const signedYen=(n:number|null)=>n===null?"—":(n>0?"+":"")+Math.round(n).toLocaleString("ja-JP")+"円";

export default async function EntryTimingResearchPage(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner) notFound();
  let runs:DailyRun[]=[];let failed=false;
  let recheckRows:RecheckGateRow[]=[];let recheckReadError=false;
  try {
    const {rows}=await pool.query<DailyRun>(
      "SELECT trade_date::text,prior_date::text,status,cohort,results,note FROM public.entry_time_shadow_runs WHERE policy_version=$1 ORDER BY trade_date DESC LIMIT 60",
      [ENTRY_TIME_SHADOW_VERSION]);
    runs=rows;
  }catch(error){console.error("entry-time shadow archive unavailable",error);failed=true;}
  try {
    const {rows}=await pool.query<RecheckGateRow>(
      "SELECT trade_date::text,prior_date::text,time_slot,code,prior_rank,ai_power,"+
      "quote_timestamp::text,snapshot_saved_at::text FROM "+
      "public.ai_judgment_fixed_cohort_observations "+
      "WHERE time_slot='10:30' AND trade_date >= (CURRENT_DATE - INTERVAL '90 days')::date "+
      "ORDER BY trade_date DESC,code ASC LIMIT 500"
    );
    recheckRows=rows;
  }catch(error){
    console.error("10:30 AI recheck archive unavailable",error);
    recheckReadError=true;
  }
  const strategy=evaluateRecheckEntryStrategy(runs,recheckRows);
  const completed=runs.flatMap(r=>Array.isArray(r.results)?r.results:[]);
  const eligible=completed.filter(r=>r.complete && r.entries?.length===ENTRY_TIME_SLOTS.length);
  const summary=summarizeEntryTimes(completed);
  const dayCount=new Set(runs.filter(r=>Array.isArray(r.results)&&r.results.some(x=>x.complete)).map(r=>r.trade_date)).size;
  const mature=dayCount>=20&&eligible.length>=100;
  const compared=compareEarlyVsWait(completed);
  const risk:RiskSlot[]=summarizeEntryRisk(completed);
  const latestDate=runs[0]?.trade_date??null;
  const latestPairs:PairedStock[]=compared.pairs.filter((p:PairedStock)=>p.date===latestDate);
  const recentRechecks:RecheckStudyStock[]=strategy.analyzed
    .filter((p:RecheckStudyStock)=>p.date===latestDate);
  const recheckSufficient=strategy.days>=20 && strategy.evaluated>=100;
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
      <section className="rounded-2xl border border-indigo-100 bg-white p-3">
        <p className="text-[11px] font-black tracking-widest text-indigo-600">AI RECHECK / SHADOW ONLY</p>
        <h2 className="mt-1 text-lg font-black">🤖 朝のAIを見て、11時に買う？</h2>
        <p className="mt-1 text-xs leading-6 text-slate-600">
          前夜に選んだ同じ5銘柄を固定して、10:30に保存されたAI POWERで再判定。
          85以上なら11:00の5分足始値で100株仮想購入、85未満なら現金のまま見送り。
          朝9:05全件購入・11:00全件購入とも、同じ銘柄と同じ大引け価格で比較します。
        </p>
        {recheckReadError?<p className="mt-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
          再判定の保存記録を読み込めませんでした。集計は表示しません。
        </p>:null}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["前夜候補",strategy.candidates+"件"],
            ["比較できた",strategy.evaluated+"件"],
            ["照合対象外",strategy.excluded+"件"]
          ].map(([name,value])=><div key={name} className="rounded-xl bg-slate-50 p-2">
            <p className="text-[10px] text-slate-500">{name}</p>
            <p className="mt-1 text-lg font-black">{value}</p>
          </div>)}
        </div>
        {strategy.evaluated===0?
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6">
            10:30の固定銘柄AI観測と、大引け後の5分足比較が両方そろった結果待ち。
            過去の日付に再判定を後付けしていません。次の営業日以降に自動的に照合します。
          </p>:
          <>
            <div className="mt-3 space-y-2">
              {[
                {label:"9:05に全件買う",pnl:strategy.earlyTotalPnl100,
                  cnt:strategy.evaluated,win:strategy.earlyWinRate},
                {label:"11:00に全件買う",pnl:strategy.alwaysLateTotalPnl100,
                  cnt:strategy.evaluated,win:strategy.alwaysLateWinRate},
                {label:"10:30再判定 → 11:00条件付き購入",
                  pnl:strategy.gatedTotalPnl100,
                  cnt:strategy.buyCount,win:strategy.gateWinRate}
              ].map(s=><div key={s.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm font-bold">{s.label}</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-600">{s.cnt}購入 ／ 購入分の勝率 {s.win===null?"—":s.win.toFixed(1)+"%"}</p>
                  <p className="font-black">{signedYen(s.pnl)}</p>
                </div>
              </div>)}
            </div>
            <p className="mt-2 text-sm font-bold">
              再判定で購入 {strategy.buyCount}件 ／ 見送り {strategy.skipCount}件
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              見送りで回避できた仮想損失：{signedYen(strategy.avoidedLossTotal100)} ／
              見送りで逃した仮想利益：{signedYen(strategy.missedOpportunityTotal100)}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              同じ評価対象1件あたりの平均仮想損益：再判定
              {signedYen(strategy.gatedAvgPerCandidate100)} ／
              朝 {signedYen(strategy.earlyAvgPerCandidate100)} ／
              11時無条件 {signedYen(strategy.alwaysLateAvgPerCandidate100)}
            </p>
          </>
        }
        {recentRechecks.length>0&&<details className="mt-3 rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-black">最新日の再判定内訳（{recentRechecks.length}件）</summary>
          {recentRechecks.map((s:RecheckStudyStock)=><div key={s.code} className="mt-2 border-t pt-2 text-xs">
            <p className="font-bold">{s.code} {s.name} ／ 10:30 AI {s.recheckScore} ／
              {s.decision==="BUY"?" 仮想購入":" 見送り"}</p>
            <p className="mt-1">朝 {signedYen(s.earlyPnl100)} ／
              11時無条件 {signedYen(s.alwaysLatePnl100)} ／
              再判定 {signedYen(s.gatedPnl100)}</p>
          </div>)}
        </details>}
        <p className="mt-3 text-xs leading-5 text-amber-800">
          重要：AI判定は11:00そのものではなく10:30時点の保存値。
          見送りは損益0円として扱い、勝率の母数に入れません。判定データ欠損は「見送り」ではなく
          比較対象外です。3戦略は購入件数・保有時間・投下資金が異なるため、損益合計だけで優劣は決まりません。
          {recheckSufficient?" 複数日の参考検証中。売買の勝率を保証しません。":
          " 十分な検証には少なくとも20営業日・比較可能100銘柄日を目安にします。"}
        </p>
        <p className="mt-1 text-[10px] text-slate-500">{RECHECK_ENTRY_POLICY_VERSION}</p>
      </section>
      <section className="rounded-2xl border bg-white p-3">
        <h2 className="text-lg font-black">🔍 朝9:05に買う？ 11:00まで待つ？</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          同じ日・同じ銘柄・同じ大引けを使い、朝と11時の仮想損益を直接比較。
          六つの時刻がすべてそろった銘柄だけを利用します。
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-[10px] text-slate-500">朝9:05の勝率</p>
            <p className="mt-1 text-xl font-black">
              {compared.samples?(compared.earlyWins/compared.samples*100).toFixed(1)+"%":"—"}
            </p>
            <p className="text-[10px] text-slate-500">{compared.earlyWins}/{compared.samples}件</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-[10px] text-slate-500">11:00の勝率</p>
            <p className="mt-1 text-xl font-black">
              {compared.samples?(compared.lateWins/compared.samples*100).toFixed(1)+"%":"—"}
            </p>
            <p className="text-[10px] text-slate-500">{compared.lateWins}/{compared.samples}件</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-[10px] text-slate-500">朝の方が有利な損益差</p>
            <p className="mt-1 text-lg font-black">{signedYen(compared.avgEarlyAdvantage100)}</p>
            <p className="text-[10px] text-slate-500">各銘柄100株・平均</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-bold">
          11時まで待って安くなった：{compared.waitCheaper}件 ／
          朝の方が安かった：{compared.earlyCheaper}件 ／ 同値：{compared.equalPrice}件
        </p>
        {latestPairs.length>0&&<details className="mt-3 rounded-lg border p-3" open={latestPairs.length<=5}>
          <summary className="cursor-pointer text-sm font-black">
            {latestDate} 銘柄別の答え合わせ（{latestPairs.length}件）
          </summary>
          <div className="mt-2 space-y-2">
            {latestPairs.map((p:PairedStock)=><div key={p.code} className="border-t pt-2 text-xs">
              <p className="font-black">{p.code} {p.name}</p>
              <p className="mt-1">9:05 {yen(p.earlyEntry)} → 同日引け {signedYen(p.earlyPnl100)} ／
                11:00 {yen(p.lateEntry)} → {signedYen(p.latePnl100)}</p>
              <p className="mt-1 text-slate-600">朝に買った場合の損益優位：
                {signedYen(p.earlyAdvantage100)}（100株）</p>
            </div>)}
          </div>
        </details>}
        <p className="mt-3 text-xs leading-5 text-amber-800">
          ⚠ これは11時の新しいAI判定で「買う／見送る」を選別した研究ではありません。
          どの時間でも必ず買った仮定。朝と11時では保有時間も異なり、価格の上下や最大含み損は別に調べる必要があります。
          {compared.days<20?" 現在"+compared.days+"営業日分であり優劣は確定しません。":""}
        </p>
      </section>
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
        <h2 className="text-lg font-black">📉 買った後の一時的な下落幅</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          同日大引けまでに、購入価格から一時どこまで下がったかを5分足安値で確認します。
          全5分足が取得できた銘柄だけ集計。欠けた記録は「不明」とし、損失0円にはしません。
        </p>
        {risk.every((r:RiskSlot)=>r.samples===0)?
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
            過去に保存された結果には5分足安値の追跡記録がないため、集計は次回の自動研究から開始します。
          </p>:
          <div className="mt-3 space-y-2">
            {risk.map((r:RiskSlot)=><div key={r.time} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
              <div>
                <p className="font-black">{r.time}</p>
                <p className="text-xs text-slate-500">{r.samples}件の連続5分足</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-bold">平均最大逆行 {pct(r.avgMaxAdversePct)}</p>
                <p className="text-xs text-slate-600">100株参考損失 {signedYen(r.avgMaxAdversePnl100)}</p>
              </div>
            </div>)}
          </div>}
        <p className="mt-2 text-xs leading-5 text-slate-500">
          下落幅は保存された5分足の安値に基づく仮想値です。証券会社の約定価格、実際の損切価格、
          株価飛びやスリッページを反映しません。
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
      <p className="text-xs leading-5 text-slate-500">研究バージョン：{ENTRY_TIME_SHADOW_VERSION}。この段階は同日大引けまでの損益と、保存後の完全な5分足がある場合の最大逆行幅を比較します。翌日・3日・5日保有、および11:00ちょうどのAI再判定はまだ検証していません。</p>
    </div><BottomNav/>
  </main>;
}
