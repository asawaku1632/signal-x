export default function WinRateRing({ winRate }: { winRate: number }) {
  const safeRate = Math.max(0, Math.min(winRate, 100));

  return (
    <div
      className="w-36 h-36 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: `conic-gradient(#2563eb ${safeRate * 3.6}deg, #e2e8f0 0deg)`,
      }}
    >
      <div className="w-28 h-28 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
        <p className="text-4xl font-black text-slate-900">{safeRate}%</p>
        <p className="text-xs font-black text-slate-500 mt-1">
          現在のAI勝率
        </p>
      </div>
    </div>
  );
}