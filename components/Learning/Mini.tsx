type MiniProps = {
  label: string;
  value: string;
  color: string;
};

export default function Mini({
  label,
  value,
  color,
}: MiniProps) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className={`text-xl font-black mt-1 ${color}`}>{value}</p>
    </div>
  );
}