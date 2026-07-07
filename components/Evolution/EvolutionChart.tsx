"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type EvolutionChartItem = {
  id: number;
  qualityScore: number;
  qualityLabel: string;
  judgedRecords: number;
  overallWinRate: number;
  patternCount: number;
  sectorCount: number;
  activeWeightRules: number;
  optimizedCount: number;
  changedCount: number;
  cronStatus: string;
  createdAt: string;
};

type ChartPoint = {
  label: string;
  aiCompletionScore: number;
  predictionAccuracy: number;
  learnedDataCount: number;
  improvedCount: number;
};

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function toChartData(history: EvolutionChartItem[]): ChartPoint[] {
  return [...history]
    .reverse()
    .map((item) => ({
      label: formatDay(item.createdAt),
      aiCompletionScore: item.qualityScore,
      predictionAccuracy: item.overallWinRate,
      learnedDataCount: item.judgedRecords,
      improvedCount: item.changedCount,
    }));
}

export default function EvolutionChart({
  history,
}: {
  history: EvolutionChartItem[];
}) {
  const data = toChartData(history);

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-5 shadow">
        <div className="text-sm text-gray-500">AI成長グラフ</div>
        <div className="mt-2 text-gray-700">まだグラフデータがありません。</div>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-bold">AI成長グラフ</h2>

      <p className="text-sm text-gray-500">
        グラフは1日1件、その日の最新データだけを表示しています。
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MetricChart
          title="AI完成度"
          description="AI全体の学習品質を100点満点で表示します。"
          data={data}
          dataKey="aiCompletionScore"
          suffix="点"
        />

        <MetricChart
          title="予測的中率"
          description="勝敗が確定したデータの的中率です。"
          data={data}
          dataKey="predictionAccuracy"
          suffix="%"
        />

        <MetricChart
          title="学習済みデータ"
          description="AIが結果を確認して学習した件数です。"
          data={data}
          dataKey="learnedDataCount"
          suffix="件"
        />

        <MetricChart
          title="改善した数"
          description="AIが判断基準を見直した数です。"
          data={data}
          dataKey="improvedCount"
          suffix="ヶ所"
        />
      </div>
    </section>
  );
}

function MetricChart({
  title,
  description,
  data,
  dataKey,
  suffix,
}: {
  title: string;
  description: string;
  data: ChartPoint[];
  dataKey: keyof ChartPoint;
  suffix: string;
}) {
  const latestValue = data[data.length - 1]?.[dataKey] ?? "-";

  return (
    <div className="rounded-2xl border bg-white p-5 shadow">
      <div className="mb-4">
        <div className="text-sm font-bold text-gray-500">{title}</div>

        <div className="mt-1 text-2xl font-black">
          {String(latestValue)}
          {suffix}
        </div>

        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} width={45} />
            <Tooltip
              formatter={(value) => [`${value}${suffix}`, title]}
              labelFormatter={(label) => `日付：${label}`}
            />
            <Line
              type="monotone"
              dataKey={dataKey as string}
              strokeWidth={3}
              dot
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
