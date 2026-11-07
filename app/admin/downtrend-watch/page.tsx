import Link from "next/link";
import {notFound} from "next/navigation";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import PushNotificationButton from "@/app/components/push/PushNotificationButton";
export const dynamic="force-dynamic";
type Watch={code:string;name:string;state:string|null;checked_at:string|null;notified_at:string|null;observation:{reason?:string;price?:number;barTime?:number}|null};
export default async function DowntrendWatchPage(){
  const {isOwner,email}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  const {rows}=await pool.query<Watch>(`
    SELECT f.code,f.name,w.state,w.checked_at::text,w.notified_at::text,w.observation
    FROM public.user_favorites f LEFT JOIN public.owner_downtrend_watch w
      ON w.owner_email=f.user_email AND w.code=f.code
    WHERE f.user_email=$1 ORDER BY f.added_at,f.code
  `,[email]);
  return <main className="mx-auto max-w-2xl space-y-4 px-3 py-5 pb-24">
    <Link href="/admin/learning-hub" className="text-sm text-blue-700">← 学習管理</Link>
    <h1 className="text-xl font-black">お気に入りの下落傾向通知</h1>
    <p className="text-sm leading-6">
      お気に入りの{rows.length}銘柄を監視。取引時間中に5分ごとに確認します。
      確定5分足3本の終値と高値の切り下がり、BB中心線の下向き・価格が線より下、
      直前3本と比べた出来高1.2倍以上が揃うと「下落傾向に入りました」と通知します。
    </p>
    <PushNotificationButton />
    <p className="text-xs leading-5">
      Yahoo参考価格を使用。最新確定足から20分超のデータは確認待ち。
      1回の取得は最大160銘柄。同じ下落状態の通知を抑え、条件が外れた異なる確定足を2回確認してから再通知可能になります。
      お気に入りから外した銘柄は監視対象から外れます。
    </p>
    <Link href="/favorites" className="inline-block text-sm font-bold text-blue-700">お気に入りを変更する →</Link>
    {!rows.length&&<p className="rounded-xl border p-3 text-sm">お気に入りに銘柄を追加すると監視対象になります。</p>}
    {rows.map(row=><article key={row.code} className="rounded-xl border p-3">
      <h2 className="font-bold">{row.code} {row.name}</h2>
      <p className="text-xs">{row.state==="NOTIFIED"?"下落通知済み":row.state==="CLAIMED"?"配信状況確認中":row.checked_at?"条件・価格確認待ち":"初回チェック待ち"}</p>
      {row.checked_at&&<p className="text-xs">確認 {new Date(row.checked_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</p>}
      {row.observation?.price&&<p className="text-xs">参考 {row.observation.price.toLocaleString("ja-JP")}円</p>}
      {row.notified_at&&<p className="text-xs">前回通知 {new Date(row.notified_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</p>}
    </article>)}
    <Link href="/admin/uptrend-watch" className="text-sm text-blue-700">上昇傾向の監視を見る →</Link>
  </main>;
}
