import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import { STOCKS } from "@/app/lib/stockList";
import { getSectorKey, sectorLabelMap } from "@/app/lib/sectorMap";

export const dynamic = "force-dynamic";

// Read-only experiment. Never alters model decisions, saved prices, or alerts.
// We deliberately use evaluated daily_stock_results rather than sector_learning_logs:
// current sector logs have no populated WIN / LOSE / HOLD counts.
type ResultRow = {
  date: string;
  code: string;
  name: string;
  result: "WIN" | "LOSE" | "HOLD";
  change_percent: number | null;
};
type StockSample = { code: string; name: string; total: number; sum: number; priced: number };
type Summary = {
  key: string;
  name: string;
  win: number;
  lose: number;
  hold: number;
  sumChange: number;
  priced: number;
  dates: Set<string>;
  codes: Set<string>;
  stocks: Map<string, StockSample>;
};
type RankedSector = {
  key: string;
  name: string;
  total: number;
  wins: number;
  losses: number;
  holds: number;
  tradeDays: number;
  codeCount: number;
  avgChange: number;
  previousAvg: number | null;
  score: number;
  examples: { code: string; name: string; average: number }[];
};

const extraSectors: Record<string, { key: string; name: string }> = {
  "9101": { key: "SHIPPING", name: "海運" },
  "9104": { key: "SHIPPING", name: "海運" },
  "9107": { key: "SHIPPING", name: "海運" },
  "7011": { key: "DEFENSE", name: "防衛・重工" },
  "7012": { key: "DEFENSE", name: "防衛・重工" },
  "7013": { key: "DEFENSE", name: "防衛・重工" },
};

function sectorFor(code: string) {
  if (extraSectors[code]) return extraSectors[code];
  const key = getSectorKey(code);
  return key === "OTHER" ? null : { key, name: sectorLabelMap[key] };
}
const recognizedCodes = [...new Set(STOCKS.map((s) => s.code).filter((code) => sectorFor(code) !== null))];

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
function iso(date: Date) { return date.toISOString().slice(0, 10); }
function weeksForNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const today = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  const weekday = today.getUTCDay();
  const monday = addDays(today, -((weekday + 6) % 7));
  // Change report week on Saturday; keep the same issue displayed during weekdays.
  const source = weekday === 0 || weekday === 6 ? monday : addDays(monday, -7);
  const next = addDays(source, 7);
  return {
    previousStart: iso(addDays(source, -7)),
    sourceStart: iso(source),
    sourceEnd: iso(addDays(next, -1)),
    targetStart: iso(next),
    targetEnd: iso(addDays(next, 6)),
  };
}

function createSummary(key: string, name: string): Summary {
  return { key, name, win: 0, lose: 0, hold: 0, sumChange: 0, priced: 0, dates: new Set(), codes: new Set(), stocks: new Map() };
}
function aggregate(rows: ResultRow[]) {
  const sectors = new Map<string, Summary>();
  for (const row of rows) {
    const category = sectorFor(row.code);
    if (!category) continue;
    const item = sectors.get(category.key) ?? createSummary(category.key, category.name);
    item.dates.add(row.date);
    item.codes.add(row.code);
    if (row.result === "WIN") item.win++;
    else if (row.result === "LOSE") item.lose++;
    else item.hold++;
    const sample = item.stocks.get(row.code) ?? {
      code: row.code, name: row.name, total: 0, sum: 0, priced: 0,
    };
    sample.total++;
    if (row.change_percent !== null && Number.isFinite(Number(row.change_percent))) {
      const change = Number(row.change_percent);
      item.sumChange += change;
      item.priced++;
      sample.sum += change;
      sample.priced++;
    }
    item.stocks.set(row.code, sample);
    sectors.set(category.key, item);
  }
  return sectors;
}
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

function rank(rows: ResultRow[], sourceStart: string) {
  const previous = aggregate(rows.filter((r) => r.date < sourceStart));
  const latest = aggregate(rows.filter((r) => r.date >= sourceStart));
  const ranked = Array.from(latest.values())
    .filter((s) => s.priced >= 10 && s.dates.size >= 2 && s.codes.size >= 2)
    .map((s): RankedSector => {
      const earlier = previous.get(s.key);
      const previousAvg = earlier && earlier.priced >= 10 ? earlier.sumChange / earlier.priced : null;
      const avgChange = s.sumChange / s.priced;
      const total = s.win + s.lose + s.hold;
      const netWin = total > 0 ? (s.win - s.lose) / total : 0;
      const momentum = previousAvg === null ? 0 : clamp((avgChange - previousAvg) * 4, -8, 8);
      // Relative watchlist index, not a future return or probability.
      const score = Math.round(clamp(50 + (avgChange * 8 + netWin * 20 + momentum) * Math.min(1, Math.sqrt(s.priced / 30)), 0, 100));
      const examples = Array.from(s.stocks.values())
        .filter((stock) => stock.priced >= 2)
        .sort((a, b) => b.sum / b.priced - a.sum / a.priced)
        .slice(0, 2)
        .map((stock) => ({ code: stock.code, name: stock.name, average: stock.sum / stock.priced }));
      return {
        key: s.key, name: s.name, total, wins: s.win, losses: s.lose, holds: s.hold,
        tradeDays: s.dates.size, codeCount: s.codes.size,
        avgChange, previousAvg, score, examples,
      };
    })
    .sort((a, b) => b.score - a.score || b.total - a.total || a.key.localeCompare(b.key));
  return { ranked: ranked.slice(0, 3), eligible: ranked.length };
}

