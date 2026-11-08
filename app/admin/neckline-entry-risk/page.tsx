import Link from "next/link";
import { notFound } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { fetchNecklineExtendedCohort } from "@/app/lib/research/shadowCandleYahoo";
import {
  replayNecklineEntryRisk, NECKLINE_ENTRY_RISK_VERSION,
} from "@/app/lib/research/necklineEntryRiskReplay.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

type Props={searchParams:Promise<{run?:string;codes?:string}>};
type Stat={completed:number;meanPercent:number|null;medianPercent:number|null;positivePercent:number|null;worstPercent:number|null};
type Scenario={
  id:string;title:string;description:string;candidates:number;qualified:number;noEntry:number;
  pending3:number;pending5:number;
  day3:Stat;day5:Stat;drawdown5:Stat;
  severe3:number;severe5:number;loss3Percent:number|null;loss5Percent:number|null;
};
type Expanded={
  version:string;source:string;replayOnly:boolean;independentOutOfSample:boolean;
  chronologicalSplit:string;
  sample:{requestedSymbols:number;usableSymbols:number;excludedSymbols:number;candidates:number;
    earliestDate:string|null;latestDate:string|null;completedDailyBars:number;
    details:{code:string;status:string;reason:string|null;barCount:number;candidateCount:number}[]};
  status:{watch:number;breakout:number;invalidated:number;expired:number};
  scenarios:Scenario[];
  periods:{id:string;title:string;candidates:number;symbols:number;scenarios:Scenario[]}[];
  worstCases:{code:string;firstSeenDate:string;status:string;early5:number;worstAdverse:number;
    distancePercent:number|null;volumeRatio:number|null}[];
};

const INITIAL_CODES="7164,3774,5929,7752,4331,9024,1835,4612,3661,7038,9682,3762,3753,3996,3540";
const pct=(value:number|null)=>value===null?"未算出":(value>0?"+":"")+value.toFixed(2)+"%";
const statusLabel:Record<string,string>={WATCH:"監視中",BREAKOUT:"上抜け",INVALIDATED:"安値割れ",EXPIRED:"期限終了"};

function ScenarioCard({ scenario, condensed=false }: {scenario:Scenario;condensed?:boolean}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="text-sm font-black leading-6">{scenario.title}</h3>
      {!condensed && <p className="mt-1 text-xs leading-5 text-slate-600">{scenario.description}</p>}
      <p className="mt-2 text-xs font-bold text-slate-700">
        対象 {scenario.candidates}件 / 仮購入の条件成立 {scenario.qualified}件
        / 未購入 {scenario.noEntry}件
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-100 p-2">
          <p className="text-[11px] font-bold text-slate-600">3営業日後の平均</p>
          <p className="mt-1 text-lg font-black">{pct(scenario.day3.meanPercent)}</p>
          <p className="text-[11px] text-slate-600">確定 {scenario.day3.completed} / 待ち {scenario.pending3}</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <p className="text-[11px] font-bold text-slate-600">5営業日後の平均</p>
          <p className="mt-1 text-lg font-black">{pct(scenario.day5.meanPercent)}</p>
          <p className="text-[11px] text-slate-600">確定 {scenario.day5.completed} / 待ち {scenario.pending5}</p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-700">
        5日後プラス率 {pct(scenario.day5.positivePercent)} /
        中央値 {pct(scenario.day5.medianPercent)} /
        最悪 {pct(scenario.day5.worstPercent)}<br />
        5営業日中の最大下落幅（最悪例）{pct(scenario.drawdown5.worstPercent)}
      </p>
      {!condensed && <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-xs font-bold text-rose-900">
        5日後に−3%以上：{scenario.severe3}/{scenario.day5.completed}件 /
        −5%以上：{scenario.severe5}/{scenario.day5.completed}件
      </p>}
    </div>
  );
}

