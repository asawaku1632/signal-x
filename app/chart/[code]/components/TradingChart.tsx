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
  startOffset: number;
  startVisibleCount: number;
  startDistance: number;
  lastTapAt: number;
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
  const fullData = useMemo(() => candles.slice(-120), [candles]);
  const maxVisible = Math.min(60, fullData.length);
  const minVisible = Math.min(12, Math.max(fullData.length, 1));

  const [visibleCount, setVisibleCount] = useState(maxVisible);
  const [offsetFromEnd, setOffsetFromEnd] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const gestureRef = useRef<GestureState>({
    startX: 0,
    startOffset: 0,
    startVisibleCount: maxVisible,
    startDistance: 0,
    lastTapAt: 0,
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
    event.preventDefault();

    if (event.ctrlKey || Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      const factor = event.deltaY > 0 ? 1.12 : 0.88;
      zoomTo(safeVisibleCount * factor);
      return;
    }

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
      gestureRef.current.startOffset = safeOffset;
      setDragging(true);
    }

    if (event.touches.length === 2) {
      gestureRef.current.startDistance = touchDistance(event.touches);
      gestureRef.current.startVisibleCount = safeVisibleCount;
      setDragging(false);
    }
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    event.preventDefault();

    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (event.touches.length === 2) {
      const distance = touchDistance(event.touches);
      const startDistance = Math.max(gestureRef.current.startDistance, 1);
      const scale = distance / startDistance;

      zoomTo(gestureRef.current.startVisibleCount / scale);
      return;
    }

    if (event.touches.length === 1) {
      const deltaX = gestureRef.current.startX - event.touches[0].clientX;
      panByPixels(deltaX, rect.width);

      const x = clamp(event.touches[0].clientX - rect.left, 0, rect.width);
      const index = Math.round((x / rect.width) * Math.max(data.length - 1, 0));
      setSelectedIndex(index);
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
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
          height={height - paddingTop - paddingBottom}
          rx={isDesktop ? 22 : 16}
          fill="#f8fafc"
        />

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
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-[11px] font-black text-slate-500">
        <span>🤏 ピンチで拡大・左右スワイプ</span>
        <button
          type="button"
          onClick={resetView}
          className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700"
        >
          全体表示
        </button>
      </div>

      <div
        ref={chartRef}
        className={`relative cursor-crosshair select-none ${
          dragging ? "cursor-grabbing" : ""
        }`}
        style={{ touchAction: "none" }}
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
        <div className="h-[440px] w-full md:hidden">{renderChart(false)}</div>
        <div className="hidden h-[700px] w-full md:block">
          {renderChart(true)}
        </div>
      </div>
    </div>
  );
}