type ChartProps = {
  trend: "up" | "down" | "wait";
};

export default function MiniCandlestickChart({ trend }: ChartProps) {
  const candles = [
    { x: 20, open: 80, close: 60, high: 90, low: 55 },
    { x: 55, open: 62, close: 72, high: 78, low: 58 },
    { x: 90, open: 72, close: 48, high: 76, low: 42 },
    { x: 125, open: 50, close: 38, high: 58, low: 32 },
    { x: 160, open: 40, close: 52, high: 60, low: 36 },
    { x: 195, open: 54, close: 34, high: 58, low: 28 },
    { x: 230, open: 36, close: 26, high: 44, low: 22 },
    { x: 265, open: 28, close: 18, high: 32, low: 14 },
  ];

  const strokeColor =
    trend === "up"
      ? "text-green-400"
      : trend === "down"
        ? "text-red-400"
        : "text-yellow-400";

  return (
    <div className="mt-5 h-52 rounded-2xl border border-zinc-800 bg-black p-4">
      <svg viewBox="0 0 300 120" className="h-full w-full">
        <g className="text-zinc-800">
          <line x1="0" y1="30" x2="300" y2="30" stroke="currentColor" />
          <line x1="0" y1="60" x2="300" y2="60" stroke="currentColor" />
          <line x1="0" y1="90" x2="300" y2="90" stroke="currentColor" />
        </g>

        {candles.map((candle) => {
          const isUp = candle.close < candle.open;
          const y = Math.min(candle.open, candle.close);
          const height = Math.abs(candle.open - candle.close) || 2;

          return (
            <g key={candle.x}>
              <line
                x1={candle.x}
                y1={candle.high}
                x2={candle.x}
                y2={candle.low}
                stroke="currentColor"
                strokeWidth="3"
                className={isUp ? "text-green-400" : "text-red-400"}
              />
              <rect
                x={candle.x - 8}
                y={y}
                width="16"
                height={height}
                rx="3"
                className={isUp ? "fill-green-400" : "fill-red-400"}
              />
            </g>
          );
        })}

        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className={strokeColor}
          points="20,80 55,72 90,48 125,38 160,52 195,34 230,26 265,18"
        />
      </svg>
    </div>
  );
}