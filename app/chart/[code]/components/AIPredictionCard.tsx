"use client";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type AIPredictionCardProps = {
  currentPrice: number;
  aiPower: number;
  trend: string;
  ma20: number | null;
  ema20: number | null;
  vwap: number | null;
  macdHistogram: number | null;
  rsi?: number;
  volumeRatio?: number;
  breakoutExpectation: number;
  resistancePrice: number | null;
  supportPrice: number | null;
  candles: Candle[];
  takeProfit: number;
  stopLoss: number;
  takeProfitMoney: number;
  stopLossMoney: number;
  requiredMoney: number;
};

type Scenario = {
  key: "up" | "side" | "down";
  label: string;
  probability: number;
  prices: number[];
  stroke: string;
  fill: string;
  text: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundPrice(value: number) {
  return Math.max(1, Math.round(value * 10) / 10);
}

function yen(value: number) {
  return `${Math.round(value).toLocaleString()}円`;
}

function getVolatility(candles: Candle[], currentPrice: number) {
  const recent = candles.slice(-20);
  if (recent.length < 3 || currentPrice <= 0) return 0.006;

  const returns: number[] = [];
  for (let index = 1; index < recent.length; index++) {
    const previous = recent[index - 1].close;
    const current = recent[index].close;
    if (previous > 0) returns.push((current - previous) / previous);
  }

  if (returns.length === 0) return 0.006;

  const mean = returns.reduce((total, value) => total + value, 0) / returns.length;
  const variance =
    returns.reduce((total, value) => total + Math.pow(value - mean, 2), 0) /
    returns.length;

  return clamp(Math.sqrt(variance), 0.0035, 0.02);
}

function normalizeProbabilities(up: number, side: number, down: number) {
  const safeUp = Math.max(5, up);
  const safeSide = Math.max(5, side);
  const safeDown = Math.max(5, down);
  const total = safeUp + safeSide + safeDown;

  const normalizedUp = Math.round((safeUp / total) * 100);
  const normalizedDown = Math.round((safeDown / total) * 100);

  return {
    up: normalizedUp,
    side: 100 - normalizedUp - normalizedDown,
    down: normalizedDown,
  };
}

function buildScenarioPrices({
  currentPrice,
  volatility,
  upProbability,
  downProbability,
  resistancePrice,
  supportPrice,
}: {
  currentPrice: number;
  volatility: number;
  upProbability: number;
  downProbability: number;
  resistancePrice: number | null;
  supportPrice: number | null;
}) {
  const steps = [0.35, 0.62, 0.88, 1.15, 1.45];
  const upStrength = 0.7 + upProbability / 100;
  const downStrength = 0.65 + downProbability / 100;

  const upward = steps.map((step, index) => {
    const wave = index % 2 === 0 ? 1 : 0.88;
    let value = currentPrice * (1 + volatility * step * upStrength * wave);

    if (resistancePrice !== null && value > resistancePrice) {
      value =
        index >= 3
          ? resistancePrice +
            (value - resistancePrice) * (upProbability >= 60 ? 0.55 : 0.2)
          : Math.min(value, resistancePrice);
    }

    return roundPrice(value);
  });

  const sideways = steps.map((step, index) => {
    const direction = index % 2 === 0 ? 1 : -0.72;
    return roundPrice(currentPrice * (1 + volatility * 0.2 * step * direction));
  });

  const downward = steps.map((step, index) => {
    const wave = index % 2 === 0 ? 1 : 0.9;
    let value = currentPrice * (1 - volatility * step * downStrength * wave);

    if (supportPrice !== null && value < supportPrice) {
      value =
        index >= 3
          ? supportPrice -
            (supportPrice - value) * (downProbability >= 50 ? 0.45 : 0.18)
          : Math.max(value, supportPrice);
    }

    return roundPrice(value);
  });

  return { upward, sideways, downward };
}

function buildReasons(props: AIPredictionCardProps) {
  const reasons: string[] = [];

  if (props.trend === "UPTREND") reasons.push("上昇トレンド");
  else if (props.trend === "DOWNTREND") reasons.push("下降トレンド");
  else reasons.push("方向感は中立");

  if (props.ma20 !== null) {
    reasons.push(
      props.currentPrice >= props.ma20
        ? "現在値がMA20より上"
        : "現在値がMA20より下",
    );
  }

  if (props.ema20 !== null) {
    reasons.push(
      props.currentPrice >= props.ema20
        ? "現在値がEMA20より上"
        : "現在値がEMA20より下",
    );
  }

  if (props.vwap !== null) {
    reasons.push(
      props.currentPrice >= props.vwap
        ? "現在値がVWAPより上"
        : "現在値がVWAPより下",
    );
  }

  if (props.macdHistogram !== null) {
    reasons.push(
      props.macdHistogram > 0
        ? "MACDモメンタムはプラス"
        : "MACDモメンタムはマイナス",
    );
  }

  if (typeof props.rsi === "number") {
    if (props.rsi >= 70) reasons.push(`RSI${Math.round(props.rsi)}で過熱気味`);
    else if (props.rsi <= 30)
      reasons.push(`RSI${Math.round(props.rsi)}で売られ過ぎ`);
    else reasons.push(`RSI${Math.round(props.rsi)}で中立圏`);
  }

  if (typeof props.volumeRatio === "number" && props.volumeRatio >= 1.5) {
    reasons.push(`出来高${props.volumeRatio.toFixed(2)}倍`);
  }

  reasons.push(`AI POWER ${Math.round(props.aiPower)}`);
  reasons.push(`ブレイク期待度 ${Math.round(props.breakoutExpectation)}%`);

  return reasons.slice(0, 6);
}


function getActionLabel(up: number, side: number, down: number) {
  if (up >= 65) return "買い継続";
  if (up >= 50) return "押し目待ち";
  if (down >= 50) return "見送り";
  if (side >= 45) return "様子見";
  return "慎重に監視";
}

function getActionTone(action: string) {
  if (action === "買い継続") return { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", icon: "🟢" };
  if (action === "押し目待ち") return { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", icon: "🔵" };
  if (action === "見送り") return { border: "border-red-200", bg: "bg-red-50", text: "text-red-700", icon: "🔴" };
  return { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700", icon: "🟡" };
}

function getStarRating(value: number) {
  const stars = clamp(Math.round(value / 20), 1, 5);
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

function probabilityBarClass(tone: "profit" | "loss") {
  return tone === "profit" ? "bg-emerald-500" : "bg-red-500";
}

export default function AIPredictionCard(props: AIPredictionCardProps) {
  let upScore = 38;
  let downScore = 27;
  let sideScore = 35;

  if (props.trend === "UPTREND") {
    upScore += 18;
    downScore -= 8;
    sideScore -= 4;
  } else if (props.trend === "DOWNTREND") {
    downScore += 18;
    upScore -= 8;
    sideScore -= 4;
  }

  if (props.ma20 !== null) {
    if (props.currentPrice >= props.ma20) upScore += 7;
    else downScore += 7;
  }

  if (props.ema20 !== null) {
    if (props.currentPrice >= props.ema20) upScore += 6;
    else downScore += 6;
  }

  if (props.vwap !== null) {
    if (props.currentPrice >= props.vwap) upScore += 6;
    else downScore += 6;
  }

  if (props.macdHistogram !== null) {
    if (props.macdHistogram > 0) upScore += 8;
    else if (props.macdHistogram < 0) downScore += 8;
  }

  if (typeof props.rsi === "number") {
    if (props.rsi >= 72) {
      downScore += 7;
      upScore -= 3;
    } else if (props.rsi <= 30) {
      upScore += 7;
      downScore -= 3;
    } else {
      sideScore += 3;
    }
  }

  if (typeof props.volumeRatio === "number") {
    if (props.volumeRatio >= 1.5 && props.trend === "UPTREND") upScore += 7;
    if (props.volumeRatio >= 1.5 && props.trend === "DOWNTREND") downScore += 7;
  }

  upScore += Math.round((props.aiPower - 50) * 0.18);
  upScore += Math.round((props.breakoutExpectation - 50) * 0.22);

  if (props.breakoutExpectation < 45) sideScore += 8;

  const probabilities = normalizeProbabilities(upScore, sideScore, downScore);
  const volatility = getVolatility(props.candles, props.currentPrice);
  const paths = buildScenarioPrices({
    currentPrice: props.currentPrice,
    volatility,
    upProbability: probabilities.up,
    downProbability: probabilities.down,
    resistancePrice: props.resistancePrice,
    supportPrice: props.supportPrice,
  });

  const scenarios: Scenario[] = [
    {
      key: "up",
      label: "上昇シナリオ",
      probability: probabilities.up,
      prices: paths.upward,
      stroke: "#16a34a",
      fill: "#dcfce7",
      text: "#166534",
    },
    {
      key: "side",
      label: "横ばいシナリオ",
      probability: probabilities.side,
      prices: paths.sideways,
      stroke: "#d97706",
      fill: "#fef3c7",
      text: "#92400e",
    },
    {
      key: "down",
      label: "下落シナリオ",
      probability: probabilities.down,
      prices: paths.downward,
      stroke: "#dc2626",
      fill: "#fee2e2",
      text: "#991b1b",
    },
  ];

  const allPrices = [
    props.currentPrice,
    ...scenarios.flatMap((scenario) => scenario.prices),
  ];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = Math.max(
    (maxPrice - minPrice) * 0.15,
    props.currentPrice * 0.004,
  );
  const chartMin = minPrice - padding;
  const chartMax = maxPrice + padding;

  const width = 640;
  const height = 300;
  const left = 70;
  const right = 610;
  const top = 24;
  const bottom = 250;
  const x = (index: number) => left + (index / 5) * (right - left);
  const y = (price: number) =>
    bottom -
    ((price - chartMin) / Math.max(chartMax - chartMin, 0.0001)) *
      (bottom - top);

  const strongest = [...scenarios].sort(
    (a, b) => b.probability - a.probability,
  )[0];
  const reasons = buildReasons(props);

  const confidence = clamp(
    Math.round(
      props.aiPower * 0.42 +
        props.breakoutExpectation * 0.33 +
        probabilities.up * 0.25,
    ),
    35,
    95,
  );

  const takeProfitDistance = Math.max(
    ((props.takeProfit - props.currentPrice) / Math.max(props.currentPrice, 1)) * 100,
    0,
  );
  const stopLossDistance = Math.max(
    ((props.currentPrice - props.stopLoss) / Math.max(props.currentPrice, 1)) * 100,
    0,
  );

  const takeProfitProbability = clamp(
    Math.round(
      probabilities.up * 0.72 +
        props.breakoutExpectation * 0.2 +
        props.aiPower * 0.08 -
        takeProfitDistance * 4.5,
    ),
    5,
    95,
  );

  const stopLossProbability = clamp(
    Math.round(
      probabilities.down * 0.72 +
        (100 - props.breakoutExpectation) * 0.18 +
        (100 - props.aiPower) * 0.1 -
        stopLossDistance * 2.5,
    ),
    3,
    90,
  );

  const action = getActionLabel(probabilities.up, probabilities.side, probabilities.down);
  const actionTone = getActionTone(action);
  const expectation = clamp(
    Math.round((takeProfitProbability + confidence + props.breakoutExpectation - stopLossProbability) / 3),
    20,
    95,
  );

  const ma20TouchProbability = props.ma20 === null
    ? 0
    : clamp(
        Math.round(76 - (Math.abs(props.currentPrice - props.ma20) / Math.max(props.currentPrice, 1)) * 900),
        10,
        92,
      );

  const resistanceBreakProbability = props.resistancePrice === null
    ? props.breakoutExpectation
    : clamp(
        Math.round(
          props.breakoutExpectation -
            Math.max(((props.resistancePrice - props.currentPrice) / Math.max(props.currentPrice, 1)) * 100, 0) * 2,
        ),
        5,
        95,
      );

  const futureHigh = Math.max(...paths.upward);
  const futureLow = Math.min(...paths.downward);

  const storyParts = [
    `現在は${props.trend === "UPTREND" ? "上昇トレンド" : props.trend === "DOWNTREND" ? "下降トレンド" : "横ばい"}です。`,
    props.macdHistogram !== null ? `MACDモメンタムは${props.macdHistogram >= 0 ? "プラス" : "マイナス"}です。` : "",
    props.vwap !== null ? `現在値はVWAPより${props.currentPrice >= props.vwap ? "上" : "下"}にあります。` : "",
    `次の5本では${yen(futureLow)}〜${yen(futureHigh)}の範囲を試すシナリオを想定しています。`,
    props.resistancePrice !== null ? `${yen(props.resistancePrice)}を突破すると、上昇加速シナリオへ移行する可能性があります。` : "",
  ].filter(Boolean);

  return (
    <section className="rounded-[28px] border border-indigo-200 bg-gradient-to-br from-white via-indigo-50 to-blue-50 p-4 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-indigo-600">
            AI FUTURE SCENARIO
          </p>
          <h2 className="mt-1 text-3xl font-black text-slate-950">
            🤖 AI未来予測
          </h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            現在の指標と直近の値動きから、次の5本を3つのシナリオで可視化します。
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-white px-3 py-2 text-right shadow-sm">
          <p className="text-[10px] font-black tracking-widest text-slate-400">
            MAIN
          </p>
          <p className="text-lg font-black" style={{ color: strongest.stroke }}>
            {strongest.label}
          </p>
          <p className="text-3xl font-black" style={{ color: strongest.stroke }}>
            {strongest.probability}%
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {scenarios.map((scenario) => (
          <div
            key={scenario.key}
            className="rounded-2xl border p-3 text-center"
            style={{
              backgroundColor: scenario.fill,
              borderColor: scenario.stroke,
              color: scenario.text,
            }}
          >
            <p className="text-xs font-black">{scenario.label}</p>
            <p className="mt-1 text-3xl font-black">
              {scenario.probability}%
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label="AI未来予測シナリオチャート"
        >
          <rect
            x={left}
            y={top}
            width={right - left}
            height={bottom - top}
            rx="18"
            fill="#f8fafc"
          />

          {[0, 1, 2, 3, 4].map((index) => {
            const price = chartMin + ((chartMax - chartMin) * index) / 4;
            return (
              <g key={index}>
                <line
                  x1={left}
                  x2={right}
                  y1={y(price)}
                  y2={y(price)}
                  stroke="#e2e8f0"
                  strokeDasharray="4 6"
                />
                <text
                  x="8"
                  y={y(price) + 5}
                  fontSize="13"
                  fontWeight="700"
                  fill="#64748b"
                >
                  {Math.round(price).toLocaleString()}
                </text>
              </g>
            );
          })}

          <line
            x1={left}
            x2={right}
            y1={y(props.currentPrice)}
            y2={y(props.currentPrice)}
            stroke="#2563eb"
            strokeWidth="3"
          />
          <circle
            cx={x(0)}
            cy={y(props.currentPrice)}
            r="7"
            fill="#2563eb"
            stroke="#ffffff"
            strokeWidth="3"
          />
          <text
            x={left + 12}
            y={y(props.currentPrice) - 10}
            fontSize="13"
            fontWeight="900"
            fill="#2563eb"
          >
            現在 {yen(props.currentPrice)}
          </text>

          {scenarios.map((scenario) => {
            const points = [
              `${x(0)},${y(props.currentPrice)}`,
              ...scenario.prices.map(
                (price, index) => `${x(index + 1)},${y(price)}`,
              ),
            ].join(" ");

            return (
              <g key={scenario.key}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={scenario.stroke}
                  strokeWidth="4"
                  strokeDasharray={
                    scenario.key === "up"
                      ? "10 6"
                      : scenario.key === "side"
                        ? "6 6"
                        : "3 7"
                  }
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {scenario.prices.map((price, index) => (
                  <circle
                    key={`${scenario.key}-${index}`}
                    cx={x(index + 1)}
                    cy={y(price)}
                    r="4"
                    fill={scenario.stroke}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                ))}

                <text
                  x={right - 4}
                  y={y(scenario.prices[scenario.prices.length - 1]) - 8}
                  textAnchor="end"
                  fontSize="13"
                  fontWeight="900"
                  fill={scenario.stroke}
                >
                  {yen(scenario.prices[scenario.prices.length - 1])}
                </text>
              </g>
            );
          })}

          {["現在", "予測1", "予測2", "予測3", "予測4", "予測5"].map(
            (label, index) => (
              <text
                key={label}
                x={x(index)}
                y="279"
                textAnchor="middle"
                fontSize="12"
                fontWeight="800"
                fill="#64748b"
              >
                {label}
              </text>
            ),
          )}
        </svg>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <section className={`rounded-[24px] border p-5 ${actionTone.border} ${actionTone.bg}`}>
          <p className="text-xs font-black tracking-[0.18em] text-slate-500">AI FINAL JUDGEMENT</p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <p className={`text-2xl font-black ${actionTone.text}`}>{actionTone.icon} AI最終判断</p>
              <p className="mt-2 text-4xl font-black text-slate-950">{action}</p>
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-3 text-right shadow-sm">
              <p className="text-[10px] font-black text-slate-400">信頼度</p>
              <p className={`text-3xl font-black ${actionTone.text}`}>{confidence}%</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/80 p-4 text-center shadow-sm">
              <p className="text-xs font-black text-slate-500">AI推奨度</p>
              <p className="mt-1 text-xl font-black text-amber-500">{getStarRating(expectation)}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4 text-center shadow-sm">
              <p className="text-xs font-black text-slate-500">期待値</p>
              <p className={`mt-1 text-3xl font-black ${actionTone.text}`}>{expectation}%</p>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5">
          <p className="text-xs font-black tracking-[0.18em] text-blue-600">TARGET SIMULATION</p>
          <h3 className="mt-2 text-2xl font-black">🎯 到達確率</h3>
          <ProbabilityRow label="利確到達" probability={takeProfitProbability} price={props.takeProfit} money={props.takeProfitMoney} tone="profit" />
          <ProbabilityRow label="損切到達" probability={stopLossProbability} price={props.stopLoss} money={props.stopLossMoney} tone="loss" />
          <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-xs font-black text-slate-500">必要資金</p>
            <p className="mt-1 text-xl font-black text-slate-900">{yen(props.requiredMoney)}</p>
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5">
        <p className="text-xs font-black tracking-[0.18em] text-violet-600">NEXT EVENTS</p>
        <h3 className="mt-2 text-2xl font-black">📅 次に起こりそうなイベント</h3>
        <div className="mt-4 space-y-3">
          <EventRow label="MA20タッチ" probability={ma20TouchProbability} />
          <EventRow label="抵抗線突破" probability={resistanceBreakProbability} />
          <EventRow label="利確到達" probability={takeProfitProbability} />
          <EventRow label="損切到達" probability={stopLossProbability} />
        </div>
      </section>

      <section className="mt-5 rounded-[24px] border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
        <p className="text-xs font-black tracking-[0.18em] text-blue-600">AI STORY</p>
        <h3 className="mt-2 text-2xl font-black">🧠 AIストーリー</h3>
        <div className="mt-4 space-y-2">
          {storyParts.map((part) => (
            <p key={part} className="text-sm font-bold leading-7 text-slate-700">{part}</p>
          ))}
        </div>
      </section>

      <div className="mt-5 rounded-[22px] border border-slate-200 bg-white p-4">
        <p className="text-sm font-black text-slate-900">予測根拠</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {reasons.map((reason) => (
            <span
              key={reason}
              className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"
            >
              {reason}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-black text-amber-900">ご利用前の注意</p>
        <p className="mt-2 text-xs font-bold leading-6 text-amber-800">
          この表示は、現在のテクニカル指標と過去データをもとに算出した参考シナリオです。
          将来の株価や利益を保証するものではありません。最終的な投資判断はご自身の責任で行ってください。
        </p>
      </div>
    </section>
  );
}

function ProbabilityRow({ label, probability, price, money, tone }: { label: string; probability: number; price: number; money: number; tone: "profit" | "loss"; }) {
  return (
    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-700">{label}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{yen(price)} / 100株 {money >= 0 ? "+" : ""}{yen(money)}</p>
        </div>
        <p className={`text-3xl font-black ${tone === "profit" ? "text-emerald-600" : "text-red-500"}`}>{probability}%</p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${probabilityBarClass(tone)}`} style={{ width: `${probability}%` }} />
      </div>
    </div>
  );
}

function EventRow({ label, probability }: { label: string; probability: number; }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-slate-700">{label}</p>
          <p className="text-lg font-black text-violet-600">{probability}%</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-violet-500" style={{ width: `${probability}%` }} />
        </div>
      </div>
    </div>
  );
}
