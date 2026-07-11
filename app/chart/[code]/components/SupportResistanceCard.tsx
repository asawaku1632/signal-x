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
  value,
  diff,
  tone,
}: {
  label: string;
  value: number | null;
  diff?: number | null;
  tone: "support" | "current" | "resistance";
}) {
  const style =
    tone === "support"
      ? "border-teal-200 bg-teal-50 text-teal-800"
      : tone === "resistance"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={`rounded-[18px] border p-3 text-center ${style}`}>
      <p className="text-[10px] font-black tracking-[0.12em] opacity-75">
        {label}
      </p>
      <p className="mt-1 text-lg font-black">{yen(value)}</p>
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
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-blue-600">
            SUPPORT & RESISTANCE
          </p>
          <h2 className="mt-1 text-xl font-black">支持線・抵抗線</h2>
        </div>

        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <LevelItem
          label="支持線"
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
          value={resistancePrice}
          diff={resistanceDiff}
          tone="resistance"
        />
      </div>

      <div className="mt-4 rounded-[18px] border border-blue-100 bg-blue-50 p-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.14em] text-blue-700">
              BREAKOUT
            </p>
            <p className="mt-1 text-sm font-black text-slate-700">
              ブレイク期待度
            </p>
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

      <p className="mt-4 text-sm font-bold leading-7 text-slate-700">
        {comment}
      </p>
    </section>
  );
}
