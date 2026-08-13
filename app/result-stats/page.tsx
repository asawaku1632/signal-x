"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/app/components/BottomNav";
import { getWinRateDisplay } from "@/app/lib/winRateDisplay";

type DashboardData = {
  success: boolean;
  total: number;
  win: number;
  lose: number;
  hold: number;
  pending: number;
  winRate: number | null;
  previousWinRate: number | null;
  diff: number | null;
  growth: number;
  dateCount: number;
  bestStocks: {
    code: string;
    name: string;
    winRate: number;
    total: number;
  }[];
  worstStocks: {
    code: string;
    name: string;
    winRate: number;
    total: number;
  }[];
  winRateTrend: {
    date: string;
    total: number;
    win: number;
    lose: number;
    hold: number;
    pending: number;
    winRate: number | null;
  }[];
  comment: string;
  latestPreviousBusinessDate: string | null;
  latestConfirmedDate: string | null;
  processingDate: string | null;
  updatedAt: string;
};

export default function ResultStatsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await fetch("/api/learning/dashboard", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`learning dashboard api error: ${res.status}`);
        }

        const json = await res.json();

        if (!json?.success) {
          throw new Error("learning dashboard returned success=false");
        }

        setData(json);
      } catch (error) {
        console.error("result stats fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const overallDisplay = useMemo(
    () =>
      data
        ? getWinRateDisplay({
            total: data.total,
            win: data.win,
            lose: data.lose,
            hold: data.hold,
            unknown: data.pending,
          })
        : null,
    [data],
  );

  const judgedCount = data ? data.win + data.lose : 0;

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="flex items-center justify-between mb-4">
          <Link
            href="/dashboard"
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-2xl"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.22em] text-slate-500">
              RESULT STATS
            </div>
          </div>

          <div className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-lg">
            📊
          </div>
        </header>

        {loading && (
          <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="font-bold text-slate-500">
              勝率データを読み込み中...
            </p>
          </section>
        )}

        {!loading && !data && (
          <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="font-bold text-red-500">
              勝率データを取得できませんでした。
            </p>
          </section>
        )}

        {data && (
          <>
            <section className="rounded-[28px] bg-white border border-blue-200 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-black text-blue-600">
                    📊 AI勝率検証
                  </p>
                  <h1 className="mt-2 text-5xl font-black text-blue-600">
                    {overallDisplay?.label ?? "--"}
                  </h1>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    現在のAI実測勝率
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-black text-slate-400">更新</p>
                  <p className="text-lg font-black">
                    {data.updatedAt || "--"}
                  </p>
                </div>
              </div>

              <div className="mt-5 h-4 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{
                    width: `${overallDisplay?.winRate ?? 0}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-sm font-bold leading-7">
                {data.comment ||
                  "AIは現在データ蓄積中です。検証数が増えるほど精度が安定します。"}
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <DateBox label="最新の前営業日" value={data.latestPreviousBusinessDate} />
                <DateBox label="最新の確定済み" value={data.latestConfirmedDate} />
                <DateBox label="判定処理中" value={data.processingDate} pending />
              </div>

              {data.processingDate && (
                <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
                  最新営業日の学習を実行中です。勝率には反映されていません。
                </p>
              )}
            </section>

            <section className="mt-4 rounded-[24px] bg-white border border-slate-200 p-4 shadow-sm">
              <h2 className="text-xl font-black mb-4">📚 検証件数</h2>

              <div className="grid grid-cols-4 gap-2">
                <StatBox label="TOTAL" value={`${data.total}`} color="text-blue-600" />
                <StatBox label="WIN" value={`${data.win}`} color="text-green-600" />
                <StatBox label="LOSE" value={`${data.lose}`} color="text-red-500" />
                <StatBox label="HOLD" value={`${data.hold}`} color="text-slate-900" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <InfoBox label="判定済み" value={`${judgedCount}件`} />
                <InfoBox label="学習日数" value={`${data.dateCount}日`} />
              </div>
            </section>

            <section className="mt-4 rounded-[24px] bg-white border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black">📈 勝率推移</h2>
                <p
                  className={`text-sm font-black ${
                    data.diff === null
                      ? "text-slate-400"
                      : data.diff >= 0
                        ? "text-green-600"
                        : "text-red-500"
                  }`}
                >
                  {data.diff === null
                    ? "--"
                    : `${data.diff >= 0 ? "+" : ""}${data.diff}pt`}
                </p>
              </div>

              <div className="space-y-3">
                {(data.winRateTrend ?? []).map((item) => {
                  const display = getWinRateDisplay({
                    ...item,
                    unknown: item.pending,
                  });

                  return (
                    <div key={item.date}>
                      <div className="mb-1 flex items-start justify-between gap-3 text-xs font-bold">
                        <span>{item.date}</span>
                        <span className="text-right">
                          <span className="block">{display.label}</span>
                          {(display.state === "provisional" ||
                            display.state === "waiting") && (
                            <span className="mt-0.5 block text-[10px] text-amber-600">
                              {display.detail}
                            </span>
                          )}
                        </span>
                      </div>

                      {display.showBar ? (
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              display.state === "provisional"
                                ? "bg-amber-400"
                                : "bg-green-500"
                            }`}
                            style={{ width: `${display.winRate}%` }}
                          />
                        </div>
                      ) : (
                        <div className="h-3 rounded-full border border-dashed border-slate-300 bg-slate-50" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-4 rounded-[24px] bg-green-50 border border-green-200 p-4 shadow-sm">
              <h2 className="text-xl font-black mb-4">🏆 AIが得意な銘柄</h2>

              <div className="space-y-3">
                {(data.bestStocks ?? []).map((stock, index) => (
                  <StockRow
                    key={stock.code}
                    rank={index + 1}
                    code={stock.code}
                    name={stock.name}
                    winRate={stock.winRate}
                    total={stock.total}
                    good
                  />
                ))}
              </div>
            </section>

            <section className="mt-4 rounded-[24px] bg-red-50 border border-red-200 p-4 shadow-sm">
              <h2 className="text-xl font-black mb-4">⚠ AIが苦手な銘柄</h2>

              <div className="space-y-3">
                {(data.worstStocks ?? []).map((stock, index) => (
                  <StockRow
                    key={stock.code}
                    rank={index + 1}
                    code={stock.code}
                    name={stock.name}
                    winRate={stock.winRate}
                    total={stock.total}
                  />
                ))}
              </div>
            </section>

            <section className="mt-4 rounded-[24px] bg-zinc-900 text-white p-5 shadow-sm">
              <p className="text-xs font-black text-yellow-300">
                SIGNALX NOTE
              </p>

              <h2 className="mt-2 text-2xl font-black">
                AIはまだ学習中です
              </h2>

              <p className="mt-3 text-sm font-bold leading-7 text-zinc-300">
                現在は検証データを蓄積している段階です。WIN / LOSE の判定数が増えるほど、AI勝率・得意銘柄・苦手銘柄の信頼度が上がります。
              </p>
            </section>
          </>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 text-center">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function StockRow({
  rank,
  code,
  name,
  winRate,
  total,
  good,
}: {
  rank: number;
  code: string;
  name: string;
  winRate: number;
  total: number;
  good?: boolean;
}) {
  return (
    <Link
      href={`/analysis/${code}`}
      className="block rounded-2xl bg-white/80 border border-white p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={good ? "text-green-700 font-black" : "text-red-600 font-black"}>
            {rank}位
          </p>
          <p className="text-xl font-black">
            {code} {name}
          </p>
          <p className="text-xs font-bold text-slate-500">
            検証 {total}回
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs font-black text-slate-500">勝率</p>
          <p className={good ? "text-4xl font-black text-green-600" : "text-4xl font-black text-red-500"}>
            {winRate}%
          </p>
        </div>
      </div>
    </Link>
  );
}

function DateBox({
  label,
  value,
  pending = false,
}: {
  label: string;
  value: string | null;
  pending?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-2 text-center ${pending && value ? "bg-amber-50" : "bg-slate-50"}`}>
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className={`mt-1 text-xs font-black ${pending && value ? "text-amber-700" : "text-slate-900"}`}>
        {value ?? "なし"}
      </p>
    </div>
  );
}
