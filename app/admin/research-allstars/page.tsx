import Link from "next/link";
import {notFound} from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {readResearchAllStars} from "@/app/lib/research/researchAllStarData";
import {
  ALLSTAR_POLICY,CONFIRMATION_FROM,DISCOVERY_END,WAITING_STUDIES
} from "@/app/lib/research/researchAllStars.mjs";

export const dynamic="force-dynamic";
export const revalidate=0;
type Evidence={
  totalRecorded:number;validBeforeBenchmark:number;excludedDueToBenchmark:number;
  days:number;cases:number;codes:number;months:number;
  positiveRate:number|null;average5:number|null;severeLossRate:number|null;
  worst5:number|null;relativeToUniverse:number|null;
  daysBeating:number;dayWinRate:number|null;
};
type Entry={
  key:string;title:string;href:string;family:string;method:string;
  status:"ALL_STAR"|"CONFIRMING"|"COLLECTING";
  latest:string|null;discovery:Evidence;confirmation:Evidence;
  unmet:string[];reference:string;rule:string;
};
const pct=(n:number|null)=>n===null?"確認待ち":(n>0?"+":"")+n.toFixed(2)+"%";
const hit=(n:number|null)=>n===null?"確認待ち":n.toFixed(1)+"%";
const diff=(n:number|null)=>n===null?"確認待ち":(n>0?"+":"")+n.toFixed(2)+"pt";
function EvidenceCard({data,label}:{data:Evidence;label:string}){
 return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
   <p className="text-sm font-black text-slate-900">{label}</p>
   <p className="mt-1 text-[11px] text-slate-500">
     比較できた {data.cases}件 ・ {data.days}判定日 ・ {data.codes}銘柄
   </p>
   {data.days?<div className="mt-2 grid grid-cols-2 gap-2">
     <div className="rounded-lg bg-white p-2">
       <p className="text-[10px] text-slate-500">5日後プラス率</p>
       <p className="mt-1 font-black">{hit(data.positiveRate)}</p>
     </div>
     <div className="rounded-lg bg-white p-2">
       <p className="text-[10px] text-slate-500">5日後平均</p>
       <p className="mt-1 font-black">{pct(data.average5)}</p>
     </div>
     <div className="rounded-lg bg-white p-2">
       <p className="text-[10px] text-slate-500">同日950銘柄平均との平均差</p>
       <p className="mt-1 font-black">{diff(data.relativeToUniverse)}</p>
     </div>
     <div className="rounded-lg bg-white p-2">
       <p className="text-[10px] text-slate-500">−5%以上下落した割合</p>
       <p className="mt-1 font-black">{hit(data.severeLossRate)}</p>
     </div>
   </div>:<p className="mt-2 text-xs text-slate-500">5日後の同日市場比較データが不足しています。</p>}
   {data.days>0&&<p className="mt-2 text-[11px] leading-5 text-slate-600">
     最悪の保存株価騰落率 {pct(data.worst5)} ／ 市場平均を上回った日
     {data.daysBeating}/{data.days}日 ／ 市場データ不足で除外 {data.excludedDueToBenchmark}日
   </p>}
 </div>;
}
function StudyCard({entry,open=false}:{entry:Entry;open?:boolean}){
  const label=entry.status==="ALL_STAR"?"研究オールスター認定":
    entry.status==="CONFIRMING"?"一次基準通過・独立検証中":"研究中・まだ認定なし";
  return <details open={open} className="rounded-2xl border border-slate-200 bg-white">
    <summary className="cursor-pointer list-none p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">{entry.title}</h3>
          <p className="mt-1 text-xs text-slate-600">{label}</p>
        </div>
        <span aria-hidden="true" className="text-slate-500">⌄</span>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">最後の判定 {entry.latest??"未記録"} ／ 元データ {entry.discovery.cases}</p>
    </summary>
    <div className="space-y-3 border-t border-slate-200 p-3">
      <p className="text-xs leading-5 text-slate-700">{entry.method}</p>
      <EvidenceCard data={entry.discovery} label={"一次検証（〜"+DISCOVERY_END+"）"}/>
      <EvidenceCard data={entry.confirmation} label={"独立期間（"+CONFIRMATION_FROM+"〜）"}/>
      {entry.unmet.length>0&&<div className="rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-black">未達の認定条件</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] leading-5 text-slate-600">
          {entry.unmet.map(reason=><li key={reason}>{reason}</li>)}
        </ul>
      </div>}
      <Link href={entry.href} className="inline-block text-sm font-black text-blue-700 underline">
        元の研究ページで詳細を見る →
      </Link>
    </div>
  </details>;
}
export default async function ResearchAllStarsPage(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  let entries:Entry[]=[];
  let loadFailed=false;
  try{entries=await readResearchAllStars();}
  catch(error){console.error("research all-stars evidence read failed",error);loadFailed=true;}
  const winners=entries.filter(e=>e.status==="ALL_STAR");
  const next=entries.filter(e=>e.status==="CONFIRMING");
  const waiting=entries.filter(e=>e.status==="COLLECTING");
  const publishedAt=new Date().toLocaleString("ja-JP",{
    timeZone:"Asia/Tokyo",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
  return <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
    <div className="mx-auto max-w-2xl space-y-4 px-3 pt-4 sm:px-5">
      <Link href="/admin/learning-hub" className="text-sm font-black text-blue-700">
        ← 学習データ・管理室に戻る
      </Link>
      <header className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-black tracking-widest text-indigo-700">
          SIGNALX OWNER PRIVATE · RESEARCH ALL-STARS
        </p>
        <h1 className="mt-2 text-2xl font-black">🏆 研究オールスター</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          毎日の研究結果から、本当に強そうな「買い方・法則」を選び抜く研究専用ページ。
          勝率だけでなく、検証日数・銘柄の分散・平均騰落率・大きな損失・
          同じ日の全銘柄平均との差を自動チェックします。
        </p>
        <p className="mt-3 text-xs leading-5 font-bold text-indigo-800">
          研究結果を横断する「法則」の比較です。現在買うべき銘柄や注文一覧ではありません。
          証券口座・紙上取引・AI判定・LINE通知には接続しません。
        </p>
        <p className="mt-3 text-[11px] text-slate-500">
          保存済みの自動研究結果を表示時に再集計 ／ 確認時刻 {publishedAt} JST
        </p>
      </header>

      {loadFailed?<section role="alert" className="rounded-2xl border border-rose-200 bg-white p-4">
        <p className="font-black text-rose-800">研究データを読み込めませんでした</p>
        <p className="mt-2 text-sm text-slate-600">
          エラーを「該当0件」や不合格には変換しません。保存・DBの状態を確認してください。
        </p>
      </section>:<>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border bg-white p-3 text-center">
            <p className="text-[11px] text-slate-500">認定</p>
            <p className="mt-1 text-2xl font-black">{winners.length}</p>
          </div>
          <div className="rounded-2xl border bg-white p-3 text-center">
            <p className="text-[11px] text-slate-500">独立検証中</p>
            <p className="mt-1 text-2xl font-black">{next.length}</p>
          </div>
          <div className="rounded-2xl border bg-white p-3 text-center">
            <p className="text-[11px] text-slate-500">研究中</p>
            <p className="mt-1 text-2xl font-black">{waiting.length}</p>
          </div>
        </div>

        <section className="rounded-3xl border border-amber-200 bg-white p-4">
          <h2 className="text-lg font-black">🏅 厳選オールスター</h2>
          {winners.length===0?<div className="mt-3 rounded-xl bg-slate-50 p-4">
            <p className="font-black">現在、認定された法則はありません</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              勝率が高い日だけを取り出して認定することはしません。
              最初の研究期間と、その後の未使用期間の両方で条件をクリアした法則だけが
              ここに自動で登場します。
            </p>
          </div>:<div className="mt-3 space-y-2">
            {winners.map(e=><StudyCard key={e.key} entry={e} open/>)}
          </div>}
        </section>

        {next.length>0&&<section className="space-y-2">
          <h2 className="text-base font-black">🥈 一次選抜を通過・独立検証中</h2>
          {next.map(e=><StudyCard key={e.key} entry={e}/>)}
        </section>}

        <section className="rounded-3xl border bg-white p-4">
          <h2 className="text-lg font-black">📚 選抜待ちの研究</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            4つの前向き研究モデルと、全銘柄「見送り」のAI POWER4区分を
            それぞれ同じ5日後の観測値で点検しています。
            同じ銘柄が別の判定日に出た場合は別の観測として扱います。
          </p>
          <div className="mt-3 space-y-2">
            {waiting.map(e=><StudyCard key={e.key} entry={e}/>)}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-4">
          <h2 className="text-lg font-black">🔎 その他の研究ページ</h2>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            以下の研究も候補となるけれど、取引期間・評価方法・未来保存の
            条件が異なるため、勝率だけで順位を付けません。
            条件の統一とデータ監査が終わるまで認定対象外です。
          </p>
          <div className="mt-3 space-y-2">
            {WAITING_STUDIES.map(s=><details key={s.href} className="rounded-xl border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-black">{s.label}</summary>
              <p className="mt-2 text-xs leading-5 text-slate-600">{s.reason}</p>
              <Link href={s.href} className="mt-2 inline-block text-xs font-bold text-blue-700 underline">
                研究ページへ →
              </Link>
            </details>)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-700">
          <h2 className="text-base font-black">🔒 認定するためのルール</h2>
          <p className="mt-2">
            まず2026年11月30日までの保存済み前向き研究で、5日後照合50件以上・
            独立した判定日10日以上・異なる銘柄20以上・2か月以上を確保。
            プラス率60%以上、平均+0.8%以上、−5%以上の大きな下落は20%以下、
            同じ日の全銘柄平均を平均+0.3ポイント以上上回ることなどを確認します。
          </p>
          <p className="mt-2">
            さらに2026年12月1日以降の別期間に、照合30件以上・10判定日以上で
            再びプラス率55%以上、平均+0.2%以上、同日全銘柄平均+0.15ポイント以上
            などを確認して初めて認定します。
          </p>
          <p className="mt-2">
            判定日は対象と全市場参照の各80%以上の照合が必要。
            参照市場はSIGNALX保存銘柄の単純平均であり日経平均・TOPIXではありません。
            5日後の保存価格を使う研究で、実際の約定価格・手数料・税金・最大含み損は
            示しません。研究モデル間で5日という名称の実装差があれば統一監査が必要です。
            採用ルールは事前固定し、恣意的な後付け変更をしません。
          </p>
          <p className="mt-2 font-bold">
            オールスター認定は利益保証でも自動売買推奨でもありません。
          </p>
        </section>
        <p className="pb-2 text-[10px] text-slate-400">{ALLSTAR_POLICY}</p>
      </>}
    </div>
    <BottomNav/>
  </main>;
}
