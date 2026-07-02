type SummaryMiniProps = {
  label: string;
  value: string;
  sub: string;
  color: string;
};

export default function SummaryMini({
  label,
  value,
  sub,
  color,
}: SummaryMiniProps) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-3 text-center shadow-sm">
      <p className="text-[10px] font-black text-slate-500">{label}</p>

      <p className={`text-2xl font-black mt-1 ${color}`}>
        {value}
      </p>

      <p className="text-[10px] font-bold text-slate-400 mt-1">
        {sub}
      </p>
    </div>
  );
}