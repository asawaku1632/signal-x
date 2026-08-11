"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Payload = {
  summary: { total: number; today: number; lower: number; upper: number };
  bonusCounts: Array<{ bb_bonus: number; count: number }>;
  evaluatedCounts: Array<{ horizon: number; count: number }>;
  performance: Array<{
    bb_bonus: number;
    horizon: number;
    count: number;
    average_return: number;
    directional_rate: number;
  }>;
};

export default function BbObservationPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/bb-observation", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "取得に失敗しました");
        setData(payload);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "取得に失敗しました"));
  }, []);

  const countForHorizon = (horizon: number) =>
    data?.evaluatedCounts.find((item) => Number(item.horizon) === horizon)?.count ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link href="/admin/learning-status" className="text-sm font-bold text-blue-600">← 学習監視</Link>
          <p className="mt-4 text-xs font-black tracking-[0.16em] text-blue-600">ADMIN OBSERVATION</p>
          <h1 className="mt-2 text-3xl font-black">BB観察状況</h1>
          <p className="mt-2 text-sm text-slate-500">保存結果は観察専用で、AI POWERやbbBonusを自動変更しません。</p>
        </header>

        {error && <p className="mt-5 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</p>}
        {!data && !error && <p className="mt-5 rounded-2xl bg-white p-6 text-slate-500">読み込み中...</p>}

        {data && (
          <>
            <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="総イベント" value={data.summary.total} />
              <Metric label="本日イベント" value={data.summary.today} />
              <Metric label="LOWER" value={data.summary.lower} />
              <Metric label="UPPER" value={data.summary.upper} />
            </section>
            <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">評価進捗</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[1, 5, 10, 20].map((horizon) => (
                  <Metric key={horizon} label={`${horizon}営業日評価済み`} value={countForHorizon(horizon)} />
                ))}
              </div>
            </section>
            <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">bbBonus別</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.bonusCounts.map((item) => (
                  <span key={item.bb_bonus} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold">
                    {Number(item.bb_bonus) > 0 ? "+" : ""}{item.bb_bonus}：{item.count}件
                  </span>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead><tr className="border-b text-left text-slate-500"><th className="p-2">補正</th><th className="p-2">期間</th><th className="p-2">件数</th><th className="p-2">平均騰落率</th><th className="p-2">方向一致率（参考）</th></tr></thead>
                  <tbody>{data.performance.filter((item) => [5, 10, 20].includes(Number(item.horizon))).map((item) => (
                    <tr key={`${item.bb_bonus}-${item.horizon}`} className="border-b border-slate-100">
                      <td className="p-2 font-black">{Number(item.bb_bonus) > 0 ? "+" : ""}{item.bb_bonus}</td>
                      <td className="p-2">{item.horizon}営業日</td>
                      <td className="p-2">{item.count}</td>
                      <td className="p-2">{Number(item.average_return).toFixed(2)}%</td>
                      <td className="p-2">{Number(item.directional_rate).toFixed(1)}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500">方向一致率は0%基準の参考集計で、WIN/LOSEとして保存していません。</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{Number(value).toLocaleString()}</p></div>;
}
