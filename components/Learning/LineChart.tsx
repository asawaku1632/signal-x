type ChartItem = {
  label: string;
  value: number;
};

export default function LineChart({
  data,
  suffix = "",
  colorClass = "text-blue-600",
}: {
  data: ChartItem[];
  suffix?: string;
  colorClass?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm font-bold text-slate-400">
        データがありません
      </div>
    );
  }

  const width = 320;
  const height = 150;
  const paddingX = 28;
  const paddingY = 24;

  const values = data.map((item) => item.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? width / 2
        : paddingX +
          (index / (data.length - 1)) * (width - paddingX * 2);

    const y =
      height -
      paddingY -
      ((item.value - min) / range) * (height - paddingY * 2);

    return { ...item, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    height - paddingY
  } L ${points[0].x} ${height - paddingY} Z`;

  const strokeColor = colorClass.includes("green") ? "#16a34a" : "#2563eb";
  const fillColor = colorClass.includes("green") ? "#dcfce7" : "#dbeafe";

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-44"
        preserveAspectRatio="none"
      >
        <path d={areaPath} fill={fillColor} opacity="0.8" />

        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point) => (
          <g key={`${point.label}-${point.value}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="white"
              stroke={strokeColor}
              strokeWidth="3"
            />

            <text
              x={point.x}
              y={point.y - 12}
              textAnchor="middle"
              className="fill-slate-900 text-[11px] font-black"
            >
              {point.value}
              {suffix}
            </text>

            <text
              x={point.x}
              y={height - 4}
              textAnchor="middle"
              className="fill-slate-500 text-[10px] font-bold"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}