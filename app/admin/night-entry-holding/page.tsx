import Link from "next/link";
import {notFound} from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {ENTRY_TIME_SHADOW_VERSION} from "@/app/lib/research/entryTimeShadow.mjs";
import {MORNING_FINAL_POLICY} from "@/app/lib/research/morningFinalCheck.mjs";
import {
  NIGHT_HOLDING_POLICY,NIGHT_HOLDING_SLOTS,NIGHT_HOLDING_HORIZONS,
  NIGHT_HOLDING_MIN_STOCK_DAYS,NIGHT_HOLDING_MIN_DAYS,
  holdingTradingDates,buildNightHoldingStudy,summarizeNightHolding,holdingPnl100,
} from "@/app/lib/research/nightTimingHolding.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;

type FrozenRun={trade_date:string;prior_date:string;frozen_at:string;cohort:unknown[]};
type ArchiveRun={trade_date:string;prior_date:string;status:string;finished_at:string|null;results:unknown[]};
type PriceRow={date:string;code:string;price:string|number;created_at:string};
const label:Record<string,string>={
  PREVIOUS_REFERENCE:"前夜の保存参考値",
  "09:00":"9:00 始値（仮定）",
  "09:05":"9:05 始値（仮定）",
  "09:15":"9:15 始値（仮定）",
  "09:30":"9:30 始値（仮定）",
};
const exitName:Record<number,string>={0:"当日引け",1:"1営業日後",3:"3営業日後",5:"5営業日後"};
const yen=(n:number|null|undefined)=>typeof n==="number"&&Number.isFinite(n)?
  Math.round(n).toLocaleString("ja-JP")+"円":"未保存";
const pnl=(n:number|null|undefined)=>typeof n==="number"&&Number.isFinite(n)?
  (n>0?"+":"")+Math.round(n).toLocaleString("ja-JP")+"円":"未検証";

