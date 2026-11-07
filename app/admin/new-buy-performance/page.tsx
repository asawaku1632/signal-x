import Link from "next/link";
import {notFound} from "next/navigation";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {BUY_FAMILIES} from "@/app/lib/freshBuyOutcomes.mjs";
import {freshBuyPerformanceSql} from "@/app/lib/freshBuyPerformanceQuery";
export const dynamic="force-dynamic";
type Stats={family:string;total:number;completed:number;pending:number;excluded:number;positive:number;flat:number;negative:number;average:number|null;median:number|null;worst:number|null;codes:number;dates:number;overlapping:number};
type Run={run_date:string;state:string;started_at:string;finished_at:string|null;stats:{completed?:number;missing?:number;excluded?:number;providerErrors?:number;calendarErrors?:number}|null;note:string|null};
const percent=(v:number|null)=>v===null?"—":(v>0?"+":"")+Number(v).toFixed(2)+"%";
export default async function BuyPerformance({searchParams}:{searchParams:Promise<{horizon?:string;sent?:string;single?:string;version?:string;cost?:string}>}){
 const {isOwner,email}=await getLearningOwnerSession();if(!isOwner)notFound();
 const p=await searchParams;
 const horizon=["1","3","5"].includes(p.horizon??"")?Number(p.horizon):5;
 const sent=p.sent==="1",single=p.single==="1";
 const version=["FRESH_BUY_V1","FRESH_BUY_V2_STRUCTURES"].includes(p.version??"")?p.version!:"ALL";
 const cost=["0","0.2","0.4"].includes(p.cost??"")?Number(p.cost):.2;
 const [result,runs]=await Promise.all([
  pool.query<Stats>(freshBuyPerformanceSql,[email,sent,single,version,cost,horizon]),
  pool.query<Run>(`SELECT run_date::text,state,started_at::text,finished_at::text,stats,note
   FROM public.owner_new_buy_outcome_runs WHERE owner_email=$1`,[email])
 ]);
 const byFamily=new Map(result.rows.map(r=>[r.family,r])),run=runs.rows[0];
 return <main className="mx-auto max-w-4xl space-y-4 px-3 py-5 pb-24">
 <Link href="/admin/new-buy-events" className="text-sm font-bold text-blue-700">← 新規成立記録</Link>
 <h1 className="text-xl font-black">📊 8系統・成立後の成績比較</h1>
 <p className="text-sm leading-6">成立時の参考価格から、1・3・5営業日後のJ-Quants終値への変化を自動追跡します。
 実売買の損益ではなく、配当は含みません。対象日は営業日カレンダーで固定し、価格欠損の日を別の日に置き換えません。</p>
 <form className="grid grid-cols-2 gap-3 rounded-xl border p-3 text-sm sm:grid-cols-3" method="get">
 <label>比較する日<select name="horizon" defaultValue={horizon} className="mt-1 block w-full rounded border p-2">{[1,3,5].map(n=><option key={n} value={n}>{n}営業日後</option>)}</select></label>
 <label>費用の仮定（往復合計）<select name="cost" defaultValue={cost} className="mt-1 block w-full rounded border p-2">{[0,.2,.4].map(n=><option key={n} value={n}>{n.toFixed(1)}%</option>)}</select></label>
 <label>検知ルール<select name="version" defaultValue={version} className="mt-1 block w-full rounded border p-2"><option value="ALL">全バージョン</option><option value="FRESH_BUY_V1">初期3系統（V1）</option><option value="FRESH_BUY_V2_STRUCTURES">形状追加版（V2）</option></select></label>
 <label className="flex items-center gap-2"><input type="checkbox" name="sent" value="1" defaultChecked={sent}/>通知送信済みのみ</label>
 <label className="flex items-center gap-2"><input type="checkbox" name="single" value="1" defaultChecked={single}/>1条件だけの成立に絞る</label>
 <button className="rounded-lg bg-blue-700 px-3 py-2 font-bold text-white">比較する</button>
 </form>
 <p className="text-xs leading-5">表示中：{horizon}営業日後 ／ 費用仮定{cost.toFixed(1)}%控除。
 プラス率は控除後の値が0より大きい件数÷有効件数。費用は比較用の仮定です。
 同じ成立記録が複数系統に該当する場合、それぞれへ1件ずつ計上するため、系統間の件数は合算できません。</p>
 <section className="rounded-xl bg-slate-50 p-3 text-xs leading-5">
 <p className="font-bold">自動追跡：17:30・19:10・19:50（営業日）</p>
 {run?<><p>直近実行 {new Date(run.finished_at??run.started_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})} ／ {run.state==="DONE"?"実行完了":run.state==="RUNNING"?"実行中":"取得エラー"}</p>
 <p>今回の結果確定 {run.stats?.completed??0}件 ／ データ待ち {run.stats?.missing??0}件 ／ 要確認 {run.stats?.excluded??0}件</p>
 {(run.stats?.providerErrors||run.stats?.calendarErrors||run.note)?<p className="text-amber-900">未取得やカレンダー確認待ちがあります。未取得分は成績から除き、次回実行で再確認します。{run.note??""}</p>:null}</>:<p>初回の自動実行待ちです。</p>}
 </section>
 <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[780px] text-left text-xs">
 <thead className="bg-blue-50"><tr>{["系統","成立件数","結果確定","追跡待ち","要確認","プラス率","平均","中央値","最悪","有効銘柄／日数"].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead>
 <tbody>{BUY_FAMILIES.map(([key,label])=>{const s=byFamily.get(key);return <tr key={key} className="border-t">
 <th className="p-3">{label}</th><td className="p-3">{s?.total??0}</td><td className="p-3">{s?.completed??0}</td><td className="p-3">{s?.pending??0}</td><td className="p-3">{s?.excluded??0}</td>
 <td className="p-3">{s?.completed?((s.positive/s.completed)*100).toFixed(1)+"%":"—"}</td>
 <td className="p-3">{percent(s?.average??null)}</td><td className="p-3">{percent(s?.median??null)}</td><td className="p-3">{percent(s?.worst??null)}</td>
 <td className="p-3">{s?.codes??0}銘柄／{s?.dates??0}日</td></tr>;})}</tbody></table></div>
 <p className="text-xs leading-5">「最悪」は終値比の最小値で、保有途中の最大下落ではありません。
 分割・併合等が確認された期間や不正な成立記録は要確認として集計から除きます。
 通知送信済みで絞っても、基準は成立足の参考価格です。配信後に買えた価格や約定を検証した成績ではありません。
 ここでの結果を理由に通知条件やAI POWERを自動変更することはありません。</p>
 </main>;
}
