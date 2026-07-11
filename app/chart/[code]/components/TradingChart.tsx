"use client";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type PriceLevel = {
  key: string;
  label: string;
  price: number;
  color: string;
  fill: string;
  dash?: string;
  width: number;
};

type TradingChartProps = {
  candles: Candle[];
  ma20: number | null;
  currentPrice: number | null;
  takeProfit: number;
  stopLoss: number;
  supportPrice: number | null;
  resistancePrice: number | null;
  mobileHeight?: number;
  desktopHeight?: number;
};

function timeLabel(time: number) {
  return new Date(time * 1000).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildLevels({
  ma20,
  currentPrice,
  takeProfit,
  stopLoss,
  supportPrice,
  resistancePrice,
}: Omit<TradingChartProps, "candles" | "mobileHeight" | "desktopHeight">) {
  const levels: Array<PriceLevel | null> = [
    resistancePrice !== null
      ? {
          key: "resistance",
          label: "抵抗線",
          price: resistancePrice,
          color: "#dc2626",
          fill: "#fee2e2",
          dash: "10 6",
          width: 2.2,
        }
      : null,
    {
      key: "takeProfit",
      label: "利確",
      price: takeProfit,
      color: "#16a34a",
      fill: "#dcfce7",
      dash: "8 5",
      width: 2,
    },
    currentPrice !== null
      ? {
          key: "current",
          label: "現在値",
          price: currentPrice,
          color: "#2563eb",
          fill: "#dbeafe",
          width: 3.2,
        }
      : null,
    ma20 !== null
      ? {
          key: "ma20",
          label: "MA20",
          price: ma20,
          color: "#7c3aed",
          fill: "#ede9fe",
          dash: "5 4",
          width: 1.8,
        }
      : null,
    supportPrice !== null
      ? {
          key: "support",
          label: "支持線",
          price: supportPrice,
          color: "#0f766e",
          fill: "#ccfbf1",
          dash: "10 6",
          width: 2.2,
        }
      : null,
    {
      key: "stopLoss",
      label: "損切",
      price: stopLoss,
      color: "#ea580c",
      fill: "#ffedd5",
      dash: "8 5",
      width: 2,
    },
  ];

  return levels.filter((level): level is PriceLevel => level !== null);
}

function normalizeLabels(
  levels: Array<PriceLevel & { lineY: number; labelY: number }>,
  minGap: number,
  minY: number,
  maxY: number,
) {
  const sorted = [...levels].sort((a, b) => a.labelY - b.labelY);

  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index].labelY - sorted[index - 1].labelY < minGap) {
      sorted[index].labelY = sorted[index - 1].labelY + minGap;
    }
  }

  const overflow = Math.max(0, sorted[sorted.length - 1].labelY - maxY);
  if (overflow > 0) {
    for (const level of sorted) level.labelY -= overflow;
  }

  const underflow = Math.max(0, minY - sorted[0].labelY);
  if (underflow > 0) {
    for (const level of sorted) level.labelY += underflow;
  }

  return sorted;
}

