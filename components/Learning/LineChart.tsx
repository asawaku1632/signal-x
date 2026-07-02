type LineChartProps = {
  data: { label: string; value: number }[];
  suffix?: string;
  colorClass: string;
};

export default function LineChart({
  data,
  suffix = "",
  colorClass,
}: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-40 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
        <p className="text-sm font-bold text-slate-400">
          まだグラフ表示用データがありません
        </p>
      </div>
    );
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="h-44 rounded-2xl bg-slate-50 border border-slate-100 p-3 flex items-end gap-2">
      {data.slice(-7).map((item) => {
        const height = Math.max((item.value / max) * 100, 6);

        return (
          <div
            key={item.label}
            className="flex-1 flex flex-col items-center justify-end"
          >
            <p className="text-[10px] font-black text-slate-500 mb-1">
              {item.value}
              {suffix}
            </p>
            <div
              className={`w-full rounded-t-xl ${colorClass}`}
              style={{ height: `${height}%` }}
            />
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              {item.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}