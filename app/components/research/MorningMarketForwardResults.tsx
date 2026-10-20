import "server-only";
import pool from "@/app/lib/postgres";
import {
  MARKET_FORWARD_POLICY,MARKET_FORWARD_MIN_STOCK_DAYS,MARKET_FORWARD_MIN_DAYS,
  MARKET_FORWARD_GROUP_MIN_STOCK_DAYS,MARKET_FORWARD_GROUP_MIN_DAYS,
  summarizeMorningMarketForward
} from "@/app/lib/research/morningMarketForward.mjs";

type Snapshot={trade_date:string;policy_version:string;state:string;
  captured_at:string|null;quotes:Record<string,unknown>};
type Row={trade_date:string;cohort:Record<string,unknown>[];
  morning_observations:Record<string,unknown>[];
  closing_results:Record<string,unknown>[];
  morning_saved_at:string|null;closing_saved_at:string|null};
const money=(n:number|null)=>n===null||!Number.isFinite(n)?"—":
  (n>0?"+":"")+Math.round(n).toLocaleString("ja-JP")+"円";
const pct=(n:number|null)=>n===null||!Number.isFinite(n)?"検証不足":
  n.toFixed(1)+"%";

export default async function MorningMarketForwardResults(){
  let snapshots:Snapshot[]=[];
  let rows:Row[]=[];
  let error=false;
  try{
    const out=await pool.query<Snapshot>(
      "SELECT trade_date::text,policy_version,state,captured_at::text,quotes "+
      "FROM public.morning_market_forward_runs WHERE policy_version=$1 "+
      "ORDER BY trade_date DESC LIMIT 90",[MARKET_FORWARD_POLICY]);
    snapshots=out.rows;
    if(snapshots.length){
      const dates=snapshots.map(r=>r.trade_date);
      const historical=await pool.query<Row>(
        "SELECT trade_date::text,cohort,morning_observations,closing_results,"+
        "morning_saved_at::text,closing_saved_at::text "+
        "FROM public.morning_final_check_runs "+
        "WHERE policy_version='FROZEN_NIGHT_0905_CHECK_V1' "+
        "AND trade_date=ANY($1::date[])",[dates]);
      rows=historical.rows;
    }
  }catch(e){
    console.error("morning-market-forward report unavailable",e);
    error=true;
  }
  const summary=summarizeMorningMarketForward(error?[]:snapshots,error?[]:rows);
  const topCombos=summary.groups.filter(g=>g.type==="combo")
    .sort((a,b)=>b.samples-a.samples).slice(0,6);
  const others=summary.groups.filter(g=>g.type!=="combo");
  return <section className="rounded-2xl border border-sky-200 bg-white p-4">
    <p className="text-[10px] font-black tracking-widest text-sky-700">
      PREOPEN FORWARD STUDY / OWNER ONLY
    </p>
    <h2 className="mt-1 text-lg font-black">🔬 海外市場 × 為替 × 寄り付き検証</h2>
    <p className="mt-2 text-xs leading-5 text-slate-600">
      8:45時点に固定保存した米国市場・ドル円と、別途9:05に確定した5分足、
      大引け保存結果がそろった同一銘柄・同一営業日だけを突き合わせます。
      PTSは未接続のため除外。現在表示される市場価格を過去の日付に当てはめません。
    </p>
    {error?<p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      研究用テーブルを参照できません。準備・接続状況を確認してください。
    </p>:null}
    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
      <div className="rounded-lg bg-slate-50 p-2">
        <p className="text-[11px] text-slate-500">朝の保存日数</p>
        <p className="mt-1 text-lg font-black">{summary.capturedDays}</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-2">
        <p className="text-[11px] text-slate-500">結果照合件数</p>
        <p className="mt-1 text-lg font-black">{summary.pairs}</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-2">
        <p className="text-[11px] text-slate-500">照合営業日</p>
        <p className="mt-1 text-lg font-black">{summary.days}</p>
      </div>
    </div>
    {!summary.sufficient?<p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
      前向きデータ収集中。全体で{MARKET_FORWARD_MIN_STOCK_DAYS}銘柄日・
      {MARKET_FORWARD_MIN_DAYS}営業日に届くまで、勝率と損益は表示しません。
      これを超えても予測力は未証明です。
    </p>:null}
    {others.length>0?<div className="mt-3 space-y-2">
      <h3 className="text-sm font-black">📊 条件別の観測（集計可能な範囲のみ）</h3>
      {others.map(g=><div key={g.type+g.key}
          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-xs">
        <div>
          <p className="font-bold">{g.label}</p>
          <p className="text-[11px] text-slate-500">{g.samples}銘柄日 / {g.days}営業日</p>
        </div>
        <div className="text-right">
          <p className="font-black">{pct(g.winRate)}</p>
          <p className="text-[11px] text-slate-500">100株平均 {money(g.averagePnl100)}</p>
        </div>
      </div>)}
    </div>:null}
    {topCombos.length>0?<details className="mt-3 rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-black">
        米国市場・為替・寄り付きの組み合わせ（最多6条件）
      </summary>
      <div className="mt-2 space-y-2">
        {topCombos.map(g=><div key={g.key} className="rounded-lg bg-slate-50 p-2 text-xs">
          <p className="font-bold">{g.label}</p>
          <p className="mt-1 text-slate-500">
            {g.samples}銘柄日 / {g.days}営業日　
            {g.sufficient?pct(g.winRate)+" / 100株平均 "+money(g.averagePnl100):"検証不足"}
          </p>
        </div>)}
      </div>
    </details>:null}
    <p className="mt-3 text-[11px] leading-5 text-slate-500">
      条件別の数値表示には、全体の件数・日数に加え、
      各条件{MARKET_FORWARD_GROUP_MIN_STOCK_DAYS}銘柄日・
      {MARKET_FORWARD_GROUP_MIN_DAYS}営業日以上が必要です。
      9:05の参考価格は実約定値ではありません。
      米国株と為替は日足参考値で遅延・修正される場合があります。
      結果は事後の相関比較で、因果関係・翌日勝率・収益を保証しません。
      通知・AI POWER・自動売買とは接続していません。
    </p>
  </section>;
}
