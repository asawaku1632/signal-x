type DonutChartProps = {
  win: number;
  lose: number;
  hold: number;
  pending: number;
  total: number;
};

export default function DonutChart({
  win,
  lose,
  hold,
  pending,
  total,
}: DonutChartProps) {
  const winPercent = total === 0 ? 0 : Math.round((win / total) * 100);
  const losePercent = total === 0 ? 0 : Math.round((lose / total) * 100);
  const holdPercent = total === 0 ? 0 : Math.round((hold / total) * 100);
  const pendingPercent = total === 0 ? 0 : Math.round((pending / total) * 100);

  const winDeg = winPercent * 3.6;
  const loseDeg = losePercent * 3.6;
  const holdDeg = holdPercent * 3.6;
  const pendingDeg = pendingPercent * 3.6;

  return (
    <div className="flex items-center gap-4">
      <div
        className="w-36 h-36 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: `conic-gradient(
            #22c55e 0deg ${winDeg}deg,
            #ef4444 ${winDeg}deg ${winDeg + loseDeg}deg,
            #f97316 ${winDeg + loseDeg}deg ${winDeg + loseDeg + holdDeg}deg,
            #94a3b8 ${winDeg + loseDeg + holdDeg}deg ${
              winDeg + loseDeg + holdDeg + pendingDeg
            }deg
          )`,
        }}
      >
        <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
          <p className="text-xs font-black text-slate-400">TOTAL</p>
          <p className="text-2xl font-black text-slate-900">
            {total.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <Legend label="WIN" value={win} percent={winPercent} color="bg-green-500" />
        <Legend label="LOSE" value={lose} percent={losePercent} color="bg-red-500" />
        <Legend label="HOLD" value={hold} percent={holdPercent} color="bg-orange-500" />
        <Legend label="判定待ち" value={pending} percent={pendingPercent} color="bg-slate-400" />
      </div>
    </div>
  );
}

function Legend({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: number;
  percent: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${color}`} />
        <p className="text-xs font-black text-slate-700">{label}</p>
      </div>
      <p className="text-xs font-bold text-slate-500">
        {value}件 / {percent}%
      </p>
    </div>
  );
}