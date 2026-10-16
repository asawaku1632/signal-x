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

function ageLabel(iso: string | null) {
  if (!iso) return "更新時刻なし";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "更新時刻が不正";
  const minutes = Math.floor((Date.now() - ms) / 60000);
  return minutes < 0 ? "時刻にずれがあります" : `${minutes}分前`;
}
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
  const [retry, setRetry] = useState(0);
  const [latestBar, setLatestBar] = useState<string | null>(null);
  const [chartUpdated, setChartUpdated] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [chartStatus, setChartStatus] = useState<string | null>(null);
  const [dailyStatus, setDailyStatus] = useState<string | null>(null);
  const [dailyUpdated, setDailyUpdated] = useState<string | null>(null);

  // Keep the read-only chart check current while the Tokyo cash market is open.
  // This never changes AI scores, orders, notifications, or stored trading data.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tokyo", hourCycle: "h23",
        weekday: "short", hour: "2-digit", minute: "2-digit",
      }).formatToParts(new Date());
      const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
      const weekday = part("weekday");
      const minutes = Number(part("hour")) * 60 + Number(part("minute"));
      const open = (minutes >= 9 * 60 && minutes <= 11 * 60 + 30) ||
        (minutes >= 12 * 60 + 30 && minutes <= 15 * 60 + 30);
      if (weekday !== "Sat" && weekday !== "Sun" && open) {
        setRetry(value => value + 1);
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setDecision(null);
      setLatestBar(null);
      setChartUpdated(null);
      setChartStatus(null);
      setDailyStatus(null);
      setDailyUpdated(null);
      setFetchError(null);
      try {
        if (!/^[0-9]{4}$/.test(code)) throw new Error("銘柄コードが不正です");
        const [intradayResponse, dailyResponse] = await Promise.all([
          fetch(`/api/chart/${encodeURIComponent(code)}?tf=5m`,
            { cache: "no-store", signal: controller.signal }),
          fetch(`/api/chart/${encodeURIComponent(code)}?tf=1D`,
            { cache: "no-store", signal: controller.signal }),
        ]);
        if (!intradayResponse.ok || !dailyResponse.ok) {
          throw new Error(`チャート取得失敗（5分足 HTTP ${intradayResponse.status} / 日足 HTTP ${dailyResponse.status}）`);
        }
        const [intraday, daily] = await Promise.all([
          intradayResponse.json() as Promise<ChartPayload<IntradayCandle>>,
          dailyResponse.json() as Promise<ChartPayload<DailyCandle>>,
        ]);
        const times = (intraday.candles ?? []).map(c => c.time).filter(Number.isFinite);
        if (!controller.signal.aborted) {
          setLatestBar(times.length ? new Date(Math.max(...times) * 1000).toISOString() : null);
          setChartUpdated(intraday.updatedAt ?? null);
          setChartStatus(intraday.status ?? null);
          setDailyStatus(daily.status ?? null);
          setDailyUpdated(daily.updatedAt ?? null);
        }
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
      } catch (error) {
        if (!controller.signal.aborted) {
          setFetchError(error instanceof Error ? error.message : "取得エラー");
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
  }, [code, aiPower, rsi, scanPrice, scanStatus, scanUpdatedAt, retry]);

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

      {decision?.status === "UNAVAILABLE" && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <p className="font-black">データ鮮度診断（買い判断ではありません）</p>
          <p>5分足API状態：{chartStatus ?? "未取得"}</p>
          <p>5分足API更新：{ageLabel(chartUpdated)}</p>
          <p>最新5分足：{ageLabel(latestBar)}</p>
          <p>日足API状態：{dailyStatus ?? "未取得"}</p>
          <p>日足API更新：{ageLabel(dailyUpdated)}</p>
          <p>AI分析状態：{scanStatus ?? "未取得"}</p>
          <p>AI分析更新：{ageLabel(scanUpdatedAt)}</p>
          {fetchError && <p>取得エラー：{fetchError}</p>}
          <p>古いデータでの判定は引き続き保留します。</p>
        </div>
      )}
      <button
        type="button"
        disabled={loading}
        onClick={() => setRetry(value => value + 1)}
        className="mt-3 min-h-11 w-full rounded-xl border border-sky-500 bg-sky-50 px-3 text-sm font-black text-sky-700 active:scale-[0.99] dark:bg-slate-800 dark:text-sky-300"
      >
        🔄 チャートを再取得して判定
      </button>
      <p className="mt-2 text-[11px] font-medium leading-5 text-slate-500 dark:text-slate-400">
        開いた時点のAI分析と当日5分足で、上限超え・急落・過熱・データ不一致を点検する未検証の参考チェックです。
        このボタンはチャートを再取得します。AI評価は画面に渡された値を使用するため、更新には画面の再表示が必要な場合があります。時間外・データ不足は「確認待ち」。判定が良くても購入保証ではありません。注文の変更・取消・自動発注は行いません。
      </p>
    </section>
  );
}
