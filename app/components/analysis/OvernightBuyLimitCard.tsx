"use client";

import { useEffect, useState } from "react";
import {
  estimateOvernightBuyLimit,
  type DailyCandle,
  type OvernightBuyLimit,
} from "@/app/lib/overnightBuyLimit";

type ChartResponse = {
  success?: boolean;
  status?: string;
  updatedAt?: string;
  candles?: DailyCandle[];
};

function price(value: number) {
  return Math.floor(value).toLocaleString("ja-JP") + "円";
}

export default function OvernightBuyLimitCard({ code }: { code: string }) {
  const [result, setResult] = useState<OvernightBuyLimit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setResult(null);
      try {
        // Only the existing cached daily-chart endpoint is used. No new paid
        // API, trade, alert, scan mutation or database write is performed.
        const response = await fetch(
          "/api/chart/" + encodeURIComponent(code) + "?tf=1D",
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("Chart unavailable");
        const chart = (await response.json()) as ChartResponse;
        if (!chart.success || chart.status === "stale" || !Array.isArray(chart.candles)) {
          throw new Error("Chart data not fresh");
        }
        if (!controller.signal.aborted) {
          setResult(estimateOvernightBuyLimit(chart.candles));
        }
      } catch {
        if (!controller.signal.aborted) setResult({ status: "stale" });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    if (/^[0-9]{4}$/.test(code)) void load();
    else {
      setResult({ status: "insufficient_data" });
      setLoading(false);
    }
    return () => controller.abort();
  }, [code]);

  return (
    <section className="mt-2 rounded-xl border border-indigo-200 bg-white p-3 shadow-sm dark:border-indigo-800 dark:bg-slate-900" aria-label="翌営業日の買い指値の参考">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black tracking-wide text-indigo-600 dark:text-indigo-400">NIGHT BEFORE / 参考計算</p>
          <h2 className="mt-1 text-base font-black">🌙 翌朝の買い指値・参考上限</h2>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">発注なし</span>
      </div>

      {loading ? (
        <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-300">直近の日足を確認中…</p>
      ) : result?.status === "ready" ? (
        <>
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-300">
            基準：{result.referenceDate} の終値 {price(result.referenceClose)}
          </p>
          <div className="mt-2 rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/40">
            <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">翌営業日・買い指値の参考上限</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-slate-950 dark:text-white">{price(result.limitYen)}</p>
            <p className="mt-1 text-xs font-bold text-indigo-700 dark:text-indigo-200">
              終値から +{price(result.additionalYen)}（+{result.premiumPercent.toFixed(2)}%）
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
            <span className="font-medium text-slate-600 dark:text-slate-300">100株の最大購入代金</span>
            <strong className="tabular-nums">{price(result.limitYen * 100)}</strong>
          </div>
          <p className="mt-2 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
            過去{result.gapSamples}回の始値と前日終値の差を調査（上昇{result.positiveGapSamples}回）。
            上昇した日の値幅の75%点を使用し、上乗せを最大2%に制限した試算です。
          </p>
        </>
      ) : (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-medium leading-6 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {result?.status === "market_open"
            ? "市場の取引時間中は前夜用の目安を表示しません。市場終了後に確認してください。"
            : result?.status === "insufficient_data"
              ? "過去の始値・終値の記録が足りないため、参考上限を計算できません。"
              : "最新の株価データを確認できないため、古い価格から参考上限を計算しません。"}
        </p>
      )}

      <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] font-medium leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">
        ※ AIの将来予測・推奨買値ではなく、過去の日足からの未検証の統計目安です。高く指値を入れるほど高値づかみのリスクがあります。
        指値は「その価格以下なら買う」上限であり、約定は保証されません。実際の注文時は呼値の刻み・余力・損切ラインを確認してください。
      </p>
    </section>
  );
}
