import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import BottomNav from "@/app/components/BottomNav";
import { wasArchivedBeforeOpen } from "@/app/lib/research/externalAiArchive.mjs";
import { archiveExternalForecast } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ArchivedEntry = {
  id:string; recorded_at:string; trade_date:string; provider_name:string;
  code:string; stock_name:string; buy_limit:string;
  original_post_url:string|null; claimed_published_at:string|null; source_note:string|null;
};
type SignalXRun = {
  trade_date:string; status:string; planned:number; completed:number;
};
type PageProps = { searchParams:Promise<{result?:string}> };
const yen = (value:string) => Number(value).toLocaleString("ja-JP",{maximumFractionDigits:3})+"円";
const jstTime = (value:string) => new Intl.DateTimeFormat("ja-JP",{
  timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hour12:false
}).format(new Date(value));

function localTradeDate() {
  const parts = new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date());
  const item=(type:string)=>parts.find(p=>p.type===type)?.value??"";
  return item("year")+"-"+item("month")+"-"+item("day");
}

export default async function ExternalAiAuditPage({searchParams}:PageProps) {
  const owner=await getLearningOwnerSession();
  if (!owner.isOwner) notFound();
  const search=await searchParams;
  let entries:ArchivedEntry[]=[];
  let runs:SignalXRun[]=[];
  let archiveUnavailable=false;
  let signalxUnavailable=false;
  try {
    const {rows}=await pool.query<ArchivedEntry>(
      "SELECT id::text,recorded_at::text,trade_date::text,provider_name,code,stock_name,"+
      "buy_limit::text,original_post_url,claimed_published_at::text,source_note "+
      "FROM public.external_ai_forecast_archive ORDER BY trade_date DESC,id DESC LIMIT 80");
    entries=rows;
  } catch(error) {
    console.error("External forecast archive unavailable",error);
    archiveUnavailable=true;
  }
  if (!archiveUnavailable && entries.length) {
    try {
      const {rows}=await pool.query<SignalXRun>(
        "SELECT trade_date::text,status,jsonb_array_length(cohort)::int AS planned,"+
        "(SELECT COUNT(*)::int FROM jsonb_array_elements(results) r "+
        "WHERE r->>'complete'='true') AS completed "+
        "FROM public.entry_time_shadow_runs WHERE trade_date=ANY($1::date[]) "+
        "ORDER BY trade_date DESC LIMIT 50",
        [[...new Set(entries.map(e=>e.trade_date))]]
      );
      runs=rows;
    } catch(error) {
      console.error("External forecast match coverage unavailable",error);
      signalxUnavailable=true;
    }
  }
  const preOpen=entries.filter(e=>wasArchivedBeforeOpen(e.trade_date,e.recorded_at)).length;
  const groups=[...new Set(entries.map(e=>e.trade_date))];
  const runByDate=new Map(runs.map(r=>[r.trade_date,r]));
  const resultMessage:Record<string,string>={
    saved:"研究専用の履歴へ追加しました。保存後の修正や削除はできません。",
    duplicate:"同じ提供元・取引日・銘柄・指値の記録が既にあります。重複保存しませんでした。",
    invalid:"入力内容を確認してください。銘柄コード、日付、価格、httpsのURL形式に注意。",
    unavailable:"保存できませんでした。専用DBのマイグレーションと接続状態を確認してください。"
  };
  return <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-4 px-3 pt-4 sm:px-5">
      <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-700">← 学習データ・管理室</Link>
      <header className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold text-indigo-600">🔒 OWNER ONLY / SHADOW AUDIT</p>
        <h1 className="mt-1 text-2xl font-black">🧪 他社AI予測・比較研究</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          他社AIの公表銘柄と買い検討ラインを、そのまま時刻付きで保存。
          同日のSIGNALX候補と並べて確認します。実注文、疑似購入、
          AI POWER、学習データ、LINE通知は変更しません。
        </p>
      </header>
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6">
        <strong>まだAI同士の勝敗を判定しない研究段階です。</strong>
        <p>保存時刻はSIGNALX側が自動記録します。寄り前に保存しても、元投稿の公開時刻が本物かは別途確認が必要です。
        過去のスクショは「参考記録」とし、過去の成功例へ後付けで算入しません。</p>
        <p>指値が安値に届いても約定確定とは限らず、手数料・税・売買時刻がそろうまでは利益比較を行いません。</p>
      </section>
      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border bg-white p-3"><p className="text-[11px] text-slate-500">直近保存</p><p className="mt-1 text-xl font-black">{entries.length}件</p></div>
        <div className="rounded-xl border bg-white p-3"><p className="text-[11px] text-slate-500">寄り前に保存</p><p className="mt-1 text-xl font-black">{preOpen}件</p></div>
        <div className="rounded-xl border bg-white p-3"><p className="text-[11px] text-slate-500">後から参考保存</p><p className="mt-1 text-xl font-black">{entries.length-preOpen}件</p></div>
      </section>
      {search.result && resultMessage[search.result] &&
        <p className="rounded-xl border bg-white p-3 text-sm font-bold">{resultMessage[search.result]}</p>}
      {archiveUnavailable && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800">
        専用の研究テーブルへ接続できません。開発DBで確認後、本番DBに適用するまでは新画面の保存を使えません。
      </p>}
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-black">✍️ 外部AIの予測を記録</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">1銘柄ずつ登録。登録直後にタイムスタンプを固定します。元の投稿時刻・投稿URLは任意ですが、記入しても自動で真正性を保証しません。</p>
        <form action={archiveExternalForecast} className="mt-3 grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs font-bold">提供元
            <input name="providerName" required maxLength={60} placeholder="例：オニオンサーモン" className="mt-1 w-full rounded-lg border p-3 text-base font-normal"/>
          </label>
          <label className="text-xs font-bold">取引日
            <input type="date" name="tradeDate" required defaultValue={localTradeDate()} className="mt-1 w-full rounded-lg border p-3 text-base font-normal"/>
          </label>
          <label className="text-xs font-bold">銘柄コード
            <input name="code" required maxLength={4} placeholder="285A" className="mt-1 w-full rounded-lg border p-3 text-base font-normal"/>
          </label>
          <label className="col-span-2 text-xs font-bold">銘柄名
            <input name="stockName" required maxLength={80} placeholder="例：キオクシアHD" className="mt-1 w-full rounded-lg border p-3 text-base font-normal"/>
          </label>
          <label className="col-span-2 text-xs font-bold">買い検討ライン（円）
            <input name="buyLimit" inputMode="decimal" required placeholder="13662" className="mt-1 w-full rounded-lg border p-3 text-base font-normal"/>
          </label>
          <label className="col-span-2 text-xs font-bold">元投稿URL（確認可能なとき）
            <input type="url" name="originalPostUrl" maxLength={1800} placeholder="https://..." className="mt-1 w-full rounded-lg border p-3 text-base font-normal"/>
          </label>
          <label className="col-span-2 text-xs font-bold">元投稿時刻（日本時間・申告値）
            <input type="datetime-local" name="publishedAtJst" className="mt-1 w-full rounded-lg border p-3 text-base font-normal"/>
          </label>
          <label className="col-span-2 text-xs font-bold">確認メモ
            <textarea name="sourceNote" maxLength={400} rows={2} placeholder="投稿画像で発見、公開日時は未確認など" className="mt-1 w-full rounded-lg border p-3 text-sm font-normal"/>
          </label>
          <button type="submit" disabled={archiveUnavailable}
            className="col-span-2 rounded-xl bg-indigo-700 p-3 text-base font-black text-white disabled:bg-slate-400">
            💾 予測を変更不可の履歴に保存
          </button>
        </form>
        <p className="mt-2 text-xs leading-5 text-slate-500">保存後は編集・削除できません。入力ミスがあった場合は別途訂正記録を残す方式で扱います。</p>
      </section>
      <section className="rounded-2xl border bg-white p-3">
        <h2 className="text-lg font-black">⚖️ SIGNALXと同じ日付で照合</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">同日の候補数とデータ完備数だけを比較。対象銘柄の選び方・発表時刻・売却条件が異なるので現段階の勝率比較は不可。</p>
        {signalxUnavailable && <p className="mt-2 text-sm text-red-700">SIGNALX側の保存履歴を読み込めません。</p>}
        {groups.length===0 && <p className="mt-3 text-sm text-slate-600">まだ登録がありません。</p>}
        {groups.map(day=>{
          const members=entries.filter(e=>e.trade_date===day);
          const match=runByDate.get(day);
          return <div key={day} className="mt-3 rounded-xl border bg-slate-50 p-3">
            <strong>{day}</strong>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-white p-2"><span className="text-xs text-slate-500">外部AI</span><p className="font-bold">{members.length}件</p></div>
              <div className="rounded-lg bg-white p-2"><span className="text-xs text-slate-500">SIGNALX</span><p className="font-bold">{match?match.planned+"候補／完全"+match.completed:"対応記録なし"}</p></div>
            </div>
            <p className="mt-2 text-xs font-bold text-amber-800">勝敗：未判定／公平な条件の照合待ち</p>
          </div>;
        })}
      </section>
      <section className="rounded-2xl border bg-white p-3">
        <h2 className="text-lg font-black">💾 保存した予測（直近80件）</h2>
        {entries.length===0 && <p className="mt-2 text-sm text-slate-600">まだ履歴はありません。</p>}
        {entries.map(entry=>{
          const early=wasArchivedBeforeOpen(entry.trade_date,entry.recorded_at);
          return <article key={entry.id} className="mt-3 rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <strong className="text-base">{entry.code} {entry.stock_name}</strong>
              <span className={"shrink-0 rounded-full px-2 py-1 text-[10px] font-bold "+(early?"bg-blue-50 text-blue-700":"bg-slate-100 text-slate-600")}>
                {early?"寄り前に保存":"参考記録"}
              </span>
            </div>
            <p className="mt-1 text-sm font-bold">{entry.provider_name} ／ {yen(entry.buy_limit)}</p>
            <p className="mt-1 text-xs text-slate-600">取引日 {entry.trade_date} ／ SIGNALX記録 {jstTime(entry.recorded_at)}</p>
            {entry.claimed_published_at && <p className="mt-1 text-xs text-slate-600">投稿時刻（自己申告） {jstTime(entry.claimed_published_at)}</p>}
            {entry.original_post_url && <a href={entry.original_post_url} target="_blank" rel="noopener noreferrer"
              className="mt-1 block break-all text-xs text-blue-700 underline">原投稿URL（未検証）</a>}
            {entry.source_note && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{entry.source_note}</p>}
            <p className="mt-1 text-xs text-amber-800">公開時刻・約定・成績は未検証／AI学習には使用しない</p>
          </article>;
        })}
      </section>
    </div><BottomNav/>
  </main>;
}
