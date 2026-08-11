import type { BollingerSignal } from "@/app/lib/bollingerBands";
import {
  buildBollingerComment,
  getBandWalkRiskLabel,
  getBollingerExpectationLabel,
  getBollingerStatusLabel,
  getBollingerTitle,
  getExpectationLevel,
  isVisibleBollingerSignal,
} from "@/app/lib/bollingerPresentation";

type BollingerSignalCardProps = {
  signal?: BollingerSignal;
  variant?: "compact" | "detail";
  className?: string;
};

export default function BollingerSignalCard({
  signal,
  variant = "detail",
  className = "",
}: BollingerSignalCardProps) {
  if (!isVisibleBollingerSignal(signal)) return null;

  const isLower = signal.side === "LOWER_REBOUND";
  const isHighRisk = signal.bandWalkRisk === "HIGH";
  const title = getBollingerTitle(signal.side, signal.upperRegime);
  const status = getBollingerStatusLabel(signal.side, signal.status);
  const expectationLabel = getBollingerExpectationLabel(
    signal.side,
    signal.upperRegime,
  );
  const level = getExpectationLevel(signal.expectation);
  const riskLabel = getBandWalkRiskLabel(signal.bandWalkRisk);
  const accent = isLower
    ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/20"
    : "border-orange-200 bg-orange-50/70 dark:border-orange-800 dark:bg-orange-950/20";
  const accentText = isLower
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-orange-700 dark:text-orange-300";
  const bar = isLower ? "bg-emerald-500" : "bg-orange-500";

  if (variant === "compact") {
    return (
      <section
        data-testid="bollinger-compact"
        aria-label={`${title} ${status}`}
        className={`rounded-2xl border p-3 ${accent} ${className}`}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-xs font-black ${accentText}`}>{title}</p>
            <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{status}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-300">BB {expectationLabel}</p>
            <p className={`mt-0.5 text-xl font-black tabular-nums ${accentText}`}>
              {signal.expectation}<span className="text-xs"> / 100</span>
            </p>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/90 dark:bg-slate-800">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${signal.expectation}%` }} />
        </div>
        <p className="mt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
          AIランキングとは独立した日足BB情報
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-bold">
          <span className="text-slate-600 dark:text-slate-300">評価：{level}</span>
          {isLower && (
            <span className={isHighRisk ? "text-red-700 dark:text-red-300" : "text-slate-600 dark:text-slate-300"}>
              バンドウォークリスク：{riskLabel}
            </span>
          )}
          {!isLower && signal.upperRegime === "UPPER_TREND" && (
            <span className="text-blue-700 dark:text-blue-300">
              上昇バンドウォーク：{riskLabel}
            </span>
          )}
        </div>
        {isLower && isHighRisk && (
          <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-2 text-xs font-black text-red-700 dark:bg-red-950/30 dark:text-red-300">
            ⚠ 下降トレンド継続に注意
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      data-testid="bollinger-detail"
      aria-label={`${title}の詳細`}
      className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${isLower ? "border-emerald-200 dark:border-emerald-800" : "border-orange-200 dark:border-orange-800"} ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-black ${accentText}`}>日足ボリンジャーバンド 20日・2σ</p>
          <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">{title}</h2>
          <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">{status}</p>
        </div>
        <div className={`min-w-28 rounded-xl border p-3 text-right ${accent}`}>
          <p className="text-[10px] font-black text-slate-500 dark:text-slate-300">BB {expectationLabel}</p>
          <p className={`mt-1 text-3xl font-black tabular-nums ${accentText}`}>
            {signal.expectation}<span className="text-xs"> / 100</span>
          </p>
          <p className="mt-1 text-xs font-black text-slate-600 dark:text-slate-300">{level}</p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${signal.expectation}%` }} />
      </div>
      <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        AI POWERとは別の、日足BBだけを補足する指標です。
      </p>

      {isLower && (
        <div className={`mt-3 rounded-xl px-3 py-2.5 text-sm font-black ${isHighRisk ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
          バンドウォークリスク：{riskLabel}
          {isHighRisk && <span className="mt-1 block text-xs">下降トレンド継続に注意してください。</span>}
        </div>
      )}

      {!isLower && signal.upperRegime === "UPPER_TREND" && (
        <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2.5 text-sm font-black text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
          上側バンド継続性：{riskLabel}
          <span className="mt-1 block text-xs font-medium">
            上側バンド沿いの上昇は、直ちに下落を示すものではありません。
          </span>
        </div>
      )}

      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-medium leading-6 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {buildBollingerComment(signal)}
      </p>

      {signal.confirmations.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
            {isLower
              ? "反発を後押しする材料"
              : signal.upperRegime === "UPPER_REVERSAL"
                ? "失速を示す材料"
                : "上側BBの確認材料"}
          </h3>
          <ul className="mt-2 space-y-2">
            {signal.confirmations.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm font-medium leading-5 text-slate-700 dark:text-slate-300">
                <span className={accentText} aria-hidden="true">✓</span><span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {signal.warnings.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">注意したいポイント</h3>
          <ul className="mt-2 space-y-2">
            {signal.warnings.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm font-medium leading-5 text-slate-700 dark:text-slate-300">
                <span className="text-amber-600 dark:text-amber-400" aria-hidden="true">・</span><span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
