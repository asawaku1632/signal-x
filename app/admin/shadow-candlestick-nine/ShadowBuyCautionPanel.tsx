import type { ShadowBuyCautionResult } from "@/app/lib/research/shadowCandleBuyCaution";

function percentage(value: number | null) {
  if (value === null) return "検証不足";
  return value.toFixed(1) + "%";
}

function signed(value: number | null) {
  if (value === null) return "—";
  return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
}

export default function ShadowBuyCautionPanel({
  result,
  latestDate,
  code,
  statsAvailable,
}: {
  result: ShadowBuyCautionResult;
  latestDate: string | null;
  code: string;
  statsAvailable: boolean;
}) {
  const attention = result.level === "CAUTION";
  const observed = result.level === "OBSERVE";
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label="買う前の注意・研究用">
      <h2 className="text-lg font-black">🟡 買う前の注意（研究用）</h2>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        {code} ／最新の確定日足 {latestDate ?? "不明"}。今の株価や5分足を使った即時判定ではありません。
        この画面で研究した9種類のうち「下落方向の形」が最新確定日足に現れたかだけ確認します。
      </p>
      {result.level === "STALE" ? (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-black text-amber-900">
          株価データが古い、または日付を確認できません。現在の買い警告として扱わないでください。
        </p>
      ) : result.level === "NONE" ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="font-black text-slate-700">今回の対象4種類では、最新足に下落型を検出しませんでした。</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            「買ってよい」という意味ではありません。別の下落要因、決算、出来高、相場環境は未確認です。
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div role="status" className={`rounded-xl p-3 ${attention
            ? "border border-amber-300 bg-amber-50 text-amber-950"
            : "border border-slate-200 bg-slate-50 text-slate-800"}`}>
            <p className="font-black">
              {attention ? "⚠️ 下落型の研究サインあり：購入前に追加確認" : "🔎 下落型を検出：統計上の優位性は未確認"}
            </p>
            <p className="mt-1 text-xs leading-5">
              {attention
                ? "過去の研究で一定数の下落例があるため、買い急がず他の条件と照合するための注意表示です。"
                : "下落型という名前だけでは購入回避の理由になりません。まず実際の検出理由と件数を確認してください。"}
            </p>
          </div>
          {result.signals.map(signal => (
            <article key={signal.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black">{signal.name}</h3>
                <span className={`rounded-lg px-2 py-1 text-xs font-black ${signal.cautionQualified
                  ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                  {signal.cautionQualified ? "追加確認" : "研究継続"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">検出した理由：{signal.reasons.join("／")}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                <div>
                  <p className="text-[11px] text-slate-600">5日後に下落</p>
                  <p className="text-base font-black">{percentage(signal.directionMatchPercent)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-600">実際の対象</p>
                  <p className="text-base font-black">{signal.completed5d ?? "—"}件</p>
                  <p className="text-[10px] text-slate-500">{signal.distinctStocks ?? "—"}銘柄</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-600">5日後の平均株価変化</p>
                  <p className="text-base font-black">{signed(signal.averagePriceChangePercent)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                下落：{signal.directionalWins ?? "—"}/{signal.completed5d ?? "—"}件。
                株価変化のマイナスは実際の値下がりを表します（売り取引の利益率ではありません）。
              </p>
            </article>
          ))}
        </div>
      )}
      {!statsAvailable && result.signals.length > 0 && (
        <p role="status" className="mt-3 text-xs font-bold text-amber-800">
          保存済み研究の集計を取得できなかったため、過去の成績に基づく警告の強さは判定できません。
        </p>
      )}
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-6 text-slate-600">
        🔒 研究専用・本人限定。一定数の過去例があっても相関するシグナルを含み、
        買ってはいけない確率や実売買の勝率ではありません。
        検出日終値から5営業日後終値の比較で、売買手数料・約定・決算・市場環境は未考慮。
        AI POWER・買いランキング・通知・損切りルールは変更していません。
      </p>
    </section>
  );
}
