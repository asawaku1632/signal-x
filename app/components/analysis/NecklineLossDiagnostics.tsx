type PercentStats = {
  n: number;
  mean: number | null;
  median: number | null;
  worst: number | null;
  positiveRate: number | null;
};
type ScenarioRisk = {
  scenario: string;
  candidates: number; eligible: number; notEntered: number; matured: number; pending: number; symbols: number;
  returns: PercentStats; losses3: number; losses5: number;
  losses3Rate: number | null; losses5Rate: number | null;
};
type PairedResult = {
  first: string; second: string; n: number; symbols: number;
  firstStats: PercentStats; secondStats: PercentStats; difference: PercentStats;
  secondBetterCount: number; sameCount: number; secondWorseCount: number;
  firstLosses5: number; secondLosses5: number; notes: string;
};
export type LossDiagnostics = {
  version: string; candidateCount: number;
  exploratoryOnly: boolean; selectedAfterObservingResults: boolean; selectionValidated: boolean;
  exclusion: {
    referenceCode: string; excludedCandidates: number;
    all: ScenarioRisk[]; withoutReference: ScenarioRisk[];
    bySymbol: {
      code: string; removedCandidates: number; remainingCandidates: number;
      afterExclusion: ScenarioRisk; differenceMean: number | null;
    }[];
  };
  matched: PairedResult[];
  detectionNearSameTrade: boolean;
  symbolBalance: {
    version: string;
    byScenario: {
      scenario: string;
      distinctCandidateSymbols: number;
      maturedSymbols: number;
      missingSymbols: number;
      pooled5Mean: number|null;
      equalSymbol5Mean: number|null;
      totalMatured: number;
      totalLoss5: number;
      codesWithLoss5: number;
      biggestLossCluster: null|{code:string;loss5:number;shareOfAllLossesPercent:number};
      perCode: {
        code:string;candidates:number;entered:number;matured:number;pending:number;
        mean5:number|null;positive5:number|null;losses3:number;losses5:number;
      }[];
    }[];
  };
  riskStrata: {
    id: string; title: string;
    groups: {
      id: string; label: string; events: number; distinctSymbols: number;
      matured: number; pending: number; loss3: number; loss5: number;
      loss3Rate: number | null; loss5Rate: number | null;
      mean5: number | null; worst5: number | null;
    }[];
  }[];
};

const pct=(n:number|null)=>n===null?"未算出":(n>0?"+":"")+n.toFixed(2)+"%";
const scenarioLabels:Record<string,string>={
  DETECTION:"① 底②確認翌日",
  NEAR:"② 5%以内で翌日",
  BREAKOUT:"③ 上抜け確認翌日",
};
const numPct=(n:number|null)=>n===null?"未算出":n.toFixed(1)+"%";

export default function NecklineLossDiagnostics({analysis}:{analysis:LossDiagnostics}) {
  const exclusion=analysis.exclusion;
  return (
    <>
      <section className="rounded-2xl border border-rose-200 bg-white p-4">
        <h2 className="text-base font-black">④ 3996を除くと成績は変わる？</h2>
        <p className="mt-2 text-xs leading-5 text-slate-700">
          3996は過去の大きな損失を見てから注目した銘柄です。
          <strong>3996を除いた成績が改善しても「今後は3996を買わないほうが勝てる」という証拠にはなりません。</strong>
          サンプルが1銘柄に左右されていないかを調べる感度分析です。
        </p>
        <p className="mt-2 text-xs font-bold text-rose-900">
          3996で見つかった候補 {exclusion.excludedCandidates}件 /
          比較する全候補 {analysis.candidateCount}件
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {exclusion.all.map((initial,i)=>{
            const without=exclusion.withoutReference[i];
            return (
              <div key={initial.scenario} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-black">{scenarioLabels[initial.scenario]??initial.scenario}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white p-2">
                    <p className="text-[11px] font-bold text-slate-500">全銘柄</p>
                    <p className="mt-1 text-base font-black">{pct(initial.returns.mean)}</p>
                    <p className="text-[11px] leading-5">5日後確定{initial.matured}件<br />−5%以下 {initial.losses5}件</p>
                  </div>
                  <div className="rounded-lg bg-white p-2">
                    <p className="text-[11px] font-bold text-slate-500">3996除外</p>
                    <p className="mt-1 text-base font-black">{pct(without.returns.mean)}</p>
                    <p className="text-[11px] leading-5">5日後確定{without.matured}件<br />−5%以下 {without.losses5}件</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  5日後の最悪値：{pct(initial.returns.worst)} → {pct(without.returns.worst)}
                </p>
              </div>
            );
          })}
        </div>
        <details className="mt-3 rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-black">全銘柄を1つずつ除外した影響も確認</summary>
          <p className="mt-2 text-xs text-slate-600">
            ①底②確認翌日の成績を、14銘柄など取得できた銘柄について1銘柄ずつ除外。
            平均の差は残った候補の構成差です。優劣を判定するランキングではありません。
          </p>
          <div className="mt-2 space-y-2">
            {exclusion.bySymbol.map(item=>(
              <div key={item.code} className="grid grid-cols-[auto_1fr] items-center gap-x-3 rounded-lg bg-slate-50 p-2 text-xs">
                <strong className="text-sm">{item.code}</strong>
                <div className="leading-5">
                  除外 {item.removedCandidates}候補 / 残り {item.remainingCandidates}候補<br />
                  残りの5日後平均：{pct(item.afterExclusion.returns.mean)}
                  （全銘柄との差 {pct(item.differenceMean)}）<br />
                  −5%以下：{item.afterExclusion.losses5}/{item.afterExclusion.matured}件
                </div>
              </div>
            ))}
          </div>
        </details>
      </section>
      <section className="rounded-2xl border border-indigo-200 bg-white p-4">
        <h2 className="text-base font-black">⑤ 同じ候補なら、どの買い時刻が有利？</h2>
        <p className="mt-2 text-xs leading-5 text-slate-700">
          元の①②③は取引できる候補数が違うので、そのまま平均を比べられません。
          <strong>同じ候補で両方の購入条件が成立し、5営業日後まで確定した例</strong>だけを並べます。
          比較する2つの購入日と売却日は異なります。
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {analysis.matched.map(pair=>(
            <div key={pair.first+"-"+pair.second} className="rounded-xl border border-slate-200 bg-indigo-50 p-3">
              <p className="text-sm font-black">
                {scenarioLabels[pair.first]} と {scenarioLabels[pair.second]}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-600">
                同じ候補 {pair.n}件 / {pair.symbols}銘柄
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white p-2 text-xs">
                  <span>{scenarioLabels[pair.first]}</span>
                  <p className="mt-1 text-lg font-black">{pct(pair.firstStats.mean)}</p>
                  −5%以下 {pair.firstLosses5}件
                </div>
                <div className="rounded-lg bg-white p-2 text-xs">
                  <span>{scenarioLabels[pair.second]}</span>
                  <p className="mt-1 text-lg font-black">{pct(pair.secondStats.mean)}</p>
                  −5%以下 {pair.secondLosses5}件
                </div>
              </div>
              <p className="mt-2 text-xs leading-6 text-indigo-950">
                同じ候補での平均差（後者−前者）：<strong>{pct(pair.difference.mean)}</strong><br />
                後者が上 {pair.secondBetterCount}件 / 同じ {pair.sameCount}件 /
                後者が下 {pair.secondWorseCount}件
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-amber-900">
          ③の比較対象には「実際に上抜けした」という事後条件が入ります。
          ①・②のうち同じ候補では購入日も価格も同一なので、①と②のペア比較は不要です。
          この数字だけで③のタイミングが優秀とは断定できません。
        </p>
      </section>
      <section className="rounded-2xl border border-amber-200 bg-white p-4">
        <h2 className="text-base font-black">⑥ 大きな損失と関連する形を比較</h2>
        <p className="mt-2 text-xs leading-5 text-slate-700">
          過去に固定した5つの特徴量で、①底②確認翌日の仮取引が5営業日後に
          <strong>−3%以上／−5%以上</strong>になった割合を比較。
          <strong>初検出時の条件だけで分類</strong>し、後日の安値・出来高は分類に使いません。
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-950">
          これは損失事例を見た後の探索分析です。相関と原因は異なります。
          成績の良い区分だけを選んで新しい買い条件にするのは危険です。
        </p>
        <div className="mt-3 space-y-2">
          {analysis.riskStrata.map((axis,index)=>(
            <details key={axis.id} open={index===3||index===4}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-black">{axis.title}・損失率</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {axis.groups.map(group=>(
                  <div key={group.id} className="rounded-xl bg-white p-3">
                    <p className="text-sm font-black">{group.label}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      候補 {group.events}件 / {group.distinctSymbols}銘柄 /
                      5日後確定 {group.matured}・待ち {group.pending}
                    </p>
                    <p className="mt-2 text-base font-black text-rose-800">
                      −5%以下：{group.loss5}/{group.matured}件
                      <span className="block text-xs font-medium">割合：{numPct(group.loss5Rate)}</span>
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-700">
                      −3%以下：{group.loss3}件（{numPct(group.loss3Rate)}）<br />
                      5日後平均：{pct(group.mean5)} / 最悪：{pct(group.worst5)}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-700">
          検出候補が少ない区分・同一銘柄の重複がある区分では統計が不安定です。
          成績は往復コスト0.2ポイントを差し引いた事後の参考値で、取引の約定可能性は未検証。
          買い・売り・通知への接続はありません。研究版：{analysis.version}。
        </p>
      </section>
      <section className="rounded-2xl border border-slate-300 bg-white p-4">
        <h2 className="text-base font-black">⑦ 同じ銘柄の候補が多すぎる影響を検証</h2>
        <p className="mt-2 text-xs leading-5 text-slate-700">
          一つの銘柄で何度も候補が出ると、その銘柄の成績が全体平均を左右します。
          <strong>候補全件の平均</strong>と<strong>各銘柄を同じ重みで計算した平均</strong>を比較し、
          −5%以下の損失がどの銘柄に集中したかを表示します。
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {analysis.symbolBalance.byScenario.map(item=>(
            <div key={item.scenario} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-black">{scenarioLabels[item.scenario]}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white p-2">
                  <p className="text-[11px] font-bold text-slate-600">候補全件の平均</p>
                  <p className="mt-1 text-lg font-black">{pct(item.pooled5Mean)}</p>
                  <p className="text-[11px] text-slate-600">確定{item.totalMatured}件</p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <p className="text-[11px] font-bold text-slate-600">銘柄を均等にした平均</p>
                  <p className="mt-1 text-lg font-black">{pct(item.equalSymbol5Mean)}</p>
                  <p className="text-[11px] text-slate-600">確定{item.maturedSymbols}銘柄</p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-6 text-slate-700">
                −5%以下は{item.totalLoss5}件 / 損失発生は{item.codesWithLoss5}銘柄。
                {item.biggestLossCluster && (
                  <> 最多は{item.biggestLossCluster.code}の{item.biggestLossCluster.loss5}件
                    （全損失の{item.biggestLossCluster.shareOfAllLossesPercent.toFixed(1)}%）。</>
                )}
              </p>
              <details className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                <summary className="cursor-pointer text-xs font-black">銘柄別の内訳を開く</summary>
                <div className="mt-2 space-y-1">
                  {item.perCode.map(code=>(
                    <div key={code.code} className="flex justify-between gap-2 border-b border-slate-100 py-1 text-xs">
                      <span>{code.code}（確定{code.matured}）</span>
                      <span className="text-right">{pct(code.mean5)} / −5%以下{code.losses5}件</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-amber-900">
          この平均は銘柄ごとの参考値であり、相場の独立性・将来の利益を保証しません。
          この研究で良かった銘柄を後から選んでいるわけではありません。
          未確定の銘柄は均等平均の分母から除外します。
        </p>
      </section>
    </>
  );
}
