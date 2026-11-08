import type { ShadowNineSummary } from "@/app/lib/research/shadowCandleNineOverview";

const colors = {
  CAUTION: "border-amber-300 bg-amber-50 text-amber-950",
  WATCH: "border-amber-200 bg-amber-50 text-amber-900",
  NO_BEARISH: "border-slate-200 bg-slate-50 text-slate-900",
  STALE: "border-slate-300 bg-slate-100 text-slate-800",
} as const;
const markers = {
  CAUTION: "⚠️", WATCH: "🔎", NO_BEARISH: "🔍", STALE: "⌛",
} as const;

export default function ShadowNineOverview({
  summary, code, latestDate, candleCount,
}: {
  summary: ShadowNineSummary;
  code: string;
  latestDate: string | null;
  candleCount: number;
}) {
  return (
    <section aria-label="銘柄ローソク足研究・総合結果"
      className="mt-4 rounded-2xl border-2 border-sky-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black">📋 {code} の総合結果</h2>
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
          本人限定・研究用
        </span>
      </div>
      <div className={`mt-3 rounded-xl border p-3 ${colors[summary.status]}`}>
        <p className="text-xl font-black">{markers[summary.status]} {summary.heading}</p>
        <p className="mt-1 text-sm leading-6">{summary.explanation}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="text-[11px] font-bold text-slate-600">過去の検出</p>
          <p className="mt-1 text-lg font-black">{summary.hitCount}件</p>
          <p className="text-[10px] text-slate-500">{summary.detectedTypes}/9種類</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="text-[11px] font-bold text-slate-600">最新足の検出</p>
          <p className="mt-1 text-lg font-black">{summary.recentBarSignals}件</p>
          <p className="text-[10px] text-slate-500">9種類が対象</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2">
          <p className="text-[11px] font-bold text-slate-600">5日後の確定</p>
          <p className="mt-1 text-lg font-black">{summary.completedFiveDay}/{summary.totalFiveDay}</p>
          <p className="text-[10px] text-slate-500">検出イベント</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-bold text-slate-600">最後に見つかったローソク足形状</p>
        {summary.mostRecentHits.length ? (
          <>
            <p className="mt-1 text-base font-black">
              {summary.mostRecentHits.map(hit => hit.name).join("・")}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {summary.mostRecentDate} ／最新確定日足から{summary.sessionsSinceLastHit}営業日前
              {summary.fiveDayPendingForMostRecent ? " ／5日後の結果はまだ未確定" : ""}
            </p>
            {summary.sessionsSinceLastHit !== 0 && (
              <p className="mt-1 text-xs font-bold text-slate-700">
                過去に出た形であり、最新足に出現したという意味ではありません。
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm font-bold text-slate-700">対象期間に検出なし</p>
        )}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        参考データ：{latestDate ?? "日付不明"}までの確定日足{candleCount}本。
        過去の小さな検出数を合算して売買勝率にはしません。
        決算・出来高・相場環境・約定可能性は未評価。買い推奨・購入禁止の判定ではありません。
      </p>
    </section>
  );
}
