import { STOCKS } from "@/app/lib/stockList";
import { getSectorKey, sectorLabelMap } from "@/app/lib/sectorMap";


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


export { recognizedCodes, weeksForNow, rank, percent, sectorFor, aggregate };
export type { ResultRow, RankedSector };
