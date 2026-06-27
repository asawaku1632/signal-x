"use client";

type TrendItem = {
  label: string;
  value: number;
};

type Props = {
  data: TrendItem[];
};

export default function WinRateChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm font-bold text-slate-400">
        データがありません
      </div>
    );
  }

  const width = 320;
  const height = 180;
  const padding = 28;

  const points = data.map((item, index) => {
    const x =
      padding +
      (index / Math.max(data.length - 1, 1)) * (width - padding * 2);

    const y =
      height -
      padding -
      (item.value / 100) * (height - padding * 2);

    return {
      ...item,
      x,
      y,
    };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[220px]"
        role="img"
      >
        {[0, 25, 50, 75, 100].map((value) => {
          const y =
            height -
            padding -
            (value / 100) * (height - padding * 2);

          return (
            <g key={value}>
              <line
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x="4"
                y={y + 4}
                fontSize="9"
                fill="#64748b"
                fontWeight="700"
              >
                {value}%
              </text>
            </g>
          );
        })}

        <polyline
          points={line}
          fill="none"
          stroke="#2563eb"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point) => (
          <g key={point.label}>
            <circle
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth="3"
            />
            <text
              x={point.x}
              y={height - 8}
              textAnchor="middle"
              fontSize="9"
              fill="#64748b"
              fontWeight="700"
            >
              {point.label.replace("日目", "")}
            </text>
            <text
              x={point.x}
              y={point.y - 10}
              textAnchor="middle"
              fontSize="9"
              fill="#2563eb"
              fontWeight="900"
            >
              {point.value}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}