export default function TradingChart({
  candles,
  ma20,
  currentPrice,
  takeProfit,
  stopLoss,
  supportPrice,
  resistancePrice,
  mobileHeight = 440,
  desktopHeight = 700,
}: TradingChartProps) {
  const data = candles.slice(-60);

  if (!data.length) {
    return (
      <div className="grid min-h-[260px] place-items-center rounded-[24px] border border-slate-200 bg-slate-50">
        <p className="text-sm font-bold text-slate-500">チャートデータなし</p>
      </div>
    );
  }

  const levels = buildLevels({
    ma20,
    currentPrice,
    takeProfit,
    stopLoss,
    supportPrice,
    resistancePrice,
  });

  const renderChart = (isDesktop: boolean) => {
    const width = isDesktop ? 1280 : 360;
    const height = isDesktop ? desktopHeight : mobileHeight;

    const chartLeft = isDesktop ? 78 : 38;
    const chartRight = isDesktop ? 1035 : 230;
    const labelLeft = isDesktop ? 1060 : 240;
    const labelRight = isDesktop ? 1255 : 352;
    const paddingTop = isDesktop ? 34 : 26;
    const paddingBottom = isDesktop ? 58 : 38;

    const candlePrices = data.flatMap((candle) => [
      candle.high,
      candle.low,
      candle.open,
      candle.close,
    ]);

    const allPrices = [
      ...candlePrices,
      ...levels.map((level) => level.price),
    ];

    const globalMin = Math.min(...allPrices);
    const globalMax = Math.max(...allPrices);

    const candleMin = Math.min(...candlePrices);
    const candleMax = Math.max(...candlePrices);
    const candleRange = Math.max(candleMax - candleMin, 1);

    const center = currentPrice ?? (candleMin + candleMax) / 2;
    const minimumFocusRange = Math.max(center * 0.018, 12);
    const focusRange = Math.max(candleRange * 1.35, minimumFocusRange);

    const focusMin = Math.min(candleMin - candleRange * 0.12, center - focusRange / 2);
    const focusMax = Math.max(candleMax + candleRange * 0.12, center + focusRange / 2);

    const plotTop = paddingTop;
    const plotBottom = height - paddingBottom;
    const plotHeight = plotBottom - plotTop;

    // 中央72%を実際のローソク足に使い、遠い利確・抵抗線などは
    // 上下14%へ圧縮して表示する。全ラインを残しつつ値動きを大きく見せる。
    const outerRatio = 0.14;
    const coreTop = plotTop + plotHeight * outerRatio;
    const coreBottom = plotBottom - plotHeight * outerRatio;

    const y = (price: number) => {
      if (price > focusMax) {
        const outerRange = Math.max(globalMax - focusMax, 1);
        const ratio = (price - focusMax) / outerRange;
        return coreTop - ratio * (coreTop - plotTop);
      }

      if (price < focusMin) {
        const outerRange = Math.max(focusMin - globalMin, 1);
        const ratio = (focusMin - price) / outerRange;
        return coreBottom + ratio * (plotBottom - coreBottom);
      }

      const ratio = (price - focusMin) / Math.max(focusMax - focusMin, 1);
      return coreBottom - ratio * (coreBottom - coreTop);
    };

    const candleWidth = Math.max(
      isDesktop ? 12 : 3.8,
      (chartRight - chartLeft) / data.length - (isDesktop ? 1.2 : 1),
    );

    const positioned = normalizeLabels(
      levels.map((level) => ({
        ...level,
        lineY: y(level.price),
        labelY: y(level.price),
      })),
      isDesktop ? 44 : 22,
      paddingTop + (isDesktop ? 16 : 10),
      height - paddingBottom - (isDesktop ? 16 : 10),
    );

    const horizontalGridCount = isDesktop ? 6 : 4;
    const verticalGridCount = isDesktop ? 7 : 5;

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        role="img"
        aria-label="株価チャート"
      >
        <rect
          x={chartLeft}
          y={paddingTop}
          width={chartRight - chartLeft}
          height={height - paddingTop - paddingBottom}
          rx={isDesktop ? 22 : 16}
          fill="#f8fafc"
        />

        {Array.from({ length: horizontalGridCount }, (_, index) => {
          const price =
            focusMin +
            ((focusMax - focusMin) * index) / (horizontalGridCount - 1);

          return (
            <g key={`price-grid-${index}`}>
              <line
                x1={chartLeft}
                x2={chartRight}
                y1={y(price)}
                y2={y(price)}
                stroke="#eef2f6"
                strokeWidth="1"
                strokeDasharray="2 5"
              />
              <text
                x={isDesktop ? 12 : 2}
                y={y(price) + (isDesktop ? 6 : 4)}
                fontSize={isDesktop ? 14 : 9}
                fill="#64748b"
                fontWeight="700"
              >
                {Math.round(price).toLocaleString()}
              </text>
            </g>
          );
        })}

        {Array.from({ length: verticalGridCount }, (_, index) => {
          const x =
            chartLeft +
            ((chartRight - chartLeft) * index) / (verticalGridCount - 1);

          return (
            <line
              key={`time-grid-${index}`}
              x1={x}
              x2={x}
              y1={paddingTop}
              y2={height - paddingBottom}
              stroke="#f4f6f9"
              strokeWidth="1"
              strokeDasharray="2 6"
            />
          );
        })}

        {levels.map((level) => (
          <line
            key={`line-${level.key}`}
            x1={chartLeft}
            x2={chartRight}
            y1={y(level.price)}
            y2={y(level.price)}
            stroke={level.color}
            strokeWidth={level.width}
            strokeDasharray={level.dash}
            opacity={level.key === "current" ? 1 : 0.92}
          />
        ))}

        {data.map((candle, index) => {
          const x =
            chartLeft +
            (index / Math.max(data.length - 1, 1)) *
              (chartRight - chartLeft);

          const up = candle.close >= candle.open;
          const color = up ? "#ef4444" : "#16a34a";
          const bodyTop = y(Math.max(candle.open, candle.close));
          const bodyBottom = y(Math.min(candle.open, candle.close));
          const bodyHeight = Math.max(
            bodyBottom - bodyTop,
            isDesktop ? 3 : 2,
          );

          return (
            <g key={`${candle.time}-${index}`}>
              <line
                x1={x}
                x2={x}
                y1={y(candle.high)}
                y2={y(candle.low)}
                stroke={color}
                strokeWidth={isDesktop ? 1.5 : 1}
              />
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={up ? "#fee2e2" : "#dcfce7"}
                stroke={color}
                strokeWidth={isDesktop ? 1.5 : 1}
                rx={isDesktop ? 1 : 0.5}
              />
            </g>
          );
        })}

        {positioned.map((level) => (
          <g key={`label-${level.key}`}>
            <path
              d={`M ${chartRight} ${level.lineY} L ${
                labelLeft - (isDesktop ? 12 : 6)
              } ${level.labelY}`}
              stroke={level.color}
              strokeWidth={isDesktop ? 1.8 : 1.2}
              fill="none"
              opacity="0.8"
            />

            <rect
              x={labelLeft}
              y={level.labelY - (isDesktop ? 17 : 10)}
              width={labelRight - labelLeft}
              height={isDesktop ? 34 : 20}
              rx={isDesktop ? 10 : 8}
              fill={level.fill}
              stroke={level.color}
              strokeWidth={
                level.key === "current"
                  ? isDesktop
                    ? 2.6
                    : 1.8
                  : level.key === "support" || level.key === "resistance"
                    ? isDesktop
                      ? 2.2
                      : 1.4
                    : 1.2
              }
            />

            <text
              x={labelLeft + (isDesktop ? 14 : 7)}
              y={level.labelY + (isDesktop ? 6 : 3.5)}
              fontSize={isDesktop ? 15 : 9}
              fill={level.color}
              fontWeight="950"
            >
              {level.label} {Math.round(level.price).toLocaleString()}
            </text>
          </g>
        ))}

        {data.map((candle, index) => {
          const every = isDesktop ? 12 : 10;
          if (index % every !== 0 && index !== data.length - 1) return null;

          const x =
            chartLeft +
            (index / Math.max(data.length - 1, 1)) *
              (chartRight - chartLeft);

          return (
            <text
              key={`time-${candle.time}`}
              x={x}
              y={height - (isDesktop ? 18 : 10)}
              textAnchor="middle"
              fontSize={isDesktop ? 13 : 8}
              fill="#64748b"
              fontWeight="700"
            >
              {timeLabel(candle.time)}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
      <div className="h-[440px] w-full md:hidden">{renderChart(false)}</div>
      <div className="hidden h-[700px] w-full md:block">
        {renderChart(true)}
      </div>
    </div>
  );
}
