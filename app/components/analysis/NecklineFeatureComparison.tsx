type ReturnStats = {
  completed: number;
  meanPercent: number | null;
  positivePercent: number | null;
  worstPercent: number | null;
};
export type FeatureCohortGroup = {
  id: string;
  label: string;
  candidates: number;
  distinctSymbols: number;
  distinctDates: number;
  breakout: number;
  invalidated: number;
  expired: number;
  pending: number;
  resolved: number;
  resolvedBreakoutPercent: number | null;
  early3: ReturnStats;
  early5: ReturnStats;
  descriptiveSampleReady: boolean;
  selectionValidated: boolean;
};
export type NecklineFeatureAnalysis = {
  version: string;
  sampleCandidates: number;
  exploratoryOnly: boolean;
  selectionValidated: boolean;
  axes: {
    id: string;
    title: string;
    description: string;
    groups: FeatureCohortGroup[];
  }[];
};
const percent = (v: number | null) => v == null ? "未確定" : (v > 0 ? "+" : "") + v.toFixed(2) + "%";

export default function NecklineFeatureComparison({ analysis }: { analysis: NecklineFeatureAnalysis }) {
  return (
    <section className="rounded-2xl border border-indigo-200 bg-white p-4" aria-label="初検出時点の条件別比較">
      <h2 className="text-lg font-black">🔵 どんな形が上抜けした？ 固定条件で比較</h2>
      <p className="mt-2 text-xs leading-5 text-slate-700">
        底①・底②の確認日までの情報だけで、<strong>あらかじめ決めた5項目</strong>に振り分けました。
        未来に起こった上抜け・失効は<strong>集計結果にだけ</strong>使用。条件は結果に合わせて変更しません。
      </p>
      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
        検証対象は選択した最大5銘柄、過去6か月の日足です。比較用の仮区分であり、
        「この形なら買い」「この形は売り」と判定する機能ではありません。
        独立した別期間の前向き検証が終わるまでは、どの区分も研究資料として扱います。
      </p>
      {analysis.sampleCandidates === 0 ? (
        <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm font-bold text-slate-700" role="status">
          今回は候補0件のため、条件別の勝率は計算しません。別の銘柄や期間での検証が必要です。
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {analysis.axes.map((axis, i) => (
            <details key={axis.id} open={i === 0} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-black text-slate-900">
                {axis.title}
                <span className="ml-2 text-xs font-normal text-slate-600">比較を見る</span>
              </summary>
              <p className="mt-2 text-xs leading-5 text-slate-600">{axis.description}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {axis.groups.map(group => (
                  <div key={group.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-black text-slate-900">{group.label}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      候補 {group.candidates}件 / {group.distinctSymbols}銘柄・{group.distinctDates}検出日
                    </p>
                    <div className="mt-2 rounded-lg bg-indigo-50 p-2">
                      <p className="text-xs font-bold text-indigo-900">
                        終了した{group.resolved}件のうち、上抜け{group.breakout}件
                      </p>
                      <p className="mt-1 text-lg font-black text-indigo-800">
                        {group.resolvedBreakoutPercent == null
                          ? "未算出" : group.resolvedBreakoutPercent.toFixed(1) + "%"}
                      </p>
                      <p className="text-[11px] leading-4 text-indigo-900">
                        安値割れ{group.invalidated} / 期限終了{group.expired} / 未確定{group.pending}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-slate-700">
                      全候補の3営業日後平均：<strong>{percent(group.early3.meanPercent)}</strong>
                      （確定{group.early3.completed}/{group.candidates}）<br />
                      全候補の5営業日後平均：<strong>{percent(group.early5.meanPercent)}</strong>
                      （確定{group.early5.completed}/{group.candidates}）<br />
                      5営業日プラス率：{group.early5.positivePercent == null
                        ? "未算出" : group.early5.positivePercent.toFixed(1) + "%"}
                      / 最悪：{percent(group.early5.worstPercent)}
                    </p>
                    <p className="mt-2 text-[11px] font-bold text-amber-800">
                      {group.candidates === 0 ? "この区分の候補は0件" : group.descriptiveSampleReady ? "探索集計のみ・将来成績未検証" : "検証不足・優劣未確定"}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs leading-5 text-slate-600">
        研究バージョン：{analysis.version}。上抜け率は結果が確定した候補だけが分母。
        3・5営業日後の平均は<strong>上抜けしなかった候補も含む</strong>全候補から、結果の確定分だけを集計。
        同一銘柄の複数候補は独立した標本ではありません。5項目の組み合わせ探索や閾値の最適化は行いません。
      </p>
    </section>
  );
}
