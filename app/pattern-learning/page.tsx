"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SummaryItem = {
  pattern: string;
  total: number;
  win: number;
  lose: number;
  unknown: number;
  winRate: number;
};

type PatternSummary = {
  success: boolean;
  rsi: SummaryItem[];
  macd: SummaryItem[];
  vwap: SummaryItem[];
  ema20: SummaryItem[];
  trend: SummaryItem[];
  patternKey: SummaryItem[];
  updatedAt: string;
};

const patternLabelMap: Record<string, string> = {
  RSI_UNDER_30: "RSI30未満",
  RSI_30_44: "RSI30〜44",
  RSI_45_60: "RSI45〜60",
  RSI_61_75: "RSI61〜75",
  RSI_76_85: "RSI76〜85",
  RSI_OVER_85: "RSI85超",

  MACD_GC: "MACD上",
  MACD_DC: "MACD下",
  MACD_NO_DATA: "MACD不明",

  VWAP_ABOVE: "VWAP上",
  VWAP_BELOW: "VWAP下",
  VWAP_NO_DATA: "VWAP不明",

  EMA20_ABOVE: "EMA20上",
  EMA20_BELOW: "EMA20下",
  EMA20_NO_DATA: "EMA20不明",

  TREND_UP: "上昇",
  TREND_DOWN: "下降",
  TREND_NO_DATA: "不明",
};

export default function PatternLearningPage() {
  const [data, setData] = useState<PatternSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/pattern-learning/summary", {
          cache: "no-store",
        });

        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("pattern learning summary error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-slate-900 p-4">
        <div className="mx-auto max-w-md">
          <Card>
            <p className="font-bold text-slate-500">
              パターン学習データを読み込み中...
            </p>
          </Card>
        </div>
      </main>
    );
  }

  if (!data || !data.success) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-slate-900 p-4">
        <div className="mx-auto max-w-md">
          <Card>
            <p className="font-bold text-red-500">
              パターン学習データを取得できませんでした
            </p>
          </Card>
        </div>
      </main>
    );
  }

  const totalLogs = data.rsi.reduce((sum, item) => sum + item.total, 0) || 0;
  const unknownLogs =
    data.rsi.reduce((sum, item) => sum + item.unknown, 0) || 0;

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="flex items-center justify-between mb-4">
          <Link
            href="/learning"
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-2xl"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.18em] text-slate-500">
              PATTERN LEARNING
            </div>
          </div>

          <Link
            href="/"
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-lg"
          >
            🏠
          </Link>
        </header>

        <section className="rounded-[24px] bg-gradient-to-br from-white to-purple-50 border border-purple-200 p-4 mb-4 shadow-sm">
          <p className="text-sm font-black text-purple-600">
            🧠 パターン学習ダッシュボード
          </p>

          <h1 className="text-4xl font-black text-slate-900 mt-2">
            {totalLogs.toLocaleString()}
          </h1>

          <p className="text-sm font-bold text-slate-500 mt-1">
            保存済みチャートパターン
          </p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <TopMini
              label="判定待ち"
              value={unknownLogs.toLocaleString()}
              color="text-slate-600"
            />

            <TopMini label="更新" value={data.updatedAt} color="text-blue-600" />
          </div>
        </section>

        <SummarySection
          title="📊 RSI帯別"
          items={data.rsi}
          labelMap={{
            RSI_UNDER_30: "RSI 30未満",
            RSI_30_44: "RSI 30〜44",
            RSI_45_60: "RSI 45〜60",
            RSI_61_75: "RSI 61〜75",
            RSI_76_85: "RSI 76〜85",
            RSI_OVER_85: "RSI 85超",
          }}
        />

        <SummarySection
          title="📈 MACD別"
          items={data.macd}
          labelMap={{
            MACD_GC: "MACD上向き",
            MACD_DC: "MACD下向き",
            MACD_NO_DATA: "MACDデータ不足",
          }}
        />

        <SummarySection
          title="💰 VWAP別"
          items={data.vwap}
          labelMap={{
            VWAP_ABOVE: "VWAP上",
            VWAP_BELOW: "VWAP下",
            VWAP_NO_DATA: "VWAPデータ不足",
          }}
        />

        <SummarySection
          title="🌱 EMA20別"
          items={data.ema20}
          labelMap={{
            EMA20_ABOVE: "EMA20上",
            EMA20_BELOW: "EMA20下",
            EMA20_NO_DATA: "EMA20データ不足",
          }}
        />

        <SummarySection
          title="📉 トレンド別"
          items={data.trend}
          labelMap={{
            TREND_UP: "上昇トレンド",
            TREND_DOWN: "下降トレンド",
            TREND_NO_DATA: "トレンド不明",
          }}
        />

        <SummarySection
          title="🧬 複合パターン TOP20"
          items={data.patternKey}
          labelMap={patternLabelMap}
          compact
        />

        <section className="rounded-[24px] bg-blue-50 border border-blue-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">💬 AIコメント</h2>
          <p className="text-sm leading-7 font-bold">
            現在はパターンを蓄積中です。翌営業日のWIN/LOSE判定が入ると、RSI・MACD・VWAP・EMA20・トレンドごとの勝率が表示されます。
          </p>
        </section>
      </div>
    </main>
  );
}

function SummarySection({
  title,
  items,
  labelMap = {},
  compact = false,
}: {
  title: string;
  items: SummaryItem[];
  labelMap?: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
      <h2 className="text-xl font-black mb-3">{title}</h2>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-center">
          <p className="text-sm font-bold text-slate-400">
            まだデータがありません
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const judged = item.win + item.lose;

            const displayName =
              labelMap[item.pattern] ||
              item.pattern
                .split("|")
                .map((part) => labelMap[part] || part)
                .join(" / ");

            return (
              <div
                key={item.pattern}
                className="rounded-2xl bg-slate-50 border border-slate-100 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-black text-slate-800 leading-5 ${
                        compact ? "text-xs break-words" : "text-sm"
                      }`}
                    >
                      {displayName}
                    </p>
                    <p className="text-[11px] font-bold text-slate-400 mt-1">
                      TOTAL {item.total}件 / 判定済み {judged}件
                    </p>
                  </div>

                  <div className="text-right shrink-0 w-14">
                    <p
                      className={`text-2xl font-black ${
                        item.winRate >= 60
                          ? "text-green-600"
                          : item.winRate >= 40
                          ? "text-orange-500"
                          : "text-slate-500"
                      }`}
                    >
                      {item.winRate}%
                    </p>
                    <p className="text-[10px] font-bold text-slate-400">
                      勝率
                    </p>
                  </div>
                </div>

                <div className="mt-3 h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.winRate >= 60
                        ? "bg-green-500"
                        : item.winRate >= 40
                        ? "bg-orange-500"
                        : "bg-slate-400"
                    }`}
                    style={{ width: `${Math.max(item.winRate, 4)}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <SmallStat label="WIN" value={item.win} color="text-green-600" />
                  <SmallStat label="LOSE" value={item.lose} color="text-red-500" />
                  <SmallStat
                    label="WAIT"
                    value={item.unknown}
                    color="text-slate-500"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TopMini({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-3 text-center shadow-sm">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className={`text-lg font-black mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function SmallStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 p-2 text-center">
      <p className="text-[10px] font-black text-slate-400">{label}</p>
      <p className={`text-sm font-black ${color}`}>{value}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      {children}
    </div>
  );
}