function percent(value: number) { return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`; }

export default async function WeeklySectorReportPage() {
  const week = weeksForNow();
  let sectors: RankedSector[] = [];
  let eligible = 0;
  let latestDataDate: string | null = null;
  let error = false;
  try {
    // 'date' is an ISO yyyy-mm-dd TEXT column. Only finished outcomes are included.
    const { rows } = await pool.query<ResultRow>(`
      SELECT date, code, name, result, change_percent
      FROM daily_stock_results
      WHERE date >= $1 AND date < $2
        AND code = ANY($3::text[])
        AND result IN ('WIN','LOSE','HOLD')
      ORDER BY date
    `, [week.previousStart, week.targetStart, recognizedCodes]);
    const sourceRows = rows.filter((row) => row.date >= week.sourceStart);
    latestDataDate = sourceRows.length ? sourceRows[sourceRows.length - 1].date : null;
    ({ ranked: sectors, eligible } = rank(rows, week.sourceStart));
  } catch (cause) {
    console.error("weekly sector sample failed:", cause);
    error = true;
  }
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-28 text-slate-900">
      <div className="mx-auto max-w-md px-3 pt-3 lg:max-w-3xl lg:px-6">
        <header className="flex items-center gap-3">
          <Link href="/dashboard" className="grid h-9 w-9 place-items-center rounded-full bg-white shadow" aria-label="ホームに戻る">‹</Link>
          <div>
            <p className="text-[10px] font-black tracking-[.16em] text-blue-600">SIGNALX WEEKLY SECTOR</p>
            <h1 className="text-xl font-black">🔮 来週の注目セクター TOP3</h1>
          </div>
        </header>

        <section className="mt-3 rounded-2xl bg-gradient-to-r from-slate-900 to-blue-800 p-4 text-white">
          <p className="text-[10px] font-black text-blue-200">毎週土曜に対象週を自動切替・試験版</p>
          <p className="mt-2 text-xl font-black">{week.targetStart} 〜 {week.targetEnd}</p>
          <p className="mt-1 text-xs font-bold text-blue-100">参照週：{week.sourceStart} 〜 {week.sourceEnd}</p>
          <p className="mt-1 text-xs font-bold text-blue-100">判定済みの最新データ：{latestDataDate ?? "なし"}</p>
          <p className="mt-2 text-[11px] leading-5 text-blue-100">
            代表銘柄の翌営業日実績から、次の週に確認したいセクターを自動抽出します。
          </p>
        </section>

        {error ? (
          <section className="mt-3 rounded-xl border border-rose-200 bg-white p-4 text-sm font-bold text-rose-700">
            データを取得できませんでした。時間をおいて再表示してください。
          </section>
        ) : sectors.length === 0 ? (
          <section className="mt-3 rounded-xl border bg-white p-4">
            <h2 className="font-black">今週の候補はまだありません</h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              判定済みの銘柄データが不足しています。2営業日以上・10件以上の結果が揃うと表示されます。
            </p>
          </section>
        ) : (
          <section className="mt-3 space-y-2" aria-label="週次セクター注目候補">
            {sectors.map((sector, index) => (
              <article key={sector.key} className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500">参考候補 {index + 1}位</p>
                    <h2 className="mt-0.5 text-lg font-black">{medals[index]} {sector.name}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500">参考スコア</p>
                    <p className="text-2xl font-black text-blue-700">{sector.score}<span className="text-xs"> / 100</span></p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-500">翌営業日平均変化</p>
                    <p className="mt-1 text-sm font-black">{percent(sector.avgChange)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-500">前週との比較</p>
                    <p className="mt-1 text-sm font-black">{sector.previousAvg === null ? "比較なし" : percent(sector.avgChange - sector.previousAvg)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-500">判定済み</p>
                    <p className="mt-1 text-sm font-black">{sector.total.toLocaleString("ja-JP")}件</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-600">
                  対象{sector.codeCount}銘柄／{sector.tradeDays}取引日、WIN {sector.wins}・LOSE {sector.losses}・HOLD {sector.holds}。
                </p>
                {sector.examples.length > 0 && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="mb-1 text-[10px] font-bold text-slate-500">対象の参考銘柄（保存済み実績順・買い推奨ではありません）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sector.examples.map((stock) => (
                        <Link href={`/analysis/${stock.code}`} key={stock.code} className="rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] font-black text-blue-700">
                          {stock.code} {stock.name} ›
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <h2 className="text-xs font-black text-amber-900">⚠️ 試験版の注意点</h2>
          <p className="mt-1 text-[11px] leading-5 text-amber-950">
            代表銘柄の保存済み翌営業日結果を使った相対指標です。全上場銘柄を網羅する業種指数ではなく、
            実際の資金流入量・来週の上昇確率も表しません。保存価格の監査も継続中です。
            市場ニュース・出来高・株価を確認し、単独では売買判断に使わないでください。
          </p>
        </section>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">
          現在の集計対象は分類できた代表銘柄のみ（{recognizedCodes.length}コード、条件を満たす{eligible}セクター）。
          予測時点の履歴を固定保存し、翌週に答え合わせする機能は今後の追加対象です。
          この画面は閲覧時に再集計するだけで、売買判定・通知・元データは変更しません。
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
