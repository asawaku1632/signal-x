import Link from "next/link";
import {notFound} from "next/navigation";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import PushNotificationButton from "@/app/components/push/PushNotificationButton";
export const dynamic="force-dynamic";
type Watch={code:string;name:string;signal_date:string;state:string;notified_at:string|null;observation:{reason?:string;price?:number;receivedAt?:string}|null};
export default async function UptrendWatchPage(){
  const {isOwner,email}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  const {rows}=await pool.query<Watch>(`SELECT code,name,signal_date::text,state,notified_at::text,observation
    FROM public.owner_uptrend_watch WHERE owner_email=$1 ORDER BY signal_date DESC,code LIMIT 200`,[email]);
  return <main className="mx-auto max-w-2xl space-y-4 px-3 py-5 pb-24">
    <Link href="/admin/learning-hub" className="text-sm text-blue-700">← 学習管理</Link>
    <h1 className="text-xl font-black">上昇傾向の通知・本人専用</h1>
    <p className="text-sm leading-6">J-Quantsの夜間分析が完了した日は、その上昇候補を優先して翌営業日に監視します。未完了日は既存の日次保存を使用。953銘柄を候補抽出の対象とし、前の2営業日に買いローソク形またはBB上側トレンドが出た銘柄を監視。
      取引時間中に5分ごとに最大160銘柄ずつ巡回し、確定5分足3本の終値と安値の切り上がり、
      BB中心線上昇、直前3本比で出来高1.2倍以上を確認すると通知します。</p>
    <Link href="/admin/night-jquants" className="block text-sm font-bold text-blue-700">🌙 J-Quants日足の夜間分析を見る →</Link>
    <Link href="/admin/new-buy-events" className="block rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">🟢 新規買い条件・成立時の価格とチャートを見る →</Link>
    <p className="text-xs leading-5">高値突破・押し目反発・BB拡大・三角持ち合い・ボックス・フラッグ・ペナント・逆三尊の新規成立は、時刻と参考価格を固定保存して通知します。同じ銘柄は1日1回。上昇継続の通知とは分けて記録します。</p>
    <PushNotificationButton />
    <Link href="/admin/downtrend-watch" className="block text-sm font-bold text-blue-700">📉 お気に入りの下落傾向通知を見る →</Link>
    <p className="text-xs leading-5">参考株価はYahooの5分足です。最新の確定足から20分超経過したデータは確認待ち。
      通知文に足の開始時刻を表示します。全候補の確認にかかる時間は候補数と取得状況で変わります。同じ銘柄は直近の監視期間内で重複通知を抑えます。</p>
    {!rows.length&&<p className="rounded-xl border p-3 text-sm">初回の場中チェック待ちです。</p>}
    {rows.map(row=><article key={row.code+row.signal_date} className="rounded-xl border p-3">
      <h2 className="font-bold">{row.code} {row.name}</h2>
      <p className="text-xs">形状検出 {row.signal_date} ／ {row.state==="SENT"?"通知済み":row.state==="CLAIMED"?"送信状況確認中":"条件・価格確認待ち"}</p>
      {row.observation?.receivedAt&&<p className="text-xs">価格取得 {new Date(row.observation.receivedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}
        {row.observation.price ? " ／ 参考 "+row.observation.price.toLocaleString("ja-JP")+"円":""}</p>}
    </article>)}
  </main>;
}
