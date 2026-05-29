"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const chartData = [
  { time: "09:00", price: 3200 },
  { time: "09:30", price: 3210 },
  { time: "10:00", price: 3195 },
  { time: "10:30", price: 3230 },
  { time: "11:00", price: 3250 },
  { time: "12:30", price: 3270 },
  { time: "13:00", price: 3260 },
  { time: "14:00", price: 3290 },
  { time: "15:00", price: 3310 },
];

type Stock = {
  code: string;
  name: string;
  price: number;
  changeRate: number;
};

export default function ChartPage() {
  const params = useParams();
  const code = String(params.code);

  const [stock, setStock] = useState<Stock | null>(null);

  useEffect(() => {
    fetch("/api/scan")
      .then((res) => res.json())
      .then((data) => {
        const found = data.find((s: Stock) => s.code === code);
        setStock(found ?? null);
      });
  }, [code]);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">SIGNALX チャート分析</h1>

        <p className="text-gray-400 mb-6">銘柄コード: {code}</p>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              {stock ? stock.name : "読み込み中..."}
            </h2>

            <p
              className={`text-xl font-bold ${
                stock && stock.changeRate >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {stock
                ? `${stock.price.toLocaleString()}円 (${stock.changeRate}%)`
                : "---"}
            </p>
          </div>

          <div style={{ width: "100%", height: 400 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid stroke="#333" />
                <XAxis dataKey="time" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#00ff88"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
              </ResponsiveContainer>
</div>
</div>
</div>
</main>
);
}