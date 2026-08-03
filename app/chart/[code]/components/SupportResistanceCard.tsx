"use client";

type SupportResistanceCardProps = {
  supportPrice: number | null;
  currentPrice: number | null;
  resistancePrice: number | null;
  supportDiff: number | null;
  resistanceDiff: number | null;
  statusLabel: string;
  breakoutExpectation: number;
  comment: string;
};

function yen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function signedYen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString()}円`;
}

function LevelItem({
  label,
  helper,
  value,
  diff,
  tone,
}: {
  label: string;
  helper?: string;
  value: number | null;
  diff?: number | null;
  tone: "support" | "current" | "resistance";
}) {
  const style =
    tone === "support"
      ? "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200"
      : tone === "resistance"
        ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200";

  return (
    <div className={`min-w-0 rounded-[18px] border px-1.5 py-2.5 text-center sm:p-3 ${style}`}>
      <p className="text-[10px] font-black leading-tight opacity-75">
        {label}
      </p>
      {helper && <p className="text-[9px] font-bold leading-tight opacity-70">（{helper}）</p>}
      <p className="mt-1 truncate text-base font-black sm:text-lg">{yen(value)}</p>
      {diff !== undefined && diff !== null && (
        <p className="mt-1 text-xs font-black">{signedYen(diff)}</p>
      )}
    </div>
  );
}

export default function SupportResistanceCard({
  supportPrice,
  currentPrice,
  resistancePrice,
  supportDiff,
  resistanceDiff,
  statusLabel,
  breakoutExpectation,
  comment,
}: SupportResistanceCardProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">支持線・抵抗線</h2>
        </div>

        <span className="max-w-[48%] rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-center text-xs font-black leading-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-3">
        <LevelItem
          label="支持線"
          helper="下値の目安"
          value={supportPrice}
          diff={supportDiff}
          tone="support"
        />
        <LevelItem
          label="現在値"
          value={currentPrice}
          tone="current"
        />
        <LevelItem
          label="抵抗線"
          helper="上値の壁"
          value={resistancePrice}
          diff={resistanceDiff}
          tone="resistance"
        />
      </div>

      <div className="mt-4 rounded-[18px] border border-blue-100 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-slate-700 dark:text-slate-200">
              ブレイク期待度
            </p>
            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400">上値突破の期待度</p>
          </div>

          <p className="text-3xl font-black text-blue-700">
            {breakoutExpectation}%
          </p>
        </div>

        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{
              width: `${Math.min(Math.max(breakoutExpectation, 0), 100)}%`,
            }}
          />
        </div>
      </div>

      <p className="mt-4 text-sm font-bold leading-7 text-slate-700 dark:text-slate-200">
        {comment}
      </p>
    </section>
  );
}
