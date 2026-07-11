"use client";

type ActionCardProps = {
  title: string;
  targetPrice: number;
  resultLabel: string;
  resultValue: number;
  requiredMoney: number;
  tone: "profit" | "loss";
};

function yen(value: number) {
  return `${Math.round(value).toLocaleString()}円`;
}

function signedYen(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString()}円`;
}

export default function ActionCard({
  title,
  targetPrice,
  resultLabel,
  resultValue,
  requiredMoney,
  tone,
}: ActionCardProps) {
  const style =
    tone === "profit"
      ? {
          shell: "border-emerald-200 bg-emerald-50 text-emerald-800",
          inner: "bg-white/80",
          accent: "text-emerald-700",
        }
      : {
          shell: "border-red-200 bg-red-50 text-red-800",
          inner: "bg-white/80",
          accent: "text-red-700",
        };

  return (
    <section
      className={`rounded-[24px] border p-4 shadow-sm ${style.shell}`}
    >
      <p className="text-sm font-black">{title}</p>

      <p className={`mt-2 text-3xl font-black ${style.accent}`}>
        {yen(targetPrice)}
      </p>

      <div className={`mt-4 rounded-[18px] px-3 py-3 ${style.inner}`}>
        <p className="text-xs font-black opacity-75">{resultLabel}</p>
        <p className={`mt-1 text-2xl font-black ${style.accent}`}>
          {signedYen(resultValue)}
        </p>
      </div>

      <div className={`mt-3 rounded-[18px] px-3 py-3 ${style.inner}`}>
        <p className="text-xs font-black opacity-75">💰 必要資金</p>
        <p className="mt-1 text-xl font-black text-slate-900">
          {yen(requiredMoney)}
        </p>
      </div>

      <p className="mt-3 text-[11px] font-bold opacity-70">
        100株基準
      </p>
    </section>
  );
}
