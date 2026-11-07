import Link from "next/link";
import {notFound} from "next/navigation";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
export const dynamic="force-dynamic";
type Bar={time:number;open:number;high:number;low:number;close:number;volume:number};
type Signal={kind:string;label:string;level:number;volumeRatio:number};
type Event={code:string;name:string;trade_date:string;bar_time:string;reference_price:string;detected_at:string;state:string;signals:Signal[];evidence:{candles:Bar[]}};
const displayTime=(v:number|string)=>new Date(typeof v==="number"?v*1000:v).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"});
function EventChart({event}:{event:Event}){
 const bars=event.evidence.candles;if(!bars?.length)return null;
 const high=Math.max(...bars.map(b=>b.high),...event.signals.map(s=>s.level));
 const low=Math.min(...bars.map(b=>b.low),...event.signals.map(s=>s.level)),range=Math.max(.01,high-low);
 const y=(p:number)=>30+(high-p)/range*220,x=(i:number)=>50+(i+.5)*695/bars.length;
 return <div className="mt-3 overflow-x-auto rounded-xl border bg-white"><svg viewBox="0 0 760 290" role="img" aria-label="成立時に保存した確定5分足。紫丸は新規条件成立の足。" className="h-auto w-full" style={{minWidth:600}}>
 {[0,1,2,3,4].map(i=><g key={i}><line x1={50} x2={745} y1={y(high-range*i/4)} y2={y(high-range*i/4)} stroke="#e2e8f0"/><text x={45} y={y(high-range*i/4)+4} textAnchor="end" fontSize={10} fill="#475569">{Math.round(high-range*i/4)}</text></g>)}
 {event.signals.map(s=><line key={s.kind} x1={50} x2={745} y1={y(s.level)} y2={y(s.level)} stroke="#d97706" strokeDasharray="5 4"/>)}
 {bars.map((b,i)=>{const xx=x(i),color=b.close>=b.open?"#059669":"#dc2626";return <g key={b.time}>
 <line x1={xx} x2={xx} y1={y(b.high)} y2={y(b.low)} stroke={color}/>
 <rect x={xx-4} y={Math.min(y(b.open),y(b.close))} width={8} height={Math.max(1.5,Math.abs(y(b.open)-y(b.close)))} fill={color}/>
 {i%8===0&&<text x={xx} y={278} fontSize={10} textAnchor="middle" fill="#475569">{new Date(b.time*1000).toLocaleTimeString("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit"})}</text>}
 {b.time===Number(event.bar_time)&&<circle cx={xx} cy={y(b.close)} r={7} fill="white" stroke="#7c3aed" strokeWidth={3}/>}
 </g>;})}
 <text x={745} y={18} textAnchor="end" fontSize={12} fontWeight="bold" fill="#6d28d9">新規成立：{Number(event.reference_price).toLocaleString("ja-JP")}円</text>
 </svg></div>;
}
export default async function Page({searchParams}:{searchParams:Promise<{code?:string;date?:string}>}){
 const {isOwner,email}=await getLearningOwnerSession();if(!isOwner)notFound();
 const {code,date}=await searchParams;
 if(code&&!/^[0-9][0-9A-Z][0-9][0-9A-Z]$/.test(code))notFound();
 if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))notFound();
 const {rows}=await pool.query<Event>(`SELECT code,name,trade_date::text,bar_time::text,reference_price::text,detected_at::text,state,signals,evidence
 FROM public.owner_new_buy_events WHERE owner_email=$1 AND ($2::text IS NULL OR code=$2)
 AND ($3::text IS NULL OR trade_date::text=$3) ORDER BY trade_date DESC,detected_at DESC LIMIT 30`,[email,code??null,date??null]);
 return <main className="mx-auto max-w-3xl space-y-4 px-3 py-5 pb-24">
 <Link href="/admin/uptrend-watch" className="text-sm font-bold text-blue-700">← 上昇監視・通知</Link>
 <h1 className="text-xl font-black">🟢 新規の買い条件・成立記録</h1>
 <p className="text-sm leading-6">本人用・試験運用。高値突破・押し目からの再上昇・BB上方向への拡大を、確定5分足で新しく確認した記録です。参考価格・時刻・理由・当時の42本を固定保存します。約定価格とは異なります。</p>
 <p className="text-xs leading-5">対象は既存の夜間上昇候補。5分ごとに最大160銘柄ずつ巡回します。同じ銘柄の新規成立通知は1日1回。未確定足と古い足は通知せず、送信待ちが20分を超えると配信を止めます。</p>
 {code&&<Link href={"/analysis/"+code} className="block text-sm font-bold text-blue-700">{code}の個別ページへ →</Link>}
 {(code||date)&&<Link href="/admin/new-buy-events" className="block text-sm text-blue-700">全成立記録へ →</Link>}
 {!rows.length&&<p className="rounded-xl border p-4 text-sm">新規成立記録はまだありません。次の取引時間に条件を満たした場合に保存されます。過去の日足の一致位置を、当時の通知実績として扱うことはありません。</p>}
 {rows.map(e=><article key={e.code+e.trade_date} className="rounded-2xl border border-emerald-200 bg-white p-4 text-slate-900">
 <h2 className="text-lg font-black">{e.code} {e.name} ／ {e.trade_date}</h2>
 <p className="mt-2 font-bold text-emerald-800">参考 {Number(e.reference_price).toLocaleString("ja-JP")}円で新規条件成立</p>
 <p className="text-sm">足の確定時刻 {displayTime(Number(e.bar_time)+300)}</p>
 <p className="text-xs">取得・判定 {displayTime(e.detected_at)} ／ 通知：{e.state==="SENT"?"送信済み":e.state==="CLAIMED"?"送信状況確認中":e.state==="EXPIRED"?"時間切れ・配信なし":"受信設定・送信待ち"}</p>
 {e.signals.map(s=><div key={s.kind} className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm"><p className="font-bold">{s.label}</p><p>突破基準 {s.level.toFixed(2)}円 ／ 出来高は直前20本平均の{s.volumeRatio.toFixed(2)}倍</p></div>)}
 <EventChart event={e}/>
 <p className="mt-2 text-xs">紫丸＝新規成立を確認した足。破線＝当時の突破基準。最新価格で再計算せず、保存した判定入力を表示しています。</p>
 </article>)}
 <details className="rounded-xl border p-3 text-xs leading-6"><summary className="cursor-pointer font-bold">今回の条件</summary>
 <p>高値突破：直前20本の高値を終値で0.2%超突破し、直前足では未突破。出来高1.5倍以上。</p>
 <p>押し目反発：上昇後0.5〜3%調整し、押し目3本の高値を終値で0.2%超突破。出来高1.2倍以上。</p>
 <p>BB拡大：直前の幅が過去20本の下位25%以内、幅が20%以上拡大。直前上側バンドを終値で0.2%超突破、出来高1.5倍以上。</p>
 <p>共通：20本中心線より上で中心線上昇。直前足比の上昇3%以内、中心線乖離5%以内。新規成立は利益率を保証する表示ではありません。</p>
 </details></main>;
}
