import Link from "next/link";
import { getAdminSession } from "@/app/lib/admin";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";

type WeekRow = {
  weekday: number; total: string; win: string; lose: string; hold: string;
  days: string; avg_change: string | null;
};
type SlotRow = {
  weekday: number; time_slot: string; total: string; judged: string;
  up: string; win: string; lose: string; hold: string; days: string;
  avg_change: string | null;
};
const WEEKDAYS = ["月", "火", "水", "木", "金"];
const SLOTS = ["09:30", "10:30", "13:00", "14:30"];
const int = (value: number | string | null | undefined) => Number(value ?? 0);
const pct = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
const rate = (win: number, lose: number) => win + lose > 0 ? 100 * win / (win + lose) : null;
const mean = (value: string | null) => value === null ? null : Number(value);

async function getWeekdayData() {
  const result = await pool.query<WeekRow>(`
    SELECT EXTRACT(ISODOW FROM date::date)::int AS weekday,
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE result = 'WIN')::text AS win,
      COUNT(*) FILTER (WHERE result = 'LOSE')::text AS lose,
      COUNT(*) FILTER (WHERE result = 'HOLD')::text AS hold,
      COUNT(DISTINCT date)::text AS days,
      ROUND(AVG(change_percent)::numeric, 2)::text AS avg_change
    FROM public.daily_stock_results
    WHERE date ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
      AND result IN ('WIN','LOSE','HOLD')
      AND EXTRACT(ISODOW FROM date::date) BETWEEN 1 AND 5
    GROUP BY 1 ORDER BY 1
  `);
  return result.rows;
}

async function getSlotData() {
  const result = await pool.query<SlotRow>(`
    SELECT EXTRACT(ISODOW FROM o.trade_date)::int AS weekday,
      o.time_slot,
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE d.price > 0)::text AS judged,
      COUNT(*) FILTER (WHERE d.price > o.entry_price)::text AS up,
      COUNT(*) FILTER (WHERE d.price >= o.entry_price * 1.02)::text AS win,
      COUNT(*) FILTER (WHERE d.price <= o.entry_price * 0.98 AND d.price > 0)::text AS lose,
      COUNT(*) FILTER (WHERE d.price > 0 AND d.price < o.entry_price * 1.02
        AND d.price > o.entry_price * 0.98)::text AS hold,
      COUNT(DISTINCT o.trade_date) FILTER (WHERE d.price > 0)::text AS days,
      ROUND(AVG(100.0 * (d.price - o.entry_price) / o.entry_price)
        FILTER (WHERE d.price > 0)::numeric, 2)::text AS avg_change
    FROM public.golden_zone_observations AS o
    LEFT JOIN public.daily_stock_results AS d
      ON d.date = o.outcome_date::text AND d.code = o.code
    WHERE o.entry_price > 0
    GROUP BY 1, 2 ORDER BY 1, 2
  `);
  return result.rows;
}

function status(judged: number, days: number) {
  if (judged === 0) return "判定待ち";
  if (judged < 30 || days < 10) return "収集中";
  return "参考統計";
}

