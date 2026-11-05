import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getAdminSession } from "@/app/lib/admin";
import { isTseTradingDate } from "@/app/lib/technicalObservation/tseMarketCalendar";
import {
  TOP5_REPLAY_VERSION,TOP5_REPLAY_BUDGETS,replayProvenanceTop5Budget,
} from "@/app/lib/research/winRateTop5BudgetReplay.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;
export const runtime="nodejs";

type DailyRow={
  date:string;code:string;name:string;price:number;nextPrice:number|null;
  changePercent:number|null;result:string;createdAt:string|null;
  checkedAt:string|null;sourceTradeDate:string|null;sourcePrice:number|null;
  judgedResult:string|null;recordedAt:string|null;
};
type ArchiveRun={
  trade_date:string;prior_date:string;status:string;
  finished_at:string|null;results:unknown[];
};
const yen=(n:number|null|undefined)=>n===null||n===undefined?"—":
  (n>0?"+":"")+Math.round(n).toLocaleString("ja-JP")+"円";
const pct=(n:number|null|undefined)=>n===null||n===undefined?"—":n.toFixed(1)+"%";
const num=(n:number)=>n.toLocaleString("ja-JP");

export default async function WinRateTop5ForwardPage({
  searchParams,
}:{
  searchParams:Promise<{budget?:string}>;
}){
  const {isAdmin}=await getAdminSession();
  if(!isAdmin)notFound();
  const params=await searchParams;
  const requested=Number(params.budget??"380000");
  const budgetYen=TOP5_REPLAY_BUDGETS.includes(requested)?requested:380000;
  let report:ReturnType<typeof replayProvenanceTop5Budget>|null=null;
  let loadError=false;
  try{
    // Historical price+outcome records, read-only. All time-like columns
    // are conventionally stored as UTC-without-timezone in this archive,
    // and are explicitly formatted as UTC for the replay's as-of checks.
    const [data,archives]=await Promise.all([
      pool.query<DailyRow>(
        "SELECT d.date::text AS date,d.code,d.name,d.price,"+
        "d.next_price AS \"nextPrice\",d.change_percent AS \"changePercent\",d.result,"+
        "TO_CHAR(d.created_at,'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS \"createdAt\","+
        "TO_CHAR(d.checked_at,'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS \"checkedAt\","+
        "p.source_trade_date::text AS \"sourceTradeDate\",p.source_price AS \"sourcePrice\","+
        "p.judged_result AS \"judgedResult\","+
        "TO_CHAR(p.recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS \"recordedAt\" "+
        "FROM public.daily_stock_results d "+
        "LEFT JOIN public.daily_result_price_provenance p ON p.daily_result_id=d.id "+
        "WHERE d.date >= TO_CHAR(CURRENT_DATE - INTERVAL '120 days','YYYY-MM-DD') "+
        "ORDER BY d.date, d.code LIMIT 100001"
      ),
      pool.query<ArchiveRun>(
        "SELECT trade_date::text,prior_date::text,status,"+
        "TO_CHAR(finished_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS finished_at,results "+
        "FROM public.entry_time_shadow_runs "+
        "WHERE policy_version='PRIOR_DAY_TOP5_CLOSE_V1' "+
        "AND trade_date >= CURRENT_DATE - INTERVAL '75 days' "+
        "ORDER BY trade_date DESC LIMIT 60"
      ),
    ]);
    if(data.rows.length>=100001)throw Error("REPLAY_SOURCE_TRUNCATED");
    report=replayProvenanceTop5Budget({
      rows:data.rows,runs:archives.rows,now:new Date(),
      isTradingDate:isTseTradingDate,budgetYen,
    });
  }catch(error){
    console.error("win-rate top5 replay unavailable",error);
    loadError=true;
  }
  return <main className="min-h-screen bg-slate-50 px-3 py-5 pb-28 text-slate-900">
    <div className="mx-auto max-w-4xl space-y-3">
      <Link href="/admin/stock-win-rate-ranking" className="text-sm font-bold text-blue-700">
        ← 勝敗ランキングに戻る
      </Link>
      <header className="rounded-3xl border border-indigo-200 bg-white p-5">
        <p className="text-xs font-black tracking-widest text-indigo-700">
          OWNER RESEARCH / READ ONLY / RETROSPECTIVE REPLAY
        </p>
        <h1 className="mt-2 text-2xl font-black">勝率ランキング上位5 × 100株 × 1・3・5営業日</h1>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          当時までに保存・検証元を確認できた学習データだけでランキングを再計算し、
          上位5位から予算内の<strong>最上位1銘柄</strong>を仮選択。
          当日の<strong>9:30の5分足始値</strong>で100株買い、1・3・5東証営業日後の
          日次保存参考価格で売った場合を比較する研究です。
        </p>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-950">
          重要：これは当時の画面ランキングを凍結保存した記録ではありません。
          判定元価格の履歴が証明できる行だけを使う再構成であり、
          実際の過去の「上位5銘柄」と一致する保証はありません。
          9:30参考価格も実約定可能な価格ではありません。
          実際の本人によるチャート選別・損切り・利確を再現していません。
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-black">💴 1銘柄100株の予算</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {TOP5_REPLAY_BUDGETS.map((budget:number)=><Link
            key={budget} href={"/admin/stock-win-rate-ranking/forward?budget="+budget}
            className={budget===budgetYen?
              "rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white":
              "rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"}>
            {num(budget)}円
          </Link>)}
        </div>
        <p className="mt-2 text-xs text-slate-600">
          各営業日につき1銘柄だけを仮購入。6位以下で欠員を補充しません。
          前夜の参考価格と当日9:30参考価格の両方が予算内の場合のみ評価します。
          予算超過や価格不足は「負け」扱いにしません。
        </p>
      </section>

      {loadError?
        <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-800">
          保存履歴の取得または検証に失敗しました。数字は表示しません。
        </p>:
        report&&<>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["参照できた研究日",report.archiveDays+"営業日"],
              ["予算内の仮選択",report.eligibleSelections+"件"],
              ["1・3・5日すべて完備",report.pairedCount+"件"],
              ["比較可能な営業日",report.distinctDays+"日"],
            ].map(([name,value])=><div key={name} className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-[11px] font-bold text-slate-500">{name}</p>
              <p className="mt-2 text-xl font-black">{value}</p>
            </div>)}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-black">📈 1・3・5営業日後の比較</h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              同じ銘柄・同じ購入日で3期間すべての価格が揃ったケースだけを比較。
              100株を購入・売却するときにそれぞれ0.1%の仮想コストを計上。
              配当・税金・スプレッド・値幅制限・株式分割の独立検証は未反映。
              公開目安は30銘柄日以上かつ10営業日以上です。
            </p>
            {report.status!=="REPLAY_SAMPLE_READY"&&
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-950">
                検証不足：まだ利益率や勝率の優劣を評価できません。空欄を0%とは解釈しないでください。
              </p>}
            <div className="mt-3 space-y-2">
              {report.horizons.map((h:{horizon:number;paired:number;days:number;wins:number;avgNetYen100:number|null;medianNetYen100:number|null;positiveRate:number|null;target7000Rate:number|null;})=>
                <div key={h.horizon} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-black">{h.horizon}営業日後</p>
                  <p className="mt-1 text-xs text-slate-600">
                    共通完備 {h.paired}件／{h.days}営業日・利益プラス {h.wins}件
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>平均損益 <strong>{yen(h.avgNetYen100)}</strong></div>
                    <div>中央値 <strong>{yen(h.medianNetYen100)}</strong></div>
                    <div>プラス率 <strong>{pct(h.positiveRate)}</strong></div>
                    <div>＋7,000円達成率 <strong>{pct(h.target7000Rate)}</strong></div>
                  </div>
                </div>)}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-black">🧪 保存証拠の不足状況</h2>
            <p className="mt-2 text-xs leading-6 text-slate-700">
              検証済み履歴から上位を作れない日 {report.noAuditedRank}日 ／
              前夜価格が見つからない日 {report.noPriorPrice}日 ／
              上位5位以内で予算外 {report.overBudget}日 ／
              9:30の参考始値なし {report.missingEntry}日 ／
              1・3・5日の一部が不足・未到来 {report.incompleteSelections}件。
            </p>
            <p className="mt-2 text-xs leading-5 text-amber-900">
              既存の時間帯研究はAI POWER上位5銘柄のアーカイブなので、
              勝率ランキング上位銘柄と一致せず9:30価格が取得できないことがあります。
              欠損は推測補完せず、結果として数えません。
            </p>
          </section>
          {report.recent.length>0&&<details className="rounded-2xl border bg-white p-4">
            <summary className="cursor-pointer text-sm font-black">直近の仮選択と証拠状態</summary>
            <div className="mt-3 space-y-2 text-xs">
              {report.recent.map((r:{tradeDate:string;code:string;name:string;rank:number;status:string})=>
                <div key={r.tradeDate+":"+r.code} className="border-t pt-2">
                  <strong>{r.tradeDate}／{r.name}（{r.code}）</strong>
                  <p className="mt-1">監査済みデータ内の順位 {r.rank}位・証拠状態：{r.status}</p>
                </div>)}
            </div>
          </details>}
          <p className="text-[10px] text-slate-500">{TOP5_REPLAY_VERSION} ／
            読み取り専用・自動注文なし・学習重み／通知／本番ランキング変更なし。</p>
        </>}
    </div>
  </main>;
}
