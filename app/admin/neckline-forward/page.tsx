import Link from "next/link";
import {notFound} from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {NECKLINE_FORWARD_VERSION,NECKLINE_FORWARD_CODES} from "@/app/lib/research/necklineForwardCore.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;

type Run={
  run_date:string;batch:number;signal_date:string;status:string;
  codes:string[];results: {
    code:string;state:string;lastDate:string|null;attempts:number;
    error:string|null;source:string;sha256:string|null;bars:number;
  }[];
  note:string|null;claimed_at:string;finished_at:string|null;
};
type Candidate={
  code:string;signal_date:string;observed_preopen_date:string;
  captured_at:string;signal_close:number;neckline:number;source_sha256:string;
  horizon:number|null;status:string|null;entry_date:string|null;exit_date:string|null;
  return_percent:number|null;worst_adverse_percent:number|null;
  completed_at:string|null;
};
const formatPct=(n:number|null)=>n===null?"結果待ち":(n>0?"+":"")+Number(n).toFixed(2)+"%";

export default async function NecklineForwardResearchPage(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  let runs:Run[]=[],candidates:Candidate[]=[],unavailable=false;
  try{
    const [a,b]=await Promise.all([
      pool.query<Run>(`
        SELECT run_date::text, batch,signal_date::text,status,codes,results,note,
          claimed_at::text,finished_at::text
        FROM public.neckline_forward_runs
        WHERE policy_version=$1 ORDER BY run_date DESC,batch DESC LIMIT 90
      `,[NECKLINE_FORWARD_VERSION]),
      pool.query<Candidate>(`
        SELECT c.code,c.signal_date::text,c.observed_preopen_date::text,
          c.captured_at::text,c.signal_close::float8,c.neckline::float8,
          c.source_sha256,o.horizon,o.status,
          o.entry_date::text,o.exit_date::text,o.return_percent::float8,
          o.worst_adverse_percent::float8,o.completed_at::text
        FROM public.neckline_forward_candidates c
        LEFT JOIN public.neckline_forward_outcomes o
          ON (c.policy_version,c.code,c.signal_date)=(o.policy_version,o.code,o.signal_date)
        WHERE c.policy_version=$1
        ORDER BY c.captured_at DESC,c.code ASC,o.horizon ASC LIMIT 180
      `,[NECKLINE_FORWARD_VERSION]),
    ]);
    runs=a.rows;candidates=b.rows;
  }catch(error){
    unavailable=true;
    console.error("[neckline-forward] private status unavailable",error);
  }
  const completed=candidates.filter(c=>c.status==="COMPLETE");
  const pending=candidates.filter(c=>c.status==="PENDING");
  const validCodes=new Set(candidates.map(c=>c.code));
  const fullRunCount=runs.filter(r=>r.status==="COMPLETE").length;
  const failedRuns=runs.filter(r=>r.status!=="COMPLETE").length;
  const signalCount=new Set(candidates.map(c=>c.code+":"+c.signal_date)).size;

  return (
    <>
      <main className="min-h-screen bg-slate-50 pb-28 text-slate-950">
        <div className="mx-auto max-w-4xl space-y-3 px-3 pt-4 sm:px-6">
          <Link href="/admin/neckline-entry-risk" className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700">
            ← ネックライン損失研究へ戻る
          </Link>
          <header className="rounded-2xl border border-blue-200 bg-white p-4">
            <p className="text-xs font-black text-blue-800">本人専用・研究隔離・事前固定FORWARD</p>
            <h1 className="mt-2 text-xl font-black sm:text-2xl">📅 底①②・ネックラインの事前保存検証</h1>
            <p className="mt-2 text-sm leading-6">
              過去のチャートを後から当てはめるのではなく、
              東証の営業日の<strong>朝8:25・8:35・8:45</strong>に、
              前営業日の確定日足から新しく発生した候補だけを保存します。
              当時の価格・ローソク足・判定根拠と保存時刻は変更できません。
            </p>
            <p className="mt-2 text-xs leading-5 text-amber-900">
              実際の約定可能性を保証しません。3・5営業日後の結果は必要な日足が全てそろったときだけ確定。
              過去日の後付け登録は禁止。買い通知、AI評価、注文システムには接続していません。
            </p>
          </header>
          {unavailable ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
              研究保存DBを読み取れませんでした。収集済みと判断せず、管理者側の接続・テーブルを確認してください。
            </p>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-black">🔍 現在の事前固定データ</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["候補を事前保存",signalCount],
                    ["銘柄数",validCodes.size],
                    ["結果が確定",completed.length],
                    ["結果待ち",pending.length],
                  ].map(([label,value])=>(
                    <div key={String(label)} className="rounded-xl bg-slate-100 p-3">
                      <p className="text-xs font-bold text-slate-600">{label}</p>
                      <p className="mt-1 text-2xl font-black">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-700">
                  収集ジョブ成功 {fullRunCount}件 / 欠損・失敗 {failedRuns}件。
                  候補0件の日も正常な場合があります。各日5銘柄×3回、固定15銘柄を監査します。
                </p>
                {runs.length===0 && (
                  <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-bold text-blue-950">
                    まだ事前収集の記録がありません。初回収集前のため、FORWARD勝率は算出できません。
                    過去の80候補を事前保存実績として再登録することもありません。
                  </p>
                )}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-black">🗓️ 収集記録・データ欠損</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  固定対象：{NECKLINE_FORWARD_CODES.join("・")}。
                  データが取れなかった銘柄はその日に欠損として保存し、後から過去の候補を作りません。
                </p>
                <div className="mt-3 space-y-2">
                  {runs.map(run=>(
                    <details key={run.run_date+":"+run.batch} className="rounded-xl border border-slate-200 p-3">
                      <summary className="cursor-pointer text-sm font-black">
                        {run.run_date}・第{run.batch+1}組 / {run.status==="COMPLETE"?"取得完了":run.status==="PARTIAL"?"一部欠損":run.status==="FAILED"?"取得失敗":"収集中"}
                      </summary>
                      <p className="mt-2 text-xs leading-5 text-slate-700">
                        対象日 {run.signal_date} / 保存開始 {new Date(run.claimed_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}<br />
                        {run.note??"結果を確認中"}
                      </p>
                      <div className="mt-2 space-y-1">
                        {(Array.isArray(run.results)?run.results:[]).map(item=>(
                          <div key={item.code} className="rounded-lg bg-slate-50 p-2 text-xs leading-5">
                            <strong>{item.code}</strong>：{item.state==="VALID"?"対象日の日足を確認":"欠損・対象日不一致"}
                            / 試行{item.attempts}回 / 最終日足{item.lastDate??"不明"}
                            {item.error && <span className="block text-rose-700">理由：{item.error}</span>}
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-black">📋 事前固定候補と3・5営業日後の答え合わせ</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  買値はシグナル翌営業日始値、3日後・5日後終値で仮売却（往復コスト0.2ポイント）。
                  保存済み候補のみを対象にし、未成熟・未取得は勝ち負けに入れません。
                </p>
                <div className="mt-3 space-y-2">
                  {candidates.map(c=>(
                    <div key={c.code+":"+c.signal_date+":"+c.horizon}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-black">
                        {c.code}・{c.signal_date}・{c.horizon}営業日後
                        <span className="ml-2 text-xs text-slate-600">{c.status==="COMPLETE"?"確定":"追跡中"}</span>
                      </p>
                      <p className="mt-1 text-xs leading-6">
                        ネックライン候補 {Number(c.neckline).toLocaleString("ja-JP")}円 /
                        当時の終値 {Number(c.signal_close).toLocaleString("ja-JP")}円<br />
                        事前保存 {new Date(c.captured_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}<br />
                        結果：<strong>{formatPct(c.return_percent)}</strong>
                        {c.worst_adverse_percent!==null && <> / 途中の最大下落 {formatPct(c.worst_adverse_percent)}</>}
                      </p>
                    </div>
                  ))}
                  {!candidates.length && (
                    <p className="rounded-lg bg-slate-100 p-3 text-sm font-bold">
                      まだ事前に保存できた候補はありません。ここに過去研究の後付け候補は表示しません。
                    </p>
                  )}
                </div>
              </section>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                研究バージョン {NECKLINE_FORWARD_VERSION}。自動収集の失敗・欠損・営業日カレンダー外は
                予測可能性の欠落として扱います。保存した根拠データと候補行はDB上で更新・削除を禁止。
                現時点で通知解禁や買い推奨を判断できるような検証数・期間は未成立です。
              </p>
            </>
          )}
        </div>
      </main>
      <BottomNav/>
    </>
  );
}