export default async function GoldenZonePage() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-black">ゴールデンゾーン分析</h1><p className="mt-4">管理者専用ページです。</p></main>;
  }

  const [weekly, slotResult] = await Promise.allSettled([getWeekdayData(), getSlotData()]);
  const weekRows = weekly.status === "fulfilled" ? weekly.value : [];
  const slotRows = slotResult.status === "fulfilled" ? slotResult.value : [];
  const weeklyMap = new Map(weekRows.map((row) => [row.weekday, row]));
  const slotMap = new Map(slotRows.map((row) => [`${row.weekday}:${row.time_slot}`, row]));
  const totalSamples = slotRows.reduce((sum, row) => sum + int(row.total), 0);
  const settledSamples = slotRows.reduce((sum, row) => sum + int(row.judged), 0);
  const slotTotals = SLOTS.map((slot) => {
    const rows = slotRows.filter((row) => row.time_slot === slot);
    return { slot, judged: rows.reduce((sum, row) => sum + int(row.judged), 0),
      up: rows.reduce((sum, row) => sum + int(row.up), 0),
      wins: rows.reduce((sum, row) => sum + int(row.win), 0),
      losses: rows.reduce((sum, row) => sum + int(row.lose), 0),
      dayCount: rows.reduce((sum, row) => sum + int(row.days), 0) };
  });
  const bestWeek = weekRows.filter((row) => int(row.win) + int(row.lose) >= 30)
    .sort((a, b) => (rate(int(b.win), int(b.lose)) ?? -1) - (rate(int(a.win), int(a.lose)) ?? -1))[0];
  const bestSlot = slotTotals.filter((row) => row.judged >= 30 && row.dayCount >= 10)
    .sort((a, b) => (rate(b.wins, b.losses) ?? -1) - (rate(a.wins, a.losses) ?? -1))[0];

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/learning-status" className="text-sm font-bold text-blue-600 dark:text-blue-400">← 学習管理に戻る</Link>
        <h1 className="mt-3 text-2xl font-black">🏆 SIGNALX ゴールデンゾーン分析</h1>
        <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
          管理者専用・観察モード。既存AI POWER、通知、売買には一切影響しません。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs text-slate-500">曜日別の最高勝率</p>
            <p className="mt-1 text-xl font-black">{bestWeek ? `${WEEKDAYS[bestWeek.weekday - 1]}曜日` : "検証中"}</p>
            <p className="text-sm font-bold text-emerald-600">{bestWeek ? pct(rate(int(bestWeek.win), int(bestWeek.lose))) : "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs text-slate-500">時間帯の最高勝率</p>
            <p className="mt-1 text-xl font-black">{bestSlot ? bestSlot.slot : "データ収集中"}</p>
            <p className="text-sm font-bold text-emerald-600">{bestSlot ? pct(rate(bestSlot.wins, bestSlot.losses)) : "—"}</p>
          </div>
        </div>
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">📅 曜日別の勝率</h2>
          {weekly.status !== "fulfilled" && <p className="mt-2 text-sm text-red-600">曜日別データを取得できませんでした。</p>}
          <div className="mt-3 space-y-2">
            {WEEKDAYS.map((name, index) => {
              const row = weeklyMap.get(index + 1);
              const win = int(row?.win), lose = int(row?.lose), hold = int(row?.hold);
              const value = rate(win, lose);
              return <div key={name} className="grid grid-cols-[2.5rem_1fr_4.5rem] items-center gap-2 text-sm">
                <span className="font-black">{name}</span>
                <div className="h-5 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                  <div className="h-full bg-emerald-500" style={{width: `${value ?? 0}%`}} />
                </div>
                <span className="text-right font-black tabular-nums">{pct(value)}</span>
                <span className="col-span-3 text-xs text-slate-500 dark:text-slate-400">WIN {win} / LOSE {lose} / HOLD {hold} ・{int(row?.days)}日 ・平均変動 {pct(mean(row?.avg_change ?? null))}</span>
              </div>;
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">既存の日次AI判定の勝率 = WIN ÷ (WIN + LOSE)。HOLDは除外。曜日は予測記録日を基準にしています。平均変動は既存の判定用騰落率です。</p>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">⏰ 時間帯 × 曜日</h2>
          <p className="mt-1 text-xs text-slate-500">時間帯は新規観測のみ。翌営業日の15:35頃に保存される株価で評価（±2%以上でWIN/LOSE）。</p>
          {slotResult.status !== "fulfilled" && <p className="mt-2 text-sm text-amber-600">時間帯の集計テーブル準備中／取得エラー。</p>}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[350px] table-fixed border-separate border-spacing-1 text-center text-xs">
              <thead><tr><th className="w-16 text-left">時刻</th>{WEEKDAYS.map((name) => <th key={name}>{name}</th>)}</tr></thead>
              <tbody>
                {SLOTS.map((slot) => <tr key={slot}>
                  <th className="text-left font-bold">{slot}</th>
                  {WEEKDAYS.map((day, index) => {
                    const row = slotMap.get(`${index + 1}:${slot}`);
                    const wins = int(row?.win), losses = int(row?.lose);
                    const enough = int(row?.judged) >= 30 && int(row?.days) >= 10;
                    const value = rate(wins, losses);
                    return <td key={day} title={`${int(row?.judged)}件 / ${int(row?.days)}日 / 上昇${int(row?.up)}件`}
                      className={`rounded-md px-1 py-3 font-bold ${!enough ? "bg-slate-100 text-slate-400 dark:bg-slate-800" : (value ?? 0) >= 60 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-50 text-slate-800 dark:bg-slate-700 dark:text-slate-100"}`}>
                      {enough ? pct(value) : "—"}
                    </td>;
                  })}
                </tr>)}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">確定30件・10取引日未満のマスは「—」表示。データが少ない状態でゴールデンゾーンを断定しません。</p>
        </section>
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">📊 時間帯別まとめ</h2>
          <p className="mt-1 text-xs text-slate-500">新規観測 {totalSamples.toLocaleString()}件 / 翌営業日判定 {settledSamples.toLocaleString()}件</p>
          <div className="mt-3 space-y-2">
            {slotTotals.map((row) => <div key={row.slot} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
              <span className="font-bold">{row.slot}頃</span>
              <span className="tabular-nums">±2%勝率 <b>{status(row.judged, row.dayCount) === "参考統計" ? pct(rate(row.wins, row.losses)) : "—"}</b></span>
              <span className="text-xs text-slate-500 dark:text-slate-300">{row.judged}件判定・{status(row.judged, row.dayCount)}</span>
            </div>)}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">サンプルはスキャンの上位最大30銘柄。市場全体の無作為抽出ではありません。取引コスト未考慮、過去の実績は将来の利益を保証しません。古い時間帯学習データは混ぜていません。</p>
        </section>
      </div>
    </main>
  );
}
