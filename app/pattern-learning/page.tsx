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

type ConditionGroup = "rsi" | "macd" | "vwap" | "ema20" | "trend";

type CurrentStock = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  aiPower: number;
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
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentStocks, setCurrentStocks] = useState<CurrentStock[]>([]);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [currentError, setCurrentError] = useState("");

  const showCurrentStocks = async (group: ConditionGroup, item: SummaryItem, label: string) => {
    setCurrentTitle(label);
    setCurrentLoading(true);
    setCurrentStocks([]);
    setCurrentError("");
    try {
      const params = new URLSearchParams({ group, value: item.pattern, limit: "100" });
      const res = await fetch(`/api/pattern-learning/current-stocks?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setCurrentStocks(Array.isArray(json?.stocks) ? json.stocks : []);
      window.setTimeout(() => {
        document.getElementById("current-condition-stocks")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    } catch (error) {
      console.error("current condition stocks error:", error);
      setCurrentError("銘柄一覧を取得できませんでした。もう一度お試しください。");
    } finally {
      setCurrentLoading(false);
    }
  };

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
          group="rsi"
          onShowCurrent={showCurrentStocks}
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
          group="macd"
          onShowCurrent={showCurrentStocks}
          labelMap={{
            MACD_GC: "MACD上向き",
            MACD_DC: "MACD下向き",
            MACD_NO_DATA: "MACDデータ不足",
          }}
        />

        <SummarySection
          title="💰 VWAP別"
          items={data.vwap}
          group="vwap"
          onShowCurrent={showCurrentStocks}
          labelMap={{
            VWAP_ABOVE: "VWAP上",
            VWAP_BELOW: "VWAP下",
            VWAP_NO_DATA: "VWAPデータ不足",
          }}
        />

        <SummarySection
          title="🌱 EMA20別"
          items={data.ema20}
          group="ema20"
          onShowCurrent={showCurrentStocks}
          labelMap={{
            EMA20_ABOVE: "EMA20上",
            EMA20_BELOW: "EMA20下",
            EMA20_NO_DATA: "EMA20データ不足",
          }}
        />

        <SummarySection
          title="📉 トレンド別"
          items={data.trend}
          group="trend"
          onShowCurrent={showCurrentStocks}
          labelMap={{
            TREND_UP: "上昇トレンド",
            TREND_DOWN: "下降トレンド",
            TREND_NO_DATA: "トレンド不明",
          }}
        />

        {currentTitle && (
          <section id="current-condition-stocks" className="scroll-mt-4 rounded-[24px] bg-white border border-blue-200 p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black text-blue-600">現在の該当銘柄</p><h2 className="text-lg font-black">{currentTitle}</h2></div>
              <button type="button" onClick={() => { setCurrentTitle(""); setCurrentStocks([]); }} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">閉じる</button>
            </div>
            {currentLoading ? (
              <p className="mt-4 text-sm font-bold text-slate-500">現在のスキャン結果から検索中...</p>
            ) : currentError ? (
              <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600">{currentError}</p>
            ) : currentStocks.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">現在この条件に一致する銘柄はありません。</p>
            ) : (
              <div className="mt-3 space-y-2">
                {currentStocks.map((stock) => (
                  <Link key={stock.code} href={`/analysis/${stock.code}`} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3 active:scale-[0.99]">
                    <div className="min-w-0"><p className="text-xs font-black text-slate-500">{stock.code}</p><p className="truncate text-sm font-black">{stock.name}</p></div>
                    <div className="shrink-0 text-right"><p className="text-sm font-black">AI {stock.aiPower}</p><p className={`text-xs font-bold ${stock.changePercent > 0 ? "text-green-600" : stock.changePercent < 0 ? "text-red-500" : "text-slate-500"}`}>{stock.changePercent > 0 ? "+" : ""}{stock.changePercent}%</p></div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

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
  group,
  onShowCurrent,
}: {
  title: string;
  items: SummaryItem[];
  labelMap?: Record<string, string>;
  compact?: boolean;
  group?: ConditionGroup;
  onShowCurrent?: (group: ConditionGroup, item: SummaryItem, label: string) => void;
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

                {group && onShowCurrent && (
                  <button type="button" onClick={() => onShowCurrent(group, item, displayName)} className="mt-3 w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-black text-blue-700 transition active:scale-[0.99]">
                    現在この条件の銘柄を見る →
                  </button>
                )}

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