import Link from "next/link";
import {notFound} from "next/navigation";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
export const dynamic="force-dynamic";
type Candidate={code:string;name:string;price:number;reasons:string[];volumeRatio:number;ma75?:{status:string;value?:number;rising?:boolean;above?:boolean;breakout?:boolean;distancePercent?:number}};
type Run={trade_date:string;state:string;analyzed_at:string|null;universe_count:number;evaluated_count:number;excluded_count:number;candidates:Candidate[];note:string|null};
export default async function NightJquantsPage(){
 const {isOwner,email}=await getLearningOwnerSession();
 if(!isOwner)notFound();
 const {rows}=await pool.query<Run>(`SELECT trade_date::text,state,analyzed_at::text,universe_count,evaluated_count,excluded_count,candidates,note
 FROM public.owner_night_jquants WHERE owner_email=$1 ORDER BY trade_date DESC LIMIT 1`,[email]);
 const run=rows[0];
 return <main className="mx-auto max-w-2xl space-y-4 px-3 py-5 pb-24">
 <Link href="/admin/learning-hub" className="text-sm text-blue-700">← 学習管理</Link>
 <h1 className="text-xl font-black">🌙 J-Quants日足・翌営業日の監視候補</h1>
 <p className="text-sm leading-6">引け後に953銘柄の直近40営業日の日足で候補を抽出し、MA75の確認用に最大85営業日の日足をJ-Quantsから取得して、上昇チャート形とBB上側トレンドを確認します。
 17:10に取得し、未完了なら19:00・19:40に再試行。候補があれば19:50を目安に本人へ通知します。</p>
 <Link href="/admin/uptrend-watch" className="block font-bold text-blue-700">📈 翌営業日はYahooの5分足で継続を確認 →</Link>
 <p className="text-xs leading-5">夜の通知は監視候補の更新です。翌営業日の場中に上昇継続条件を満たすと別途通知します。
 日足は調整済み価格を使用。BBと上昇形の重なり、出来高20日平均比の順に表示します。利益確率を示す順位ではありません。MA75は候補の確認情報として表示し、候補選定・順位・通知条件には加えていません。</p>
 {!run?<p className="rounded-xl border p-3">初回の営業日収集待ちです。</p>:<>
 <section className="rounded-xl border p-3 text-sm">
 <p className="font-bold">{run.trade_date} ／ {["READY","CLAIMED","NOTIFIED"].includes(run.state)?"分析完了":"取得・分析待ち"}</p>
 <p>分析 {run.evaluated_count} / {run.universe_count||953}銘柄 ／ データ不足など {run.excluded_count}銘柄 ／ 候補 {run.candidates.length}銘柄</p>
 {run.analyzed_at&&<p>分析日時 {new Date(run.analyzed_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</p>}
 <p>通知状態：{run.state==="NOTIFIED"?(run.note==="NO_CANDIDATES"?"該当なし・通知なし":"通知済み"):run.state==="CLAIMED"?"送信状況確認中":run.state==="READY"?"通知時刻・受信設定待ち":"未完了"}</p>
 {run.note&&run.state==="PENDING"&&<p className="text-amber-800">取得状況：{run.note}。当日の日足が揃うまで確定候補として配信しません。</p>}
 </section>
 {run.candidates.map(row=><article key={row.code} className="rounded-xl border p-3">
 <Link href={"/analysis/"+row.code} className="font-bold text-blue-700">{row.code} {row.name} →</Link>
 <p className="text-sm">終値 {row.price.toLocaleString("ja-JP")}円 ／ 出来高20日平均比 {row.volumeRatio.toFixed(2)}倍</p>
 <p className="text-xs leading-5">{row.reasons.join(" ／ ")}</p>
 {row.ma75?.status==="AVAILABLE"?<p className="mt-2 rounded-lg bg-blue-50 p-2 text-xs leading-5">
 MA75 {row.ma75.value!.toLocaleString("ja-JP",{maximumFractionDigits:2})}円 ／ {row.ma75.rising?"上向き":"横ばい・下向き"} ／
 株価は線の{row.ma75.above?"上":"以下"} ／ 乖離 {row.ma75.distancePercent!.toFixed(2)}%
 {row.ma75.breakout?" ／ 上抜け当日":""}
 </p>:<p className="mt-2 text-xs text-slate-600">MA75：連続76営業日の有効な終値が揃うまで確認待ち</p>}
 </article>)}</>}
 </main>;
}
