import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";

// The weekly view only reads existing sector learning logs.
// It does not change AI judgement, trading signals, or notifications.
type SummaryRow = {
  period: "previous" | "latest";
  sector_key: string;
  sector_name: string;
  win: string | number | null;
  lose: string | number | null;
  hold: string | number | null;
  observed_days: number | string;
  last_trade_date: string;
};

type SectorStats = {
  sectorKey: string;
  sectorName: string;
  win: number;
  lose: number;
  hold: number;
  total: number;
  observedDays: number;
  lastTradeDate: string;
  winShare: number;
};

type RankedSector = SectorStats & {
  score: number;
  delta: number | null;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getReportWeeks() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const today = new Date(Date.UTC(
    Number(part("year")),
    Number(part("month")) - 1,
    Number(part("day")),
  ));
  const day = today.getUTCDay();
  const thisMonday = addDays(today, -((day + 6) % 7));
  // Saturday/Sunday: publish the week that just ended.
  // Weekdays: continue showing the report issued the preceding weekend.
  const sourceMonday = day === 0 || day === 6
    ? thisMonday
    : addDays(thisMonday, -7);
  const previousMonday = addDays(sourceMonday, -7);
  const followingMonday = addDays(sourceMonday, 7);
  const targetSunday = addDays(followingMonday, 6);
  return {
    previousStart: isoDate(previousMonday),
    sourceStart: isoDate(sourceMonday),
    sourceEnd: isoDate(addDays(followingMonday, -1)),
    targetStart: isoDate(followingMonday),
    targetEnd: isoDate(targetSunday),
  };
}

function toStats(row: SummaryRow): SectorStats {
  const win = Number(row.win ?? 0);
  const lose = Number(row.lose ?? 0);
  const hold = Number(row.hold ?? 0);
  const total = win + lose + hold;
  return {
    sectorKey: row.sector_key,
    sectorName: row.sector_name,
    win,
    lose,
    hold,
    total,
    observedDays: Number(row.observed_days ?? 0),
    lastTradeDate: row.last_trade_date,
    winShare: total > 0 ? (win / total) * 100 : 0,
  };
}

