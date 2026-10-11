"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { analyzeEmaCrossovers as analyze, backtestEmaCrossovers } from "@/app/lib/emaCrossoverBacktest";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type Payload = {
  success: true;
  code: string;
  timeframe: "1D";
  range: "6mo" | "2y";
  candles: Candle[];
  provisionalBarExcluded: boolean;
  fetchedAt: string;
};
type Signal = { index: number; time: number; kind: "BUY" | "SELL"; close: number };

const dateJp = (time: number) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(time * 1000));
const yen = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });

function EmaChart({
  candles, ema9, ema21, signals,
}: {
  candles: Candle[];
  ema9: Array<number | null>;
  ema21: Array<number | null>;
  signals: Signal[];
}) {
  const first = Math.max(0, candles.length - 100);
  const visible = candles.slice(first);
  const W = 960, H = 405, left = 65, right = 23, top = 38, bottom = 45;
  const values = visible.flatMap((c, i) => [
    c.low, c.high,
    ema9[first + i] ?? c.close,
    ema21[first + i] ?? c.close,
  ]);
  const rawMin = Math.min(...values), rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.07, 1);
  const min = rawMin - padding, max = rawMax + padding;
  const x = (i: number) => left + i * (W - left - right) / Math.max(visible.length - 1, 1);
  const y = (price: number) => H - bottom - (price - min) * (H - top - bottom) / (max - min);
  const line = (data: Array<number | null>) => {
    let started = false;
    return visible.map((_, i) => {
      const price = data[first + i];
      if (price === null) return "";
      const command = started ? "L" : "M";
      started = true;
      return command + x(i).toFixed(1) + " " + y(price).toFixed(1);
    }).filter(Boolean).join(" ");
  };
  const closeLine = visible.map((c, i) =>
    (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(c.close).toFixed(1)
  ).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => max - (max - min) * fraction);
  const marks = signals.filter((s) => s.index >= first);
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
      <svg viewBox={"0 0 " + W + " " + H} className="block min-w-[720px] w-full" role="img" aria-label="株価、EMA9、EMA21の折れ線と買い売り交差サイン">
        <rect x="0" y="0" width={W} height={H} fill="transparent" />
        {ticks.map((tick) => <g key={tick}>
          <line x1={left} y1={y(tick)} x2={W - right} y2={y(tick)} stroke="#94a3b8" strokeOpacity="0.22" strokeDasharray="4 5" />
          <text x={left - 8} y={y(tick) + 4} fontSize="12" fill="#94a3b8" textAnchor="end">{yen(tick)}</text>
        </g>)}
        <path d={closeLine} fill="none" stroke="#64748b" strokeWidth="1.5" opacity="0.65" />
        <path d={line(ema21)} fill="none" stroke="#f59e0b" strokeWidth="2.8" />
        <path d={line(ema9)} fill="none" stroke="#2563eb" strokeWidth="2.8" />
        {marks.map((signal) => {
          const index = signal.index - first;
          const isBuy = signal.kind === "BUY";
          const pointY = y(isBuy ? visible[index].low : visible[index].high) + (isBuy ? 20 : -19);
          return <g key={signal.time + signal.kind}>
            <circle cx={x(index)} cy={pointY} r="10" fill={isBuy ? "#059669" : "#dc2626"} stroke="#fff" strokeWidth="1.5" />
            <text x={x(index)} y={pointY + 4} fontSize="11" fill="white" fontWeight="bold" textAnchor="middle">{isBuy ? "B" : "S"}</text>
          </g>;
        })}
        {[0, Math.floor((visible.length - 1) / 2), visible.length - 1].map((i) =>
          <text key={i} x={x(i)} y={H - 15} textAnchor={i === 0 ? "start" : i === visible.length - 1 ? "end" : "middle"} fontSize="13" fill="#94a3b8">{dateJp(visible[i].time)}</text>
        )}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">
        <span>灰色：終値</span><span className="text-blue-600">青：EMA9</span>
        <span className="text-amber-600">橙：EMA21</span>
        <span className="text-emerald-600">●B：上抜け</span>
        <span className="text-red-600">●S：下抜け</span>
      </div>
    </div>
  );
}

