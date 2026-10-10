import { isTseTradingDate } from "@/app/lib/technicalObservation/tseMarketCalendar";

export type DailyClose = { date: string; close: number; barTime: number };
export type FrozenSector = { key: string; name: string; score: number; codes?: string[] };
export type StockEvidence = {
  code: string;
  baselineClose: number;
  endClose: number;
  returnPercent: number;
  baselineBarAt: string;
  endBarAt: string;
};
export type SectorOutcome = {
  sectorKey: string;
  sectorName: string;
  rank: number;
  forecastScore: number;
  status: "COMPLETE" | "INCOMPLETE";
  averageReturnPercent: number | null;
  hit: boolean | null;
  expected: number;
  matched: number;
  missingCodes: string[];
  stocks: StockEvidence[];
};

function dateShift(date: string, days: number) {
  const source = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(source)) throw new Error("INVALID_DATE");
  return new Date(source + days * 86_400_000).toISOString().slice(0, 10);
}

export function weeklyPriceDates(start: string, end: string) {
  if (!/^20\d\d-\d\d-\d\d$/.test(start) || !/^20\d\d-\d\d-\d\d$/.test(end) ||
      !Number.isFinite(Date.parse(start + "T00:00:00Z")) ||
      !Number.isFinite(Date.parse(end + "T00:00:00Z")) ||
      end <= start) throw new Error("INVALID_FORECAST_WEEK");
  // Final pre-issue TSE close, versus final TSE close of forecast week.
  let baseline: string | null = null;
  let finish: string | null = null;
  for (let i = 1; i <= 10; i++) {
    const candidate = dateShift(start, -i);
    if (isTseTradingDate(candidate)) { baseline = candidate; break; }
  }
  for (let i = 0; i <= 10; i++) {
    const candidate = dateShift(end, -i);
    if (candidate < start) break;
    if (isTseTradingDate(candidate)) { finish = candidate; break; }
  }
  if (!baseline || !finish || finish <= baseline) throw new Error("MARKET_DATES_UNAVAILABLE");
  return { baseline, finish };
}

export function evaluateSector(
  sector: FrozenSector,
  rank: number,
  quotes: ReadonlyMap<string, readonly DailyClose[]>,
  baseline: string,
  finish: string,
): SectorOutcome {
  const codes = sector.codes && sector.codes.length >= 2
    ? [...new Set(sector.codes)].filter((code) => /^[0-9]{4}$/.test(code)).sort()
    : [];
  const stocks: StockEvidence[] = [];
  const missingCodes: string[] = [];
  for (const code of codes) {
    const bars = quotes.get(code) ?? [];
    const begin = bars.filter((bar) => bar.date === baseline && Number.isFinite(bar.close) && bar.close > 0);
    const end = bars.filter((bar) => bar.date === finish && Number.isFinite(bar.close) && bar.close > 0);
    if (begin.length !== 1 || end.length !== 1) { missingCodes.push(code); continue; }
    const b = begin[0], e = end[0];
    const returnPercent = 100 * (e.close / b.close - 1);
    if (!Number.isFinite(returnPercent)) { missingCodes.push(code); continue; }
    stocks.push({
      code, baselineClose: b.close, endClose: e.close,
      returnPercent: Number(returnPercent.toFixed(4)),
      baselineBarAt: new Date(b.barTime * 1000).toISOString(),
      endBarAt: new Date(e.barTime * 1000).toISOString(),
    });
  }
  // No cherry-picking winners: an outcome is graded ONLY if every frozen member
  // has BOTH expected daily bars. Never substitute a later week's last price.
  const complete = codes.length >= 2 && missingCodes.length === 0;
  const averageReturnPercent = complete
    ? Number((stocks.reduce((total, s) => total + s.returnPercent, 0) / stocks.length).toFixed(4))
    : null;
  return {
    sectorKey: sector.key, sectorName: sector.name, rank,
    forecastScore: sector.score,
    status: complete ? "COMPLETE" : "INCOMPLETE",
    averageReturnPercent,
    hit: averageReturnPercent === null ? null : averageReturnPercent > 0,
    expected: codes.length, matched: stocks.length, missingCodes, stocks,
  };
}