export default async function NightEntryHoldingPage(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  let frozen:FrozenRun[]=[],archives:ArchiveRun[]=[],saved:PriceRow[]=[];
  let baseError=false,futureError=false;
  try {
    const [f,a]=await Promise.all([
      pool.query<FrozenRun>(
        "SELECT trade_date::text,prior_date::text,frozen_at::text,cohort "+
        "FROM public.morning_final_check_runs WHERE policy_version=$1 "+
        "ORDER BY trade_date DESC LIMIT 45",[MORNING_FINAL_POLICY]),
      pool.query<ArchiveRun>(
        "SELECT trade_date::text,prior_date::text,status,finished_at::text,results "+
        "FROM public.entry_time_shadow_runs WHERE policy_version=$1 "+
        "ORDER BY trade_date DESC LIMIT 65",[ENTRY_TIME_SHADOW_VERSION]),
    ]);
    frozen=f.rows;archives=a.rows;
  }catch(error){
    console.error("night-entry holding archive read failed",error);
    baseError=true;
  }
  const symbols=[...new Set(frozen.flatMap(r=>Array.isArray(r.cohort)?
    r.cohort.map(c=>String((c as {code?:unknown})?.code??"")).filter(c=>/^[0-9]{4}$/.test(c)):[]))];
  const dates=new Set<string>();
  let calendarError=false;
  for(const r of frozen){
    try{
      const targets=holdingTradingDates(r.trade_date,isTseTradingDate);
      for(const horizon of [1,3,5])dates.add(targets[horizon]);
    }catch{calendarError=true;}
  }
  if(!baseError&&symbols.length&&dates.size){
    try{
      const result=await pool.query<PriceRow>(
        "SELECT DISTINCT ON (date,code) date::text,code,price,created_at::text "+
        "FROM public.daily_stock_results "+
        "WHERE date=ANY($1::text[]) AND code=ANY($2::text[]) "+
        "ORDER BY date,code,created_at DESC",
        [[...dates],symbols]);
      saved=result.rows;
    }catch(error){
      console.error("night-entry holding later reference read failed",error);
      futureError=true;
    }
  }
  const observations=baseError?[]:buildNightHoldingStudy({
    frozenRuns:frozen,archiveRuns:archives,priceRows:futureError?[]:saved,
    isTradingDate:isTseTradingDate,now:new Date(),
  });
  const stats=summarizeNightHolding(observations);
  const latest=observations.slice(0,12);

  return <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-3 px-3 pt-4">
      <Link href="/admin/night-morning-watch" className="text-sm font-black text-blue-700">
        ← 翌朝9時・勝率重視候補へ
      </Link>
      <header className="rounded-2xl border border-indigo-200 bg-white p-4">
        <p className="text-[11px] font-black tracking-widest text-indigo-700">OWNER PRIVATE / FROZEN FORWARD / SHADOW ONLY</p>
        <h1 className="mt-2 text-2xl font-black">🔬 前夜候補 × 買う時刻 × その後の株価</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          前夜に固定された<strong>同じ最大5銘柄</strong>を対象に、
          「前夜の参考値・9:00・9:05・9:15・9:30」から
          当日・1・3・5営業日後まで持った場合の参考損益を比較します。
          <strong>実際の売買や購入推奨ではありません。</strong>
        </p>
        <p className="mt-2 text-xs leading-5 text-amber-900">
          前夜参考値は夜間約定価格ではありません。
          翌朝の参考価格はYahoo 5分足の始値。1・3・5営業日後は
          SIGN​ALXの日次スキャン保存価格であり、確定終値・実約定を保証しません。
          将来値は事前候補の選定に使いません。
        </p>
      </header>

      <section className="rounded-2xl border border-blue-100 bg-white p-4">
        <h2 className="text-lg font-black">📋 データの揃い具合</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          前夜18時以降・翌朝より前に固定された記録と、
          独立した大引け後の5分足研究が一致する銘柄日のみ対象。
          古い研究では9:00・9:15の値を保存していないため、その欄は未保存になります。
        </p>
        {baseError?<p role="alert" className="mt-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          前夜固定または当日研究を取得できませんでした。架空の値で補完しません。
        </p>:null}
        {futureError?<p role="alert" className="mt-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          後日の参考価格を取得できません。将来日損益は表示できません。
        </p>:null}
        {calendarError?<p className="mt-2 text-xs text-amber-800">
          一部の取引日は営業日カレンダーで対象日を確認できず、計算から除外しました。
        </p>:null}
        <p className="mt-3 font-black">照合できた前夜固定候補：{observations.length}銘柄日</p>
        <p className="mt-1 text-xs text-slate-500">
          後日の参照価格が揃うまで、件数・プラス率は増えません。
          欠損を損失ゼロ円や「見送り成功」に置き換えません。
        </p>
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">📊 同じ銘柄で5つの購入タイミングを比較</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          各保有期間について5つの時刻の価格がすべて揃った銘柄だけを比較。
          最低{NIGHT_HOLDING_MIN_STOCK_DAYS}銘柄日・{NIGHT_HOLDING_MIN_DAYS}営業日の
          検証前は勝率や優劣を表示しません。
        </p>
        {stats.map(s=><div key={s.horizon} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-black">{exitName[s.horizon]}</h3>
            <span className="text-xs font-bold text-slate-500">
              {s.paired}銘柄日 / {s.days}営業日
            </span>
          </div>
          {!s.sufficient?<p className="mt-2 text-xs font-bold text-amber-800">
            検証不足：全時刻と終了時点が揃うまで成績は未判定
          </p>:
          <div className="mt-2 space-y-1.5">
            {s.comparison.map(item=><div key={item.slot}
              className="flex items-center justify-between gap-2 border-t border-slate-200 pt-1.5 text-xs">
              <span>{label[item.slot]}</span>
              <span className="text-right font-black">
                {pnl(item.avgPnl100)} / {item.winRate?.toFixed(1)}%
              </span>
            </div>)}
          </div>}
        </div>)}
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">🔎 個別銘柄の答え合わせ</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          少数でも事実確認用に表示しますが、勝ちパターンだとは判定しません。
          「未保存」は推測していないという意味です。
        </p>
        {!baseError&&latest.length===0?<p className="mt-3 text-sm text-slate-600">
          事前固定と当日価格が一致する研究記録はまだありません。保存済みデータを待ちます。
        </p>:null}
        <div className="mt-2 space-y-2">
          {latest.map(row=><details key={row.date+":"+row.code}
            className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-black">
              {row.date} / {row.code} {row.name} / AI {row.score}
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              前夜固定：{new Date(row.freezeAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}
              （日本時間）
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead><tr className="border-b">
                  <th className="px-1 py-2">仮の購入価格</th>
                  {NIGHT_HOLDING_HORIZONS.map(h=><th key={h} className="px-1 py-2">{exitName[h]}</th>)}
                </tr></thead>
                <tbody>
                  {NIGHT_HOLDING_SLOTS.map(slot=><tr key={slot} className="border-b last:border-0">
                    <td className="px-1 py-2">
                      <b>{label[slot]}</b><span className="block text-slate-500">{yen(row.entries[slot])}</span>
                    </td>
                    {NIGHT_HOLDING_HORIZONS.map(h=><td className="px-1 py-2 font-bold" key={h}>
                      {pnl(holdingPnl100(row,slot,h))}
                    </td>)}
                  </tr>)}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              参考売却価格：{NIGHT_HOLDING_HORIZONS.map(h=>
                exitName[h]+" "+(row.targetDates[h]??"")+" "+yen(row.exits[h])
              ).join(" ／ ")}
            </p>
            <Link href={"/chart/"+row.code} className="mt-2 block text-sm font-bold text-blue-700">
              銘柄チャート →
            </Link>
          </details>)}
        </div>
      </section>

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">
        ⚠ 夜間に購入したという意味ではありません。
        朝の5分足は実際にその株数を約定できるとは限らず、日次スキャンの保存価格は
        当日の正式な終値ではない可能性があります。
        分割・配当・売買停止・手数料・税金・スリッページ・待機中の機会損失は未反映。
        後から好成績の銘柄だけを選ばず、欠損・外れ値も監査対象として残します。
        この画面は読み取り専用で、学習・予測・通知・注文へは接続しません。
      </p>
      <p className="px-1 text-[10px] text-slate-500">{NIGHT_HOLDING_POLICY}</p>
    </div>
    <BottomNav />
  </main>;
}
