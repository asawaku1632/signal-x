"use client";

import { useEffect, useState } from "react";
import { estimateOvernightBuyLimit, type DailyCandle } from "@/app/lib/overnightBuyLimit";
import { assessMorningEntry, type IntradayCandle, type MorningEntryCheck } from "@/app/lib/morningEntryCheck";

type ChartPayload<T> = {
  success?: boolean;
  status?: string;
  updatedAt?: string;
  candles?: T[];
};

type Props = {
  code: string;
  aiPower: number | null;
  rsi: number | null;
  scanPrice: number | null;
  scanStatus: string | null;
  scanUpdatedAt: string | null;
};

function yen(value: number | null) {
  return value !== null && Number.isFinite(value)
    ? `${value.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}円`
    : "未取得";
}

function observedAtLabel(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export default function MorningEntryRecheckCard(props: Props) {
  const { code, aiPower, rsi, scanPrice, scanStatus, scanUpdatedAt } = props;
  const [decision, setDecision] = useState<MorningEntryCheck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setDecision(null);
      try {
        if (!/^[0-9]{4}$/.test(code)) throw new Error("Invalid code");
        const [intradayResponse, dailyResponse] = await Promise.all([
          fetch(`/api/chart/${encodeURIComponent(code)}?tf=5m`,
            { cache: "no-store", signal: controller.signal }),
          fetch(`/api/chart/${encodeURIComponent(code)}?tf=1D`,
            { cache: "no-store", signal: controller.signal }),
        ]);
        if (!intradayResponse.ok || !dailyResponse.ok) {
          throw new Error("Charts unavailable");
        }
        const [intraday, daily] = await Promise.all([
          intradayResponse.json() as Promise<ChartPayload<IntradayCandle>>,
          dailyResponse.json() as Promise<ChartPayload<DailyCandle>>,
        ]);
        const now = new Date();
        const reference =
          daily.success && daily.status === "fresh" && Array.isArray(daily.candles)
            ? estimateOvernightBuyLimit(daily.candles, now, { forMorningRecheck: true })
            : { status: "stale" as const };
        const result = assessMorningEntry({
          reference,
          candles: intraday.success && Array.isArray(intraday.candles) ? intraday.candles : [],
          chartStatus: intraday.status ?? null,
          chartUpdatedAt: intraday.updatedAt ?? null,
          scanStatus,
          scanUpdatedAt,
          aiPower, rsi, scanPrice, now,
        });
        if (!controller.signal.aborted) setDecision(result);
      } catch {
        if (!controller.signal.aborted) {
          setDecision({
            status: "UNAVAILABLE", label: "確認待ち",
            summary: "最新の価格を取得できません。古い情報で新規購入を判断しないでください。",
            reasons: [], referenceClose: null, limitYen: null,
            openingPrice: null, observedPrice: null, observedAt: null,
          });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [code, aiPower, rsi, scanPrice, scanStatus, scanUpdatedAt]);

  const state = decision?.status ?? "UNAVAILABLE";
  const accent = state === "AVOID"
    ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
    : state === "CONDITIONAL"
      ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
      : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200";

  return (
    <section className="mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="当日の買い判断を再チェック">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black tracking-wide text-sky-700 dark:text-sky-300">MORNING RECHECK / 参考チェック</p>
          <h2 className="mt-1 text-base font-black">🌅 当日の買い判断を再チェック</h2>
        </div>
        <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">発注なし</span>
      </div>

      <div className={`mt-3 rounded-xl border p-3 ${accent}`}>
        <p className="text-xs font-black">今日の確認結果</p>
        <p className="mt-1 text-lg font-black">{loading ? "判定データを確認中…" : decision?.label ?? "確認待ち"}</p>
        {!loading && decision && <p className="mt-2 text-xs font-medium leading-5">{decision.summary}</p>}
      </div>

      {decision && decision.observedPrice !== null && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300">前日終値</p>
            <p className="mt-1 font-black">{yen(decision.referenceClose)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300">参考買付上限</p>
            <p className="mt-1 font-black">{yen(decision.limitYen)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300">当日始値（5分足）</p>
            <p className="mt-1 font-black">{yen(decision.openingPrice)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300">確認した株価 {observedAtLabel(decision.observedAt) ?? ""}</p>
            <p className="mt-1 font-black">{yen(decision.observedPrice)}</p>
          </div>
        </div>
      )}

      {decision && decision.reasons.length > 0 && (
        <ul className="mt-2 space-y-1">
          {decision.reasons.map((reason, i) => (
            <li key={i} className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">・{reason}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 min-h-11 w-full rounded-xl border border-sky-500 bg-sky-50 px-3 text-sm font-black text-sky-700 active:scale-[0.99] dark:bg-slate-800 dark:text-sky-300"
      >
        🔄 AI評価と株価を再取得して確認
      </button>
      <p className="mt-2 text-[11px] font-medium leading-5 text-slate-500 dark:text-slate-400">
        開いた時点のAI分析と当日5分足で、上限超え・急落・過熱・データ不一致を点検する未検証の参考チェックです。
        時間外・データ不足は「確認待ち」。判定が良くても購入保証ではありません。注文の変更・取消・自動発注は行いません。
      </p>
    </section>
  );
}
