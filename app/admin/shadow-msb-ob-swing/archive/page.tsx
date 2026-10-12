import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { SWING_SHADOW_VERSION } from "@/app/lib/research/msbMaSwing";
import { VOLUME_SENSITIVITY_VERSION } from "@/app/lib/research/msbMaVolumeSensitivity";
import {
  summarizeArchivedMsb, type StoredMsbObservation, type GroupArchive, type SimpleStat,
} from "@/app/lib/research/msbMaArchiveStats";

export const dynamic="force-dynamic";
export const revalidate=0;
export const runtime="nodejs";
type Props={searchParams:Promise<{save?:string}>};
type Run={codes:string[];created_at:string;first_bar_date:string;last_bar_date:string;base_count:number;ob_count:number};
const yen=(n:number|null)=>n===null?"—":(n>0?"+":"")+Math.round(n).toLocaleString("ja-JP")+"円";
const pct=(n:number|null)=>n===null?"—":n.toFixed(1)+"%";
function StatTile({label,stat}:{label:string;stat:SimpleStat}){
  return <div className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
    <p className="text-xs font-bold">{label}</p>
    <p className="mt-1 font-black">{stat.count}件 / {pct(stat.winRate)}</p>
    <p className="mt-1 text-xs">平均100株 {yen(stat.averageYen100)}</p>
    <p className="text-xs">最悪 {yen(stat.worstYen100)}</p>
  </div>;
}
function Summary({data,label}:{data:GroupArchive;label:string}){
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <h2 className="text-lg font-black">{label}</h2>
    <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
      元候補{data.totalObservations}件 → MA条件重複なし{data.baseNonOverlapCount}件 /
      MSB・OB元候補{data.obObservations}件 → MSB・OB重複なし{data.obNonOverlapCount}件
    </p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <StatTile label="① MA5/25" stat={data.base}/>
      <StatTile label="② ①＋当日出来高1.5倍" stat={data.volume15}/>
      <StatTile label="③ ①＋MSB・OB" stat={data.ob}/>
      <StatTile label="④ ①＋当日出来高1.5倍＋MSB・OB" stat={data.all15}/>
    </div>
    <p className="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-300">
      下はMSB・OB候補を<strong>先に重複除外した同じサンプル</strong>で、構造突破日と反発日の出来高を比較。
      上の①から順に絞った③・④と母集団は異なります。
    </p>
    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full min-w-[510px] text-xs">
        <thead className="bg-slate-100 dark:bg-slate-800">
          <tr><th className="p-2 text-left">倍率</th><th className="p-2 text-left">突破日だけ</th>
            <th className="p-2 text-left">反発日だけ</th><th className="p-2 text-left">両日とも</th></tr>
        </thead>
        <tbody>{data.thresholds.map(row=><tr key={row.threshold} className="border-t border-slate-200 dark:border-slate-700">
          <th className="p-2 text-left">{row.threshold===0?"条件なし":row.threshold.toFixed(1)+"倍"}</th>
          {[row.breakout,row.retest,row.both].map((s,i)=><td key={i} className="p-2 align-top">
            <p className="font-black">{s.count}件 / {pct(s.winRate)}</p>
            <p>平均 {yen(s.averageYen100)}</p>
            <p>合計 {yen(s.sumYen100)}</p>
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>
    {data.obNonOverlapCount<20&&<p className="mt-3 text-xs font-bold text-amber-700 dark:text-amber-300">
      MSB・OB重複なし{data.obNonOverlapCount}件：標本が少なく、まだ優劣を判断できません。
    </p>}
  </section>;
}
export default async function MsbVolumeArchivePage({searchParams}:Props){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  const params=await searchParams;
  let runs:Run[]=[], observations:StoredMsbObservation[]=[];
  let totalRuns=0, researchedStocks=0, unavailable=false;
  try {
    // Read-only saved results. NO Yahoo calls here.
    const [recent,rows,totals]=await Promise.all([
      pool.query<Run>("SELECT codes,created_at::text,first_bar_date::text,last_bar_date::text,"+
        "base_count,ob_count FROM public.msb_volume_research_runs "+
        "WHERE detector_version=$1 AND volume_version=$2 ORDER BY created_at DESC LIMIT 25",
        [SWING_SHADOW_VERSION,VOLUME_SENSITIVITY_VERSION]),
      pool.query<StoredMsbObservation>(
        "SELECT detector_version,volume_version,code,signal_time::text,entry_time::text,exit_time::text,"+
        "profit_yen_100,return_percent::text,volume_eligible,ob_eligible,"+
        "breakout_ratio::text,retest_ratio::text FROM public.msb_volume_research_observations "+
        "WHERE detector_version=$1 AND volume_version=$2 ORDER BY exit_time,code LIMIT 10001",
        [SWING_SHADOW_VERSION,VOLUME_SENSITIVITY_VERSION]),
      pool.query<{runs:string;stocks:string}>(
        "SELECT (SELECT count(*) FROM public.msb_volume_research_runs "+
        "WHERE detector_version=$1 AND volume_version=$2)::text AS runs,"+
        "(SELECT count(DISTINCT stock.code) FROM public.msb_volume_research_runs r "+
        "CROSS JOIN LATERAL unnest(r.codes) AS stock(code) "+
        "WHERE r.detector_version=$1 AND r.volume_version=$2)::text AS stocks",
        [SWING_SHADOW_VERSION,VOLUME_SENSITIVITY_VERSION]),
    ]);
    runs=recent.rows;observations=rows.rows;
    totalRuns=Number(totals.rows[0]?.runs??0);
    researchedStocks=Number(totals.rows[0]?.stocks??0);
  }catch(error){console.error("owner-only msb archive read unavailable",error);unavailable=true;}
  const truncated=observations.length>10000;
  const result=unavailable||truncated?null:summarizeArchivedMsb(observations);
  const groups=result?.groups;
  return <main className="min-h-screen bg-slate-50 px-3 py-5 pb-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/admin/shadow-msb-ob-swing" className="text-sm font-black text-blue-700 dark:text-blue-300">← MSB・OB研究に戻る</Link>
      <header><p className="text-xs font-black text-indigo-700 dark:text-indigo-300">OWNER ONLY / ARCHIVED SHADOW RESEARCH</p>
        <h1 className="mt-2 text-2xl font-black">💾 MSB・OB × 出来高・累積研究</h1>
        <p className="mt-2 text-sm leading-6">5銘柄ずつ保存した確定日足の研究結果を、同じ銘柄・同じシグナル日は1度だけ数えて比較。<strong>このページでは株価を再取得しません。</strong></p>
      </header>
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs leading-6 text-amber-950">
        <p className="font-black">🔒 研究専用・本番AI/LINE/疑似購入/学習結果は変更なし</p>
        <p>保存は本人がボタンを押した時だけ。保存時は選択した最大5銘柄の確定日足を再取得し、最初の記録を固定します。過去の画面結果は自動で保存されません。</p>
        <p>同じ銘柄の保有期間を重複除外しますが、別銘柄同士の相関や資金制約は未考慮。100株仮想損益は実際のポートフォリオ利益ではありません。取引ルールは旧研究から変更していません。</p>
      </section>
      {params.save==="saved"&&<p role="status" className="rounded-xl bg-blue-50 p-3 font-bold text-blue-900">研究結果を保存したよ！同じシグナルは重複登録していません。</p>}
      {params.save==="duplicate"&&<p role="status" className="rounded-xl bg-blue-50 p-3 font-bold text-blue-900">同じ銘柄と同じ確定日足は保存済みだよ。重複保存しませんでした。</p>}
      {unavailable?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-800">研究用の保存テーブルを読み取れません。DBの適用状態を確認してください。</p>:
        <div className="grid grid-cols-3 gap-2">
          {([["保存回数",totalRuns],["重複なし調査銘柄",researchedStocks],["独立日付の観察記録",result?.uniqueObservations??"—"]] as const).map(([label,value])=>
            <div key={label} className="rounded-xl bg-white p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p>
            </div>)}
        </div>}
      {truncated&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-800">
        保存済みの観察記録が1万件を超えました。不完全な累積勝率を表示しないため集計を停止しています。
      </p>}
      {groups&&<>
        <Summary data={groups[1]} label="🔍 最初のA・B：仮説を見つけた銘柄"/>
        <Summary data={groups[2]} label="🧪 新しいC〜H：追加検証の30銘柄"/>
        {groups[3].totalObservations>0&&<Summary data={groups[3]} label="📝 自由入力で調べた銘柄"/>}
        <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <summary className="cursor-pointer font-black">全グループ合計の比較を開く</summary>
          <div className="mt-3"><Summary data={groups[0]} label="📊 全銘柄合算（重複除外）"/></div>
        </details>
        {result&&result.invalidRowsDiscarded>0&&<p role="alert" className="text-sm font-bold text-rose-700">
          不整合のある保存行{result.invalidRowsDiscarded}件を除外しています。元データを点検してください。
        </p>}
      </>}
      {runs.length>0&&<details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <summary className="cursor-pointer font-black">保存履歴を見る（直近25回）</summary>
        <div className="mt-3 space-y-2">{runs.map((run,i)=>
          <div key={i} className="rounded-xl bg-slate-100 p-3 text-xs leading-6 dark:bg-slate-800">
            <p className="font-bold">{run.codes.join(" / ")}　{new Date(run.created_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</p>
            <p>{run.first_bar_date} 〜 {run.last_bar_date} ／ MA候補 {run.base_count}件・MSB/OB候補 {run.ob_count}件</p>
          </div>)}</div>
      </details>}
      <p className="text-xs leading-6 text-slate-500">C〜Hは分野別に選んだ銘柄で、無作為抽出ではありません。追加群の結果を見てルールを変えると検証の独立性が失われます。少数標本では勝率100%でも優位性の根拠になりません。新たな有料API契約や毎日自動取得は追加していません。</p>
    </div>
  </main>;
}