export default function EmaSignalWorkbench() {
  const [input, setInput] = useState("7203");
  const [range, setRange] = useState<"6mo" | "2y">("2y");
  const [code, setCode] = useState("7203");
  const [revision, setRevision] = useState(0);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setBusy(true);
      setError("");
      setPayload(null);
      try {
        const res = await fetch("/api/admin/ema-signals?code=" + encodeURIComponent(code) + "&range=" + range, {
          cache: "no-store", signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || data.success !== true) throw new Error(data.error ?? "取得できませんでした");
        if (!controller.signal.aborted) setPayload(data as Payload);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "取得できませんでした");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [code, revision, range]);

  const analysis = useMemo(() => payload ? analyze(payload.candles) : null, [payload]);
  const backtest = useMemo(() => payload ? backtestEmaCrossovers(payload.candles) : null, [payload]);

  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = input.trim().toUpperCase();
    if (!/^[0-9A-Z]{4}$/.test(next)) {
      setError("国内株式の4桁の銘柄コードを入力してください");
      return;
    }
    setCode(next);
    setRevision((value) => value + 1);
  }

  const last = payload?.candles.at(-1);
  const last9 = analysis?.ema9.at(-1);
  const last21 = analysis?.ema21.at(-1);
  const lastSignal = analysis?.signals.at(-1);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/admin/learning-status" className="text-sm font-bold text-blue-600">← 学習監視へ戻る</Link>
          <Link href="/admin/ema-comparison" className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-black text-violet-700">🧪 複数銘柄・条件比較へ →</Link>
        </div>
        <header className="mt-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-black tracking-widest text-blue-600">ADMIN / READ ONLY</p>
          <h1 className="mt-2 text-2xl font-black">📈 EMA売買サイン研究</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            日足の確定終値を使い、EMA9がEMA21を上抜けた日を「買い」、下抜けた日を「売り」として表示します。
            これは交差の観察であり、推奨売買ではありません。
          </p>
          <form onSubmit={search} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm font-bold">
              銘柄コード
              <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={4} autoComplete="off"
                className="w-36 rounded-xl border border-slate-300 bg-white px-3 py-3 text-lg text-slate-900 dark:border-slate-600" aria-label="国内株式の銘柄コード" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">検証期間
              <select value={range} onChange={(event) => setRange(event.target.value as "6mo" | "2y")} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600">
                <option value="6mo">約6か月</option>
                <option value="2y">約2年間</option>
              </select>
            </label>
            <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-60">
              {busy ? "取得中…" : "サインを見る"}
            </button>
            <Link href={"/chart/" + code} className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold">
              通常チャート ↗
            </Link>
          </form>
        </header>

        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
        {busy && <p className="mt-4 rounded-xl bg-white p-5 text-slate-500 dark:bg-slate-900">日足を取得しています…</p>}

        {payload && analysis && last && backtest && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              <Metric title="最新終値" value={yen(last.close) + "円"} />
              <Metric title="EMA9" value={last9 == null ? "—" : yen(last9) + "円"} />
              <Metric title="EMA21" value={last21 == null ? "—" : yen(last21) + "円"} />
              <Metric title="現在のEMA位置" value={last9 != null && last21 != null ? (last9 > last21 ? "EMA9が上" : last9 < last21 ? "EMA9が下" : "同値") : "—"} />
            </div>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-black">🧪 EMA売買サイン 自動検証</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">確定取引のみ集計／100株固定／翌営業日始値で仮想約定</p>
                </div>
                <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-100">対象：{payload.range === "2y" ? "約2年" : "約6か月"}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Metric title="確定取引の勝率" value={backtest.stats.winRatePercent === null ? "—" : backtest.stats.winRatePercent.toFixed(1) + "%"} />
                <Metric title="確定取引" value={backtest.stats.closedTrades + "回"} />
                <Metric title="確定損益合計" value={signedYen(backtest.stats.totalPnlYen)} />
                <Metric title="1回あたり平均損益" value={backtest.stats.averagePnlYen == null ? "—" : signedYen(backtest.stats.averagePnlYen)} />
                <Metric title="勝ち / 負け / 引分" value={backtest.stats.wins + " / " + backtest.stats.losses + " / " + backtest.stats.flat} />
                <Metric title="平均損益率" value={backtest.stats.averageReturnPercent === null ? "—" : signedPercent(backtest.stats.averageReturnPercent)} />
                <Metric title="最高 / 最悪（100株）" value={backtest.stats.bestTradeYen == null || backtest.stats.worstTradeYen == null ? "—" : signedYen(backtest.stats.bestTradeYen) + " / " + signedYen(backtest.stats.worstTradeYen)} />
                <Metric title="確定損益の最大ドローダウン" value={yen(backtest.stats.maxRealizedDrawdownYen) + "円"} />
              </div>
              {backtest.stats.closedTrades < 10 && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  ⚠ 完了した取引が10回未満です。勝率・平均利益はサンプル不足で参考値です。
                </p>
              )}
              {backtest.openPosition && (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-slate-800">
                  <p className="font-black">📌 未決済の仮想保有（確定損益に含めない）</p>
                  <p className="mt-1">買付：{dateJp(backtest.openPosition.entryTime)} 始値 {yen(backtest.openPosition.entryPrice)}円 ／ 最新終値 {yen(backtest.openPosition.latestClose)}円</p>
                  <p className="mt-1 font-bold">含み損益：{signedYen(backtest.openPosition.unrealizedPnlYen)}（{signedPercent(backtest.openPosition.unrealizedReturnPercent)}）</p>
                  {backtest.openPosition.exitPending && <p className="mt-1 font-bold text-red-600">🔴 売り交差が出ています。翌営業日の始値がまだないため未決済です。</p>}
                </div>
              )}
              {backtest.pendingBuy && <p className="mt-3 text-sm font-bold text-blue-700">🟢 買い交差直後：翌営業日の始値待ち（未約定）</p>}
              <h3 className="mt-5 text-base font-black">過去の売買シミュレーション履歴</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="border-b text-slate-500"><tr><th className="py-2">買付日（翌始値）</th><th>売却日（翌始値）</th><th className="text-right">買値</th><th className="text-right">売値</th><th className="text-right">損益率</th><th className="text-right">100株損益</th></tr></thead>
                  <tbody>{[...backtest.trades].reverse().slice(0, 20).map((trade) => (
                    <tr key={trade.entryTime} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-3">{dateJp(trade.entryTime)}</td>
                      <td>{dateJp(trade.exitTime)}</td>
                      <td className="text-right">{yen(trade.entryPrice)}円</td>
                      <td className="text-right">{yen(trade.exitPrice)}円</td>
                      <td className={"text-right font-bold " + (trade.returnPercent >= 0 ? "text-emerald-600" : "text-red-600")}>{signedPercent(trade.returnPercent)}</td>
                      <td className={"text-right font-bold " + (trade.pnlYen >= 0 ? "text-emerald-600" : "text-red-600")}>{signedYen(trade.pnlYen)}</td>
                    </tr>
                  ))}</tbody>
                </table>
                {!backtest.trades.length && <p className="py-3 text-sm text-slate-500">この期間には決済済みの売買取引がありません。</p>}
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
                買いサインの翌営業日の始値で100株購入→売りサインの翌営業日の始値で売却と仮定。
                売りから始まる交差は空売りしません。勝率＝利益プラスの確定取引数÷確定取引総数。
                手数料・税金・スリッページ・配当・株式分割調整は未反映。最大ドローダウンは確定損益累積から計算し、保有中の下落は含みません。
                銘柄の生存バイアス、期間の短さ、約定可能性にも注意してください。過去の実績は将来の利益を保証しません。
              </p>
            </section>

            <section className="mt-4">
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-black">{payload.code} 日足・直近100本</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">最新足：{dateJp(last.time)} ／ 左右にスクロール可能</p>
                </div>
                <span className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  取得期間の交差 {analysis.signals.length}件
                </span>
              </div>
              <EmaChart candles={payload.candles} ema9={analysis.ema9} ema21={analysis.ema21} signals={analysis.signals} />
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-black">直近の売買サイン</h2>
              <p className="mt-1 text-xs text-slate-500">選択期間のEMA交差一覧です。上部の成績は翌始値で約定した仮想取引に限定しています。</p>
              {lastSignal && <p className="mt-3 font-bold">最新サイン：{dateJp(lastSignal.time)} ・{lastSignal.kind === "BUY" ? "🟢 買い交差" : "🔴 売り交差"}</p>}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[330px] text-left text-sm">
                  <thead><tr className="border-b text-slate-500"><th className="py-2">発生日</th><th>交差</th><th className="text-right">当日終値</th></tr></thead>
                  <tbody>{[...analysis.signals].reverse().slice(0, 12).map((s) => <tr className="border-b border-slate-100 dark:border-slate-800" key={s.time}>
                    <td className="py-3">{dateJp(s.time)}</td>
                    <td className={s.kind === "BUY" ? "font-bold text-emerald-600" : "font-bold text-red-600"}>{s.kind === "BUY" ? "● 買い交差" : "● 売り交差"}</td>
                    <td className="text-right">{yen(s.close)}円</td>
                  </tr>)}</tbody>
                </table>
                {!analysis.signals.length && <p className="py-3 text-sm text-slate-500">取得期間中に交差サインはありません。</p>}
              </div>
            </section>
            <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
              ※ 計算は取得した日足終値によるEMA（初回は各期間の単純平均）。取引時間中の未確定足は除外します。
              データ提供元の更新遅延により確定値が後から変わる可能性があります。
              実験室・DB保存・LINE通知・AI POWER・疑似購入・本番売買判定は変更しません。
              {payload.provisionalBarExcluded ? " 本日の未確定足を除外しました。" : ""}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
    <p className="text-xs font-bold text-slate-500">{title}</p>
    <p className="mt-1 break-words text-lg font-black">{value}</p>
  </div>;
}

function signedYen(value: number) { return (value > 0 ? "+" : "") + yen(value) + "円"; }
function signedPercent(value: number) { return (value > 0 ? "+" : "") + value.toFixed(2) + "%"; }