export default async function NecklineEntryRiskPage({searchParams}:Props) {
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)notFound();
  const params=await searchParams;
  const run=params.run==="1";
  const raw=typeof params.codes==="string" ? params.codes.slice(0,120) : "";
  const codes=raw.trim().split(/[\s,、]+/).filter(Boolean);
  const error=run && (raw.trim().length===0 || codes.length<1 || codes.length>15
    || new Set(codes).size!==codes.length || codes.some(x=>!/^[0-9]{4}$/.test(x)))
    ? "重複のない4桁の銘柄コードを1〜15個入力してください。" : null;
  const now=new Date();
  // Explicit form submission only. Owner verified BEFORE bounded upstream calls.
  // No DB read/write, no background scan, no notification or trading action.
  const loaded=run && !error ? await fetchNecklineExtendedCohort(codes) : [];
  const report:Expanded|null=loaded.length ? replayNecklineEntryRisk(loaded,now) as Expanded : null;

  return (
    <>
      <main className="min-h-screen bg-slate-50 pb-28 text-slate-950">
        <div className="mx-auto max-w-4xl space-y-3 px-3 pt-4 sm:px-6">
          <Link href="/admin/neckline-quality" className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700">
            ← 底①・底②・ネックライン検証へ戻る
          </Link>
          <header className="rounded-2xl border border-indigo-200 bg-white p-4">
            <p className="text-xs font-black text-indigo-800">本人専用・研究限定・実測した確定日足</p>
            <h1 className="mt-1 text-xl font-black sm:text-2xl">🔬 上抜け後の損失と買う時刻を比較</h1>
            <p className="mt-2 text-sm leading-6">
              ネックラインを突破したのに下落した理由を探すため、
              3つの仮購入条件と5日後までの損失・下落幅を比較します。
              候補は同じ検出規則で選び、上抜けしなかった例も残します。
            </p>
            <p className="mt-2 text-xs leading-5 text-amber-900">
              これは過去の株価を後から再生する研究です。将来の勝率、買いサイン、リアルタイム検出実績ではありません。
            </p>
          </header>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <form method="get" action="/admin/neckline-entry-risk">
              <input type="hidden" name="run" value="1"/>
              <label htmlFor="codes" className="text-sm font-black">検証銘柄（1〜15銘柄・4桁コード）</label>
              <textarea id="codes" name="codes" rows={3} maxLength={120}
                defaultValue={raw || INITIAL_CODES} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-base"
                aria-describedby="code-info"/>
              <button type="submit" className="mt-3 min-h-12 w-full rounded-xl bg-indigo-700 px-3 text-sm font-black text-white">
                🔬 15銘柄までの損失・タイミングを検証する
              </button>
            </form>
            <p id="code-info" className="mt-2 text-xs leading-5 text-slate-600">
              ボタンを押したときだけ、指定した最大15銘柄のYahoo参考日足を取得（最大3件を同時取得、6か月・各最大135本）。
              取得できない銘柄は除外して理由を表示します。自動収集・DB保存・通知・発注なし。
              初期15銘柄は固定サンプルであり、全市場の無作為抽出ではありません。
            </p>
            {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
          </section>
          {report && (
            <>
              <section className="rounded-2xl border border-blue-200 bg-white p-4">
                <h2 className="text-base font-black">📋 今回の検証の範囲</h2>
                <p className="mt-2 text-xs leading-6 text-slate-700">
                  バージョン：{NECKLINE_ENTRY_RISK_VERSION}<br />
                  実行：{now.toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})} 日本時間<br />
                  取得成功 {report.sample.usableSymbols}/{report.sample.requestedSymbols}銘柄
                  ／ 候補 {report.sample.candidates}件 ／ 日足 {report.sample.completedDailyBars}本<br />
                  日足期間：{report.sample.earliestDate ?? "未取得"}〜{report.sample.latestDate ?? "未取得"}<br />
                  上抜け {report.status.breakout}件 / 安値割れ {report.status.invalidated}件 /
                  期限終了 {report.status.expired}件 / 監視中 {report.status.watch}件
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  全ての仮購入は、条件を終値で確認した<strong>翌営業日の始値</strong>を基準にしています。
                  3・5営業日目の終値で仮売却し、往復コスト0.2ポイントを控除。
                  税金・スリッページ・寄付時の約定可能性は未検証です。
                </p>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <h2 className="text-base font-black">① 3つの購入タイミングを比較</h2>
                <p className="mt-1 text-xs leading-5 text-slate-700">
                  各条件は対象件数が違うため、平均利益だけを並べて一番良い方法とは判定できません。
                  「未購入」は利益0円の勝敗として扱わず、別に数えています。
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {report.scenarios.map(scenario=><ScenarioCard key={scenario.id} scenario={scenario}/>)}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-black">② 前半と後半で再現する？</h2>
                <p className="mt-2 text-xs leading-5 text-slate-700">
                  初検出日で2026年7月31日までと、2026年8月1日以降に分けました。
                  将来の成績を見ずに条件を決めて別期間で試した「独立検証」ではありません。
                  2期間とも過去の日足を使った<strong>参考比較</strong>です。
                </p>
                {report.periods.map(period=>(
                  <details key={period.id} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-sm font-black">{period.title}（{period.candidates}候補・{period.symbols}銘柄）</summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {period.scenarios.map(scenario=><ScenarioCard key={scenario.id} scenario={scenario} condensed/>)}
                    </div>
                  </details>
                ))}
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  判定日の区分が違っても同じ銘柄が両方に現れる場合があります。
                  期間の境界をまたいで追跡した結果もあるため、期間の独立性は保証されません。
                </p>
              </section>
              <section className="rounded-2xl border border-rose-200 bg-white p-4">
                <h2 className="text-base font-black">③ 5日後に損失が大きかった実例</h2>
                <p className="mt-1 text-xs leading-5 text-slate-700">
                  初検出の翌日始値で仮購入した候補のうち、5日後の参考騰落率が低い順。
                  最大下落幅は期間中の安値で計算。下がる前の情報だけで危険を予測できたとは限りません。
                </p>
                {report.worstCases.length ? (
                  <div className="mt-3 space-y-2">
                    {report.worstCases.map(item=>(
                      <div key={item.code+item.firstSeenDate} className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-6">
                        <p className="text-sm font-black">
                          {item.code}・{item.firstSeenDate} / {statusLabel[item.status] ?? "未確定"}
                        </p>
                        <p className="font-bold">5日後 {pct(item.early5)} / 期間中の最大下落 {pct(item.worstAdverse)}</p>
                        <p className="text-slate-700">
                          当初のネックラインまでの距離 {pct(item.distancePercent)} /
                          当初の出来高 {item.volumeRatio==null?"不明":item.volumeRatio.toFixed(2)+"倍"}
                        </p>
                        <Link href={`/analysis/${item.code}`} className="inline-flex min-h-9 items-center text-blue-700 underline">実際の銘柄チャートを確認</Link>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-2 text-sm text-slate-600">5日後の成績が確定した候補はありません。</p>}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-black">④ データ取得の確認</h2>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {report.sample.details.map(item=>(
                    <p key={item.code} className="rounded-lg bg-slate-50 p-2 text-xs leading-5">
                      <strong>{item.code}</strong>：{item.status==="OK"?"取得成功":"除外"}
                      （{item.barCount}本・候補{item.candidateCount}件）
                      {item.reason && <span className="block text-red-700">理由：{item.reason}</span>}
                    </p>
                  ))}
                </div>
              </section>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                研究結果を見て買い条件や損切条件を自動変更する機能ではありません。
                有望そうに見える条件があっても、銘柄を増やした別の期間の前向き検証が必要です。
                すべて読み取り専用・本人限定で、通知・買い判定には未接続です。
              </p>
            </>
          )}
        </div>
      </main>
      <BottomNav/>
    </>
  );
}
