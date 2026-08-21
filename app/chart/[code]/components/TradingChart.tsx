"use client";

import {
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
  type WheelEvent,
} from "react";

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
  ema20: number | null;
  vwap: number | null;
  macd: number | null;
  macdSignal: number | null;
  currentPrice: number | null;
  takeProfit: number;
  stopLoss: number;
  supportPrice: number | null;
  resistancePrice: number | null;
  mobileHeight?: number;
  desktopHeight?: number;
};

type GestureState = {
  startX: number;
  startY: number;
  startOffset: number;
  startVisibleCount: number;
  startDistance: number;
  lastTapAt: number;
  axis: "horizontal" | "vertical" | null;
};

function timeLabel(time: number) {
  return new Date(time * 1000).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateTimeLabel(time: number) {
  return new Date(time * 1000).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
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
}: Pick<TradingChartProps, "ma20" | "currentPrice" | "takeProfit" | "stopLoss" | "supportPrice" | "resistancePrice">) {
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
  if (levels.length === 0) return [];

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

function touchDistance(
  touches: {
    length: number;
    [index: number]: {
      clientX: number;
      clientY: number;
    };
  },
) {
  if (touches.length < 2) return 0;

  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;

  return Math.hypot(dx, dy);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function indicatorSeries(candles: Candle[]) {
  let ema12: number | null = null;
  let ema26: number | null = null;
  let ema20: number | null = null;
  let signal: number | null = null;
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  return candles.map((candle, index) => {
    ema12 = ema12 === null ? candle.close : candle.close * (2 / 13) + ema12 * (11 / 13);
    ema26 = ema26 === null ? candle.close : candle.close * (2 / 27) + ema26 * (25 / 27);
    ema20 = ema20 === null ? candle.close : candle.close * (2 / 21) + ema20 * (19 / 21);
    const macd = ema12 - ema26;
    signal = signal === null ? macd : macd * (2 / 10) + signal * (8 / 10);
    const volume = candle.volume ?? 0;
    cumulativePriceVolume += ((candle.high + candle.low + candle.close) / 3) * volume;
    cumulativeVolume += volume;
    const window = candles.slice(Math.max(0, index - 19), index + 1);
    const ma20 = window.reduce((sum, item) => sum + item.close, 0) / window.length;

    return {
      ma20,
      ema20,
      vwap: cumulativeVolume ? cumulativePriceVolume / cumulativeVolume : candle.close,
      macd,
      signal,
      histogram: macd - signal,
    };
  });
}

export default function TradingChart({
  candles,
  ma20,
  ema20,
  vwap,
  macd,
  macdSignal,
  currentPrice,
  takeProfit,
  stopLoss,
  supportPrice,
  resistancePrice,
  mobileHeight = 320,
  desktopHeight = 700,
}: TradingChartProps) {
  const fullData = useMemo(() => candles.slice(-120), [candles]);
  const maxVisible = Math.min(60, fullData.length);
  const minVisible = Math.min(12, Math.max(fullData.length, 1));

  const [visibleCount, setVisibleCount] = useState(maxVisible);
  const [offsetFromEnd, setOffsetFromEnd] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const gestureRef = useRef<GestureState>({
    startX: 0,
    startY: 0,
    startOffset: 0,
    startVisibleCount: maxVisible,
    startDistance: 0,
    lastTapAt: 0,
    axis: null,
  });

  const chartRef = useRef<HTMLDivElement>(null);

  const safeVisibleCount = clamp(
    visibleCount || maxVisible,
    minVisible,
    Math.max(maxVisible, minVisible),
  );

  const maxOffset = Math.max(fullData.length - safeVisibleCount, 0);
  const safeOffset = clamp(offsetFromEnd, 0, maxOffset);

  const endIndex = fullData.length - safeOffset;
  const startIndex = Math.max(endIndex - safeVisibleCount, 0);
  const data = fullData.slice(startIndex, endIndex);

  const resetView = () => {
    setVisibleCount(maxVisible);
    setOffsetFromEnd(0);
    setSelectedIndex(null);
  };

  const panByPixels = (deltaX: number, containerWidth: number) => {
    if (containerWidth <= 0 || data.length <= 1) return;
    const candlesPerPixel = safeVisibleCount / containerWidth;
    const candleShift = Math.round(deltaX * candlesPerPixel);
    setOffsetFromEnd(
      clamp(
        gestureRef.current.startOffset + candleShift,
        0,
        Math.max(fullData.length - safeVisibleCount, 0),
      ),
    );
  };

  const zoomTo = (nextVisible: number) => {
    const normalized = clamp(
      Math.round(nextVisible),
      minVisible,
      Math.max(maxVisible, minVisible),
    );

    setVisibleCount(normalized);
    setOffsetFromEnd((current) =>
      clamp(current, 0, Math.max(fullData.length - normalized, 0)),
    );
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey) {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 1.12 : 0.88;
      zoomTo(safeVisibleCount * factor);
      return;
    }

    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

    event.preventDefault();

    setOffsetFromEnd((current) =>
      clamp(
        current + Math.round(event.deltaX / 18),
        0,
        Math.max(fullData.length - safeVisibleCount, 0),
      ),
    );
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    gestureRef.current.startX = event.clientX;
    gestureRef.current.startOffset = safeOffset;
    setDragging(true);
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (dragging) {
      panByPixels(gestureRef.current.startX - event.clientX, rect.width);
      return;
    }

    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const index = Math.round((x / rect.width) * Math.max(data.length - 1, 0));
    setSelectedIndex(index);
  };

  const handleMouseUp = () => setDragging(false);
  const handleMouseLeave = () => {
    setDragging(false);
    setSelectedIndex(null);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const now = Date.now();

    if (event.touches.length === 1) {
      if (now - gestureRef.current.lastTapAt < 280) {
        resetView();
      }

      gestureRef.current.lastTapAt = now;
      gestureRef.current.startX = event.touches[0].clientX;
      gestureRef.current.startY = event.touches[0].clientY;
      gestureRef.current.startOffset = safeOffset;
      gestureRef.current.axis = null;
      setDragging(true);
    }

    if (event.touches.length === 2) {
      gestureRef.current.startDistance = touchDistance(event.touches);
      gestureRef.current.startVisibleCount = safeVisibleCount;
      setDragging(false);
    }
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (event.touches.length === 2) {
      event.preventDefault();
      const distance = touchDistance(event.touches);
      const startDistance = Math.max(gestureRef.current.startDistance, 1);
      const scale = distance / startDistance;

      zoomTo(gestureRef.current.startVisibleCount / scale);
      return;
    }

    if (event.touches.length === 1) {
      const deltaX = gestureRef.current.startX - event.touches[0].clientX;
      const deltaY = gestureRef.current.startY - event.touches[0].clientY;

      if (gestureRef.current.axis === null) {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return;
        gestureRef.current.axis =
          Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }

      if (gestureRef.current.axis === "vertical") {
        setDragging(false);
        setSelectedIndex(null);
        return;
      }

      event.preventDefault();
      panByPixels(deltaX, rect.width);

      const x = clamp(event.touches[0].clientX - rect.left, 0, rect.width);
      const index = Math.round((x / rect.width) * Math.max(data.length - 1, 0));
      setSelectedIndex(index);
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
    gestureRef.current.axis = null;
    window.setTimeout(() => setSelectedIndex(null), 900);
  };

  if (!fullData.length) {
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
    const chartRight = isDesktop ? 1035 : 275;
    const labelLeft = isDesktop ? 1060 : 281;
    const labelRight = isDesktop ? 1255 : 356;
    const paddingTop = isDesktop ? 48 : 38;
    const paddingBottom = isDesktop ? 174 : 110;
    const indicators = indicatorSeries(data);

    const candlePrices = data.flatMap((candle) => [
      candle.high,
      candle.low,
      candle.open,
      candle.close,
    ]);

    const allPrices = [...candlePrices, ...levels.map((level) => level.price)];
    const globalMin = Math.min(...allPrices);
    const globalMax = Math.max(...allPrices);

    const candleMin = Math.min(...candlePrices);
    const candleMax = Math.max(...candlePrices);
    const candleRange = Math.max(candleMax - candleMin, 1);

    const center = currentPrice ?? (candleMin + candleMax) / 2;
    const minimumFocusRange = Math.max(center * 0.018, 12);
    const focusRange = Math.max(candleRange * 1.35, minimumFocusRange);

    const focusMin = Math.min(
      candleMin - candleRange * 0.12,
      center - focusRange / 2,
    );
    const focusMax = Math.max(
      candleMax + candleRange * 0.12,
      center + focusRange / 2,
    );

    const plotTop = paddingTop;
    const plotBottom = height - paddingBottom;
    const plotHeight = plotBottom - plotTop;
    const macdTop = plotBottom + (isDesktop ? 40 : 20);
    const macdBottom = height - (isDesktop ? 28 : 38);
    const macdValues = indicators.flatMap((item) => [item.macd, item.signal, item.histogram]);
    const macdAbs = Math.max(...macdValues.map(Math.abs), 1);
    const macdY = (value: number) => macdTop + ((macdAbs - value) / (macdAbs * 2)) * (macdBottom - macdTop);
    const x = (index: number) => chartLeft + (index / Math.max(data.length - 1, 1)) * (chartRight - chartLeft);
    const pathFor = (values: number[], mapY: (value: number) => number) =>
      values.map((value, index) => `${index ? "L" : "M"} ${x(index)} ${mapY(value)}`).join(" ");

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

    const selected =
      selectedIndex !== null && data[selectedIndex]
        ? data[selectedIndex]
        : null;

    const selectedX =
      selectedIndex !== null
        ? chartLeft +
          (selectedIndex / Math.max(data.length - 1, 1)) *
            (chartRight - chartLeft)
        : null;
    const timeTickIndexes = Array.from({ length: 5 }, (_, index) =>
      Math.round((index / 4) * Math.max(data.length - 1, 0)),
    );

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full select-none"
        role="img"
        aria-label="操作可能な株価チャート"
      >
        <rect
          x={chartLeft}
          y={paddingTop}
          width={chartRight - chartLeft}
          height={plotHeight}
          rx={isDesktop ? 22 : 16}
          className="fill-slate-50 dark:fill-slate-950"
        />

        <text x={chartLeft} y={isDesktop ? 26 : 18} fontSize={isDesktop ? 15 : 9} fontWeight="800" fill="#10b981">
          MA20 {ma20 === null ? "-" : Math.round(ma20).toLocaleString()}
        </text>
        <text x={chartLeft + (isDesktop ? 165 : 70)} y={isDesktop ? 26 : 18} fontSize={isDesktop ? 15 : 9} fontWeight="800" fill="#f97316">
          EMA20 {ema20 === null ? "-" : Math.round(ema20).toLocaleString()}
        </text>
        <text x={chartLeft + (isDesktop ? 345 : 148)} y={isDesktop ? 26 : 18} fontSize={isDesktop ? 15 : 9} fontWeight="800" fill="#2563eb">
          VWAP {vwap === null ? "-" : Math.round(vwap).toLocaleString()}
        </text>

        {Array.from({ length: isDesktop ? 6 : 4 }, (_, index) => {
          const price =
            focusMin + ((focusMax - focusMin) * index) / (isDesktop ? 5 : 3);

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

        <path d={pathFor(indicators.map((item) => item.ma20), y)} fill="none" stroke="#10b981" strokeWidth={isDesktop ? 2.3 : 1.4} />
        <path d={pathFor(indicators.map((item) => item.ema20), y)} fill="none" stroke="#f97316" strokeWidth={isDesktop ? 2.3 : 1.4} />
        <path d={pathFor(indicators.map((item) => item.vwap), y)} fill="none" stroke="#2563eb" strokeWidth={isDesktop ? 2.3 : 1.4} />

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

        <line x1={chartLeft} x2={chartRight} y1={macdY(0)} y2={macdY(0)} stroke="#cbd5e1" strokeWidth="1" />
        <text x={chartLeft} y={macdTop - (isDesktop ? 12 : 8)} fontSize={isDesktop ? 14 : 9} fontWeight="800" fill="#475569">
          MACD {macd === null ? "-" : macd.toFixed(2)} / Signal {macdSignal === null ? "-" : macdSignal.toFixed(2)}
        </text>
        {indicators.map((item, index) => {
          const barTop = Math.min(macdY(item.histogram), macdY(0));
          return <rect key={`macd-bar-${index}`} x={x(index) - Math.max(candleWidth * 0.35, 1)} y={barTop} width={Math.max(candleWidth * 0.7, 2)} height={Math.max(Math.abs(macdY(item.histogram) - macdY(0)), 1)} fill={item.histogram >= 0 ? "#10b981" : "#fb7185"} opacity="0.75" />;
        })}
        <path d={pathFor(indicators.map((item) => item.macd), macdY)} fill="none" stroke="#2563eb" strokeWidth={isDesktop ? 2 : 1.2} />
        <path d={pathFor(indicators.map((item) => item.signal), macdY)} fill="none" stroke="#ef4444" strokeWidth={isDesktop ? 2 : 1.2} />

        {selected && selectedX !== null && (
          <g>
            <line
              x1={selectedX}
              x2={selectedX}
              y1={paddingTop}
              y2={plotBottom}
              stroke="#334155"
              strokeDasharray="4 4"
              strokeWidth={isDesktop ? 1.4 : 1}
            />
            <line
              x1={chartLeft}
              x2={chartRight}
              y1={y(selected.close)}
              y2={y(selected.close)}
              stroke="#334155"
              strokeDasharray="4 4"
              strokeWidth={isDesktop ? 1.4 : 1}
            />
            <circle
              cx={selectedX}
              cy={y(selected.close)}
              r={isDesktop ? 5 : 3.5}
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        )}

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
          if (isDesktop) {
            if (index % 12 !== 0 && index !== data.length - 1) return null;
          } else if (!timeTickIndexes.includes(index)) {
            return null;
          }

          const x =
            chartLeft +
            (index / Math.max(data.length - 1, 1)) *
              (chartRight - chartLeft);

          return (
            <text
              key={`time-${candle.time}`}
              x={x}
              y={height - (isDesktop ? 18 : 12)}
              textAnchor="middle"
              fontSize={isDesktop ? 13 : 8.5}
              fill="#64748b"
              fontWeight="700"
            >
              {timeLabel(candle.time)}
            </text>
          );
        })}

        {selected && (
          <g>
            <rect
              x={isDesktop ? 88 : 45}
              y={isDesktop ? 45 : 34}
              width={isDesktop ? 300 : 176}
              height={isDesktop ? 116 : 88}
              rx={isDesktop ? 16 : 12}
              fill="#0f172a"
              opacity="0.95"
            />
            <text
              x={isDesktop ? 108 : 56}
              y={isDesktop ? 72 : 53}
              fontSize={isDesktop ? 16 : 9}
              fill="#ffffff"
              fontWeight="800"
            >
              {dateTimeLabel(selected.time)}
            </text>
            <text
              x={isDesktop ? 108 : 56}
              y={isDesktop ? 98 : 70}
              fontSize={isDesktop ? 14 : 8}
              fill="#cbd5e1"
              fontWeight="700"
            >
              始 {selected.open.toLocaleString()}　高 {selected.high.toLocaleString()}
            </text>
            <text
              x={isDesktop ? 108 : 56}
              y={isDesktop ? 122 : 85}
              fontSize={isDesktop ? 14 : 8}
              fill="#cbd5e1"
              fontWeight="700"
            >
              安 {selected.low.toLocaleString()}　終 {selected.close.toLocaleString()}
            </text>
            <text
              x={isDesktop ? 108 : 56}
              y={isDesktop ? 146 : 100}
              fontSize={isDesktop ? 14 : 8}
              fill="#93c5fd"
              fontWeight="700"
            >
              出来高 {(selected.volume ?? 0).toLocaleString()}
            </text>
          </g>
        )}
      </svg>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex h-[30px] items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-2 dark:border-slate-800 dark:bg-slate-800/60">
        <p className="flex min-w-0 items-center gap-1 text-[12px] font-bold text-slate-500 dark:text-slate-400 sm:text-[13px]">
          <span className="text-[11px]" aria-hidden>↔</span>
          <span className="truncate">ピンチで拡大・左右スワイプ</span>
        </p>
        <button
          type="button"
          onClick={resetView}
          aria-label="全体表示"
          title="全体表示"
          className="flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-black text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <span className="text-[13px] leading-none" aria-hidden>⛶</span>
          <span>全体表示</span>
        </button>
      </div>

      <div
        ref={chartRef}
        className={`relative cursor-crosshair select-none ${
          dragging ? "cursor-grabbing" : ""
        }`}
        style={{ touchAction: "pan-y" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={resetView}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="h-[320px] w-full md:hidden">{renderChart(false)}</div>
        <div className="hidden h-[700px] w-full md:block">
          {renderChart(true)}
        </div>
      </div>
    </div>
  );
}
