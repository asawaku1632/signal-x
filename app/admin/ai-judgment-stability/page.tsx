import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/app/lib/postgres";
import BottomNav from "@/app/components/BottomNav";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { AI_STABILITY_STUDY_VERSION, evaluateJudgmentStability, summarizeStability, bandLabel } from "@/app/lib/research/aiJudgmentStability.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type ObservationRow = {
  trade_date:string;time_slot:string;code:string;name:string;
  entry_price:number|string;ai_power:number|string;sampled_at:string;
  outcome_date:string;outcome_price:number|string|null;
};
type SavedStock = {source:string;saved_at:string;score:string|null;price:string|null;change_pct:string|null;latest_bar:string|null};
const pct=(v:number|null)=>v===null?"未確定":(v>0?"+":"")+v.toFixed(2)+"%";
const yen=(v:number|null)=>v===null||!Number.isFinite(v)?"—":Math.round(v).toLocaleString("ja-JP")+"円";
const jst=(s:string)=>new Date(s).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
const quoteTime=(str:string|null)=>{
  if(!str)return "不明";
  const n=Number(str);
  return Number.isFinite(n)&&n>0?jst(new Date(n*1000).toISOString()):"不明";
};
async function loadObservations():Promise<ObservationRow[]> {
  const sql=[
    "SELECT o.trade_date::text,o.time_slot,o.code,o.name,",
    "o.entry_price,o.ai_power,o.sampled_at::text,o.outcome_date::text,",
    "d.price AS outcome_price FROM public.golden_zone_observations o",
    "LEFT JOIN public.daily_stock_results d",
    "ON d.date=o.outcome_date::text AND d.code=o.code",
    "WHERE o.trade_date >= (CURRENT_DATE - INTERVAL '45 days')::date",
    "ORDER BY o.trade_date DESC,o.code ASC,o.sampled_at ASC LIMIT 10000"
  ].join(" ");
  const {rows}=await pool.query<ObservationRow>(sql);
  return rows;
}
async function loadFixedObservations():Promise<ObservationRow[]> {
  const sql=[
    "SELECT o.trade_date::text,o.time_slot,o.code,o.name,",
    "o.entry_price,o.ai_power,o.snapshot_saved_at::text AS sampled_at,",
    "o.outcome_date::text,d.price AS outcome_price",
    "FROM public.ai_judgment_fixed_cohort_observations o",
    "LEFT JOIN public.daily_stock_results d ON d.date=o.outcome_date::text AND d.code=o.code",
    "WHERE o.trade_date >= (CURRENT_DATE - INTERVAL '45 days')::date",
    "ORDER BY o.trade_date DESC,o.code ASC,o.snapshot_saved_at ASC LIMIT 2000"
  ].join(" ");
  const {rows}=await pool.query<ObservationRow>(sql);
  return rows;
}
async function loadSnapshotComparison(code:string):Promise<SavedStock[]> {
  const sql=[
    "SELECT '全銘柄スキャン' AS source, updated_at::text AS saved_at,",
    "(SELECT s->>'score' FROM jsonb_array_elements(payload->'stocks') s WHERE s->>'code'=$1 LIMIT 1) AS score,",
    "(SELECT s->>'price' FROM jsonb_array_elements(payload->'stocks') s WHERE s->>'code'=$1 LIMIT 1) AS price,",
    "(SELECT s->>'changePercent' FROM jsonb_array_elements(payload->'stocks') s WHERE s->>'code'=$1 LIMIT 1) AS change_pct,",
    "(SELECT s->>'latestBarTimestamp' FROM jsonb_array_elements(payload->'stocks') s WHERE s->>'code'=$1 LIMIT 1) AS latest_bar",
    "FROM public.display_snapshots WHERE snapshot_key='scan:latest'",
    "AND jsonb_typeof(payload->'stocks')='array'",
    "UNION ALL SELECT '個別銘柄スキャン',updated_at::text,payload->>'score',payload->>'price',",
    "payload->>'changePercent',payload->>'latestBarTimestamp'",
    "FROM public.display_snapshots WHERE snapshot_key='scan:stock:'||$1"
  ].join(" ");
  const {rows}=await pool.query<SavedStock>(sql,[code]);
  return rows;
}
export default async function StabilityPage({searchParams}:{
  searchParams:Promise<{code?:string}>;
}) {
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner) notFound();
  const params=await searchParams;
  const code=/^[0-9]{4}$/.test(params.code??"")?params.code!:"3762";
  let archive:ObservationRow[]=[];let fixedArchive:ObservationRow[]=[];let saved:SavedStock[]=[];
  let archiveError=false,snapshotError=false,fixedError=false;
  try {fixedArchive=await loadFixedObservations();} catch(e){console.error("fixed stability read",e);fixedError=true;}
  try {archive=await loadObservations();} catch(e){console.error("stability archive read",e);archiveError=true;}
  try {saved=await loadSnapshotComparison(code);} catch(e){console.error("stability snapshot read",e);snapshotError=true;}
  const results=evaluateJudgmentStability(archive);
  const fixedResults=evaluateJudgmentStability(fixedArchive);
  const fixedStats=summarizeStability(fixedResults);
  const fixedSelected=fixedResults.filter(r=>r.code===code).slice(0,10);
  const fixedReady=fixedStats.days>=20&&fixedStats.changed.judged>=30&&fixedStats.stable.judged>=30;
  const stats=summarizeStability(results);
  const selected=results.filter(r=>r.code===code).slice(0,12);
  const moving=results.filter(r=>r.group==="CHANGED").slice(0,20);
  const mature=stats.days>=20&&stats.changed.judged>=30&&stats.stable.judged>=30;
  return <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-3 px-3 pt-4">
      <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-700">← 学習管理室</Link>
      <header className="rounded-2xl border border-blue-100 bg-white p-4">
        <p className="text-[11px] font-black tracking-widest text-indigo-600">OWNER ONLY / SHADOW ONLY</p>
        <h1 className="mt-1 text-2xl font-black">🔁 AI判定の揺れ・安定性研究</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          既存の時間帯別AI POWER保存記録を比較します。同じ銘柄の判定帯が一日の中で何回変わったかを集計。
          翌営業日の参考株価が保存された場合のみ、その後の騰落と比較します。
          実際の売買・疑似購入・AI POWER・通知には一切影響しません。
        </p>
      </header>
      <section className="rounded-xl border border-blue-100 bg-white p-3">
        <h2 className="text-lg font-black">🧭 新研究：前夜の同じ5銘柄を追跡</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          前日AI POWER85以上の上位5銘柄を固定し、翌日の既存7時点で保存。
          途中で「買い候補」から「見送り」に落ちても追跡対象から外しません。
          保存済みスキャンの株価データが25分以上古い場合・取得時刻不明の場合は記録を見送ります。
          追加のYahoo通信やCronはありません。導入前の過去記録は自動復元しません。
        </p>
        {fixedError?<p className="mt-2 text-xs font-bold text-rose-700">
          研究専用テーブルを読めません。準備状況を確認してください。
        </p>:null}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["追跡した取引日",fixedStats.days+"日"],
            ["2回以上観測",fixedStats.comparable+"銘柄日"],
            ["判定帯が変化",fixedStats.changed.candidates+"銘柄日"],
          ].map(([label,value])=><div key={label} className="rounded-xl bg-slate-50 p-2">
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className="mt-1 text-base font-black">{value}</p>
          </div>)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[{label:"🔁 変化あり",row:fixedStats.changed},
            {label:"🟢 判定帯が安定",row:fixedStats.stable}].map(item=>
            <div key={item.label} className="rounded-xl border p-3">
              <p className="text-sm font-black">{item.label}</p>
              <p className="mt-1 text-xs">対象 {item.row.candidates}件 ／ 翌営業日結果 {item.row.judged}件</p>
              <p className="mt-2 text-xs text-slate-500">翌営業日上昇率</p>
              <p className="text-xl font-black">{item.row.winRate===null?"未確定":item.row.winRate.toFixed(1)+"%"}</p>
              <p className="text-xs text-slate-500">平均騰落 {pct(item.row.avgReturn)}</p>
            </div>)}
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {fixedReady?"研究用の暫定比較。結果には市場環境や銘柄同士の偏りがあります。":
          "まだ十分な実績がありません（目安：20営業日以上・両グループ各30件以上の結果確定）。"}
          判定帯の最終観測時点から翌営業日の保存参考値への騰落です。
        </p>
        {fixedSelected.length>0?<div className="mt-3 border-t pt-2">
          <p className="text-sm font-black">{code} の固定追跡記録</p>
          {fixedSelected.map((row:any)=><details key={row.key} className="mt-2 rounded-lg bg-slate-50 p-3">
            <summary className="text-sm font-bold">{row.date} ／ AI判定帯変更 {row.changes}回</summary>
            <p className="mt-2 text-xs">{row.observations.map((o:{time:string;score:number})=>o.time+" AI "+o.score).join(" → ")}</p>
            <p className="mt-1 text-xs">最後の観測 {row.evaluationSlot} ／ 翌営業日参考騰落 {pct(row.futureReturnPct)}</p>
          </details>)}
        </div>:null}
      </section>
      <h2 className="px-1 pt-2 text-sm font-black text-slate-600">参考：従来の時間別上位30銘柄の保存記録（銘柄構成が時刻ごとに異なる）</h2>
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
        AI POWERの判定帯：95以上「大本命」／85以上「買い候補」／75以上「押し目待ち」／65以上「様子見」／それ未満「見送り」。
        スイング判定やチャートの「現在の行動」とは別物です。
        未観測の時刻を変化なしとみなさず、1回しか観測されていない銘柄は「安定」に含めません。
      </section>
      {archiveError&&<p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">保存履歴の取得に失敗しました。</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["観測した日数",stats.days+"日"],["比較できた銘柄日",stats.comparable+"件"],
          ["判定帯が変化",stats.changed.candidates+"件"],["観測不足",stats.noComparison+"件"],
        ].map(([label,value])=><div key={label} className="rounded-xl border bg-white p-3 text-center">
          <p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p>
        </div>)}
      </div>
      <section className="rounded-xl border bg-white p-3">
        <h2 className="text-lg font-black">📊 判断が変わる銘柄と安定した銘柄</h2>
        <p className="mt-1 text-xs text-slate-500">同日2回以上の観測だけを対象。最後の観測時点から翌営業日の保存参考価格で仮比較（約定価格ではありません）。</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[{label:"🔁 判定帯に変化",row:stats.changed},{label:"🟢 判定帯が同じ",row:stats.stable}].map(x=>
            <div key={x.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-black">{x.label}</p>
              <p className="mt-2 text-xs">比較対象 {x.row.candidates}件</p>
              <p className="text-xs">翌営業日参考値あり {x.row.judged}件</p>
              <p className="mt-2 text-xs text-slate-500">翌営業日上昇率</p>
              <p className="text-xl font-black">{x.row.winRate===null?"未確定":x.row.winRate.toFixed(1)+"%"}</p>
              <p className="text-xs text-slate-500">平均騰落 {pct(x.row.avgReturn)}</p>
              <p className="text-xs text-slate-500">最悪騰落 {pct(x.row.worstReturn)}</p>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          {mature?"暫定集計です。銘柄選抜の偏りがあり、将来の成績を保証しません。":
          "まだ参考サンプルが不足しています。20営業日以上かつ各グループの結果確定30件以上になるまで優劣を判定しません。"}
          翌営業日の参考騰落であり、実際の買値・手数料・税金は反映していません。
        </p>
      </section>
      <section className="rounded-xl border bg-white p-3">
        <h2 className="text-lg font-black">🔎 銘柄別の保存された判定履歴</h2>
        <form method="get" action="/admin/ai-judgment-stability" className="mt-2 flex gap-2">
          <input name="code" type="text" inputMode="numeric" maxLength={4} defaultValue={code}
            aria-label="銘柄コード4桁" className="min-w-0 flex-1 rounded-lg border p-2 text-sm" />
          <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">調べる</button>
        </form>
        <p className="mt-2 text-xs leading-5 text-slate-500">既存の時間帯研究は各時点の上位30銘柄のみを保存してきました。履歴がない銘柄の過去の判断は復元できません。</p>
        {selected.length===0?<p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
          {code} は現在の時間帯研究アーカイブにありません。これはAIが安定していたという意味ではありません。
        </p>:selected.map(r=><details key={r.key} className="mt-2 rounded-xl border p-3" open={selected.length===1}>
          <summary className="cursor-pointer text-sm font-black">{r.date} {r.code} {r.name} ／ 観測 {r.samples}回・帯変更 {r.changes}回</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {r.observations.map((o:{time:string;score:number;band:string;price:number})=><div key={o.time} className="rounded-lg bg-slate-50 p-2 text-xs">
              <p className="font-black">{o.time} ／ AI {o.score}</p>
              <p>{bandLabel(o.band)} ／ {yen(o.price)}</p>
            </div>)}
          </div>
          <p className="mt-2 text-xs">翌営業日参考騰落 {pct(r.futureReturnPct)}</p>
        </details>)}
      </section>
      <section className="rounded-xl border bg-white p-3">
        <h2 className="text-lg font-black">🧪 現在の保存スキャンを突き合わせ</h2>
        <p className="mt-1 text-xs text-slate-500">{code}の全体スキャンと個別スキャン。過去の9時・11時の値の再現ではなく、現在保存されているもの同士の比較です。</p>
        {snapshotError?<p className="mt-2 text-sm text-rose-600">保存スキャンの取得に失敗しました。</p>:
          saved.map(r=><div key={r.source} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-black">{r.source}</p>
            <p className="mt-1 text-xs">保存 {jst(r.saved_at)} ／ 市場データ {quoteTime(r.latest_bar)}</p>
            <p className="mt-1 text-xs">AI {r.score??"—"} ／ 株価 {r.price??"—"}円 ／ スキャン変化率 {r.change_pct??"—"}%</p>
          </div>)}
      </section>
      <section className="rounded-xl border bg-white p-3">
        <h2 className="text-lg font-black">🔀 判定帯が変わった保存履歴</h2>
        {moving.length===0?<p className="mt-2 text-sm text-slate-600">
          保存されている対象では帯変更を確認できません。これはAIの判定が一日中安定していた証明にはなりません。
        </p>:moving.map(r=><details key={r.key} className="mt-2 rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-bold">{r.date} {r.code} {r.name} ／ {r.changes}回・スコア差 {r.scoreRange.toFixed(1)}</summary>
          <p className="mt-2 text-xs leading-6">{r.switches.map(x=>x.fromSlot+" "+bandLabel(x.from)+" → "+x.toSlot+" "+bandLabel(x.to)).join(" ／ ")}</p>
          <p className="text-xs">翌営業日参考騰落：{pct(r.futureReturnPct)}</p>
        </details>)}
      </section>
      <p className="px-1 text-[11px] leading-5 text-slate-500">
        {AI_STABILITY_STUDY_VERSION}。過去の全判定履歴ではなく、既存研究の離散的な観測記録です。
        時刻と銘柄選択の偏り、保存値とリアルタイム株価の差に注意。因果関係・勝率・利益を保証しません。
      </p>
    </div>
    <BottomNav />
  </main>;
}