function rankSectors(rows: SummaryRow[]) {
  const previous = new Map(
    rows.filter((row) => row.period === "previous")
      .map((row) => [row.sector_key, toStats(row)]),
  );
  return rows
    .filter((row) => row.period === "latest")
    .map(toStats)
    .filter((sector) =>
      sector.sectorKey !== "OTHER" &&
      sector.sectorName !== "その他" &&
      sector.total >= 10 &&
      sector.observedDays >= 2
    )
    .map((sector): RankedSector => {
      const baseline = previous.get(sector.sectorKey);
      const delta = baseline && baseline.total >= 10 && baseline.observedDays >= 2
        ? sector.winShare - baseline.winShare
        : null;
      // Shrink sparse WIN ratios toward 50%, and cap the momentum adjustment.
      // This is a ranking index, NEVER a probability of a stock price increase.
      const smoothed = ((sector.win + 5) / (sector.total + 10)) * 100;
      const momentum = delta === null ? 0 : Math.max(-8, Math.min(8, delta * 0.2));
      const score = Math.round(Math.max(0, Math.min(100, smoothed + momentum)));
      return { ...sector, score, delta };
    })
    .sort((a, b) => b.score - a.score || b.total - a.total || a.sectorKey.localeCompare(b.sectorKey))
    .slice(0, 3);
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}pt`;
}

export default async function WeeklySectorReportPage() {
  const weeks = getReportWeeks();
  let ranking: RankedSector[] = [];
  let failed = false;
  let sectorCount = 0;

  try {
    const { rows } = await pool.query<SummaryRow>(`
      SELECT
        CASE WHEN trade_date < $2::date THEN 'previous' ELSE 'latest' END AS period,
        sector_key,
        MAX(sector_name) AS sector_name,
        SUM(COALESCE(win_count, 0))::bigint AS win,
        SUM(COALESCE(lose_count, 0))::bigint AS lose,
        SUM(COALESCE(hold_count, 0))::bigint AS hold,
        COUNT(DISTINCT trade_date)::int AS observed_days,
        MAX(trade_date)::text AS last_trade_date
      FROM sector_learning_logs
      WHERE trade_date >= $1::date AND trade_date < $3::date
      GROUP BY 1, 2
    `, [weeks.previousStart, weeks.sourceStart, weeks.targetStart]);
    sectorCount = rows.filter((row) => row.period === "latest").length;
    ranking = rankSectors(rows);
  } catch (error) {
    console.error("weekly sector report read failed:", error);
    failed = true;
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-28 text-slate-900">
      <div className="mx-auto max-w-md px-3 pt-3 lg:max-w-3xl lg:px-6">
        <header className="flex items-center gap-3">
          <Link href="/dashboard" className="grid h-9 w-9 place-items-center rounded-full bg-white shadow" aria-label="ホームに戻る">‹</Link>
          <div>
            <p className="text-[10px] font-black tracking-[.16em] text-blue-600">SIGNALX WEEKLY SECTOR</p>
            <h1 className="text-xl font-black">📊 来週の注目セクター TOP3</h1>
          </div>
        </header>

        <section className="mt-3 rounded-2xl bg-gradient-to-r from-slate-900 to-blue-800 p-4 text-white">
          <p className="text-[10px] font-black text-blue-200">毎週土曜に対象週を自動切替・試験版</p>
          <p className="mt-2 text-xl font-black">{weeks.targetStart} 〜 {weeks.targetEnd}</p>
          <p className="mt-1 text-xs font-bold text-blue-100">
            判定に使用した期間：{weeks.sourceStart} 〜 {weeks.sourceEnd}
          </p>
          <p className="mt-2 text-[11px] leading-5 text-blue-100">
            SIGNALXの保存済みセクター学習データから、翌週に注目する候補を自動表示します。
          </p>
        </section>

        {failed ? (
          <section className="mt-3 rounded-xl border border-rose-200 bg-white p-4 text-sm font-bold text-rose-700">
            データを取得できませんでした。時間をおいて再表示してください。
          </section>
        ) : ranking.length === 0 ? (
          <section className="mt-3 rounded-xl border bg-white p-4">
            <h2 className="font-black">今週の候補はまだありません</h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              学習データが不足しています。2取引日以上・10判定以上のセクターが揃ったら自動表示します。
              現在の保存対象セクター：{sectorCount}件。
            </p>
          </section>
        ) : (
          <section className="mt-3 space-y-2" aria-label="週次注目セクター">
            {ranking.map((sector, index) => (
              <article key={sector.sectorKey} className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500">注目候補 {index + 1}位</p>
                    <h2 className="mt-0.5 text-lg font-black">{medals[index]} {sector.sectorName}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500">参考スコア</p>
                    <p className="text-2xl font-black text-blue-700">{sector.score}<span className="text-xs"> / 100</span></p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-500">先週のWIN割合</p>
                    <p className="mt-1 text-sm font-black">{sector.winShare.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-500">前週比</p>
                    <p className="mt-1 text-sm font-black">{sector.delta === null ? "比較なし" : signed(sector.delta)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-500">学習判定数</p>
                    <p className="mt-1 text-sm font-black">{sector.total.toLocaleString("ja-JP")}</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-600">
                  直近の記録：{sector.observedDays}日間、WIN {sector.win} / LOSE {sector.lose} / HOLD {sector.hold}。
                  相対的に注目する候補であり、来週の上昇を保証しません。
                </p>
              </article>
            ))}
          </section>
        )}

        <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <h2 className="text-xs font-black text-amber-900">⚠️ スコアの見方</h2>
          <p className="mt-1 text-[11px] leading-5 text-amber-950">
            これは保存済み学習ログのWIN・LOSE・HOLDを利用した試験的な相対スコアです。
            業種指数の騰落率、実際の資金流入、上昇確率を直接測ったものではありません。
            現在のセクター分類には未分類銘柄もあるため、投資判断には株価・出来高・ニュースの再確認が必要です。
          </p>
        </section>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">
          過去予想を固定保存する機能と、その翌週の実績による答え合わせは次段階で追加予定です。
          この画面は保存済みデータを表示時に再集計し、相場への注文や通知は一切実行しません。
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
