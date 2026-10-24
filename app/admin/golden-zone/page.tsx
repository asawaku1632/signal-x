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
  avg_hundred_share_pnl: string | null;
  worst_hundred_share_pnl: string | null;
  high_ai_judged: string; high_ai_win: string; high_ai_lose: string;
};
const WEEKDAYS = ["月", "火", "水", "木", "金"];
const SLOTS = ["09:15", "09:30", "10:30", "12:40", "13:00", "14:30", "15:15"];
const SLOT_HINTS: Record<string, string> = {
  "09:15": "寄り付き直後",
  "09:30": "朝の序盤",
  "10:30": "前場中盤",
  "12:40": "後場寄り直後",
  "13:00": "後場序盤",
  "14:30": "大引けに向けて",
  "15:15": "プレ・クロージング前",
};
const signedYen = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${Math.round(value).toLocaleString("ja-JP")}円`;
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
        FILTER (WHERE d.price > 0)::numeric, 2)::text AS avg_change,
      ROUND(AVG(100.0 * (d.price - o.entry_price))
        FILTER (WHERE d.price > 0)::numeric, 0)::text AS avg_hundred_share_pnl,
      ROUND(MIN(100.0 * (d.price - o.entry_price))
        FILTER (WHERE d.price > 0)::numeric, 0)::text AS worst_hundred_share_pnl,
      COUNT(*) FILTER (WHERE o.ai_power >= 80 AND d.price > 0)::text AS high_ai_judged,
      COUNT(*) FILTER (WHERE o.ai_power >= 80
        AND d.price >= o.entry_price * 1.02)::text AS high_ai_win,
      COUNT(*) FILTER (WHERE o.ai_power >= 80
        AND d.price <= o.entry_price * 0.98 AND d.price > 0)::text AS high_ai_lose
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
    const sum = (key: "judged" | "total" | "up" | "win" | "lose" | "hold" | "days" |
      "high_ai_judged" | "high_ai_win" | "high_ai_lose") =>
      rows.reduce((total, row) => total + int(row[key]), 0);
    const judged = sum("judged");
    const weighted = (key: "avg_change" | "avg_hundred_share_pnl") =>
      judged ? rows.reduce((total, row) =>
        total + Number(row[key] ?? 0) * int(row.judged), 0) / judged : null;
    const worst = rows.map((row) => mean(row.worst_hundred_share_pnl))
      .filter((value): value is number => value !== null);
    return {
      slot, total: sum("total"), judged, up: sum("up"), wins: sum("win"),
      losses: sum("lose"), holds: sum("hold"), dayCount: sum("days"),
      avgChange: weighted("avg_change"), avgHundredSharePnl: weighted("avg_hundred_share_pnl"),
      worstHundredSharePnl: worst.length ? Math.min(...worst) : null,
      highAiJudged: sum("high_ai_judged"), highAiWins: sum("high_ai_win"),
      highAiLosses: sum("high_ai_lose"),
    };
  });
  const bestWeek = weekRows.filter((row) => int(row.win) + int(row.lose) >= 30)
    .sort((a, b) => (rate(int(b.win), int(b.lose)) ?? -1) - (rate(int(a.win), int(a.lose)) ?? -1))[0];
  const bestSlot = [...slotTotals].filter((row) => row.judged >= 30 && row.dayCount >= 10)
    .sort((a, b) => (rate(b.wins, b.losses) ?? -1) - (rate(a.wins, a.losses) ?? -1))[0];
  const bestReturnSlot = [...slotTotals].filter((row) => row.judged >= 30 && row.dayCount >= 10)
    .sort((a, b) => (b.avgChange ?? -Infinity) - (a.avgChange ?? -Infinity))[0];

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/learning-status" className="text-sm font-bold text-blue-600 dark:text-blue-400">← 学習管理に戻る</Link>
        <h1 className="mt-3 text-2xl font-black">🏆 SIGNALX ゴールデンゾーン分析</h1>
        <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
          管理者専用・観察モード。既存AI POWER、通知、売買には一切影響しません。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs text-slate-500">曜日別の最高勝率</p>
            <p className="mt-1 text-xl font-black">{bestWeek ? `${WEEKDAYS[bestWeek.weekday - 1]}曜日` : "検証中"}</p>
            <p className="text-sm font-bold text-emerald-600">{bestWeek ? pct(rate(int(bestWeek.win), int(bestWeek.lose))) : "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs text-slate-500">時間帯の最高勝率（±2%、HOLD除外）</p>
            <p className="mt-1 text-xl font-black">{bestSlot ? bestSlot.slot : "データ収集中"}</p>
            <p className="text-sm font-bold text-emerald-600">{bestSlot ? pct(rate(bestSlot.wins, bestSlot.losses)) : "—"}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 sm:col-span-1 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs text-slate-500">翌日平均騰落率トップ（HOLD含む）</p>
            <p className="mt-1 text-xl font-black">{bestReturnSlot ? bestReturnSlot.slot : "検証中"}</p>
            <p className="text-sm font-bold text-emerald-600">{bestReturnSlot ? pct(bestReturnSlot.avgChange) : "—"}</p>
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
          <p className="mt-1 text-xs leading-5 text-slate-500">各時刻に保存できた銘柄だけを翌取引日の保存価格と比較（+2%以上WIN / -2%以下LOSE / それ以外HOLD）。保存価格は終値・約定価格とは限りません。</p>
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
          <p className="mt-2 text-xs text-slate-500">時刻は観測点であり、時間帯全体を測ったものではありません。確定30件・10取引日未満のマスは「—」表示。サンプル不足なら優劣を断定しません。</p>
        </section>
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">📊 時間帯別まとめ</h2>
          <p className="mt-1 text-xs text-slate-500">新規観測 {totalSamples.toLocaleString()}件 / 翌営業日判定 {settledSamples.toLocaleString()}件</p>
          <div className="mt-3 space-y-2">
            {slotTotals.map((row) => {
              const ready = status(row.judged, row.dayCount) === "参考統計";
              return <div key={row.slot} className="rounded-lg bg-slate-50 px-3 py-3 text-sm dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black">{row.slot} <span className="text-xs font-medium text-slate-500 dark:text-slate-300">{SLOT_HINTS[row.slot]}</span></span>
                  <span className="text-xs text-slate-500 dark:text-slate-300">{row.judged}/{row.total}件判定・{row.dayCount}日・{status(row.judged, row.dayCount)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs sm:grid-cols-4">
                  <span>±2%勝率 <b className="tabular-nums">{ready ? pct(rate(row.wins, row.losses)) : "—"}</b></span>
                  <span>平均騰落 <b className="tabular-nums">{ready ? pct(row.avgChange) : "—"}</b></span>
                  <span>100株平均損益 <b className="tabular-nums">{ready ? signedYen(row.avgHundredSharePnl) : "—"}</b></span>
                  <span>100株最悪例 <b className="tabular-nums">{ready ? signedYen(row.worstHundredSharePnl) : "—"}</b></span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                  暫定参考：上昇 {row.up}/{row.judged}件（{row.judged ? pct(100 * row.up / row.judged) : "—"}）・±2%方向一致 {row.wins}/{row.wins + row.losses}件（{pct(rate(row.wins, row.losses))}、HOLD除外）。{ready ? "必要日数を満たしています。" : "観測日数が不足しているため優劣は未判定です。"}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                  WIN {row.wins} / LOSE {row.losses} / HOLD {row.holds} ・AI POWER 80以上:
                  {row.highAiJudged}件（±2%勝率 {row.highAiJudged >= 30 && ready ? pct(rate(row.highAiWins, row.highAiLosses)) : "収集中"}）
                </p>
              </div>;
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">「上昇率」は翌営業日の保存参考価格が観測価格を上回った件数の割合で、±2%勝率とは異なります。暫定参考値は研究条件の採用根拠にしません。100株損益は観測価格と翌営業日の保存価格の差を100倍した仮定の数値で、実際に約定できる価格・利益ではありません。手数料・税金・スリッページは未考慮。サンプルはスキャン上位最大30銘柄で無作為抽出ではなく、同じ銘柄の複数時刻観測も含むため独立した試行ではありません。過去実績は将来の成績を保証しません。</p>
          <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">観測は既存の幅広いスキャンの保存データを再利用します。新鮮なスキャンが存在しない時刻や休場日は自動でスキップするため、スケジュール追加後も空欄になることがあります。売買・通知・AI POWERへの反映はありません。</p>
        </section>
      </div>
    </main>
  );
}
