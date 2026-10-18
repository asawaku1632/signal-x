/**
 * CRASH_STRENGTH_SHADOW_V1 — pure, read-only research.
 * No scoring, notifications, writes, live order execution, or future price requests.
 * All outcomes use SAVED daily reference prices (not executable fills).
 */
export const CRASH_STRENGTH_VERSION = "CRASH_STRENGTH_SHADOW_V1";
export const CRASH_DROP_THRESHOLD = -2;
export const MIN_STOCK_COVERAGE = 800;
const MAX_STOCK_COVERAGE = 1500;
const MAX_DISPLAY = 20;
const validDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const validPrice = (v) => v !== null && v !== "" && Number.isFinite(Number(v)) && Number(v) > 0;
const round = (v) => Math.round(v * 100) / 100;
const change = (before, after) => round((after / before - 1) * 100);
const average = (items) => items.reduce((sum, x) => sum + x, 0) / items.length;

function makePriceDays(priceRows, asOf) {
  const days = new Map();
  for (const row of priceRows) {
    const date = String(row.date ?? "").slice(0, 10);
    const code = String(row.code ?? "");
    if (!validDate(date) || date >= asOf || !/^[0-9]{4}$/.test(code) || !validPrice(row.price)) continue;
    if (!days.has(date)) days.set(date, new Map());
    // Caller supplies newest stored revision first for duplicate date+code.
    if (!days.get(date).has(code)) {
      days.get(date).set(code, { code, name: String(row.name || code), price: Number(row.price) });
    }
  }
  for (const [date, stocks] of days) {
    if (stocks.size < MIN_STOCK_COVERAGE || stocks.size > MAX_STOCK_COVERAGE) days.delete(date);
  }
  const dates = [...days.keys()].sort();
  return { days, dates, position: new Map(dates.map((date, index) => [date, index])) };
}

function shockEvents(marketRows, priceDays, asOf) {
  const marketsByDate = new Map();
  for (const r of marketRows) {
    const date = String(r.date ?? "").slice(0, 10);
    if (validDate(date) && date < asOf && !marketsByDate.has(date)) marketsByDate.set(date, r);
  }
  const markets = [...marketsByDate].sort(([a], [b]) => a.localeCompare(b));
  const events = [];
  for (let i = 1; i < markets.length; i++) {
    const [previousDate, previous] = markets[i - 1];
    const [date, current] = markets[i];
    const indexOf = priceDays.position.get(date);
    // Explicitly reject missing/incomplete daily stock snapshots.
    if (indexOf === undefined || indexOf < 1 || priceDays.dates[indexOf - 1] !== previousDate) continue;
    // Reject abnormally long market gaps, which can represent stale data.
    if ((Date.parse(date) - Date.parse(previousDate)) / 86400000 > 6) continue;
    const nikkei = validPrice(previous.nikkei) && validPrice(current.nikkei)
      ? change(Number(previous.nikkei), Number(current.nikkei)) : null;
    const topix = validPrice(previous.topix) && validPrice(current.topix)
      ? change(Number(previous.topix), Number(current.topix)) : null;
    if (!((nikkei !== null && nikkei <= CRASH_DROP_THRESHOLD) ||
          (topix !== null && topix <= CRASH_DROP_THRESHOLD))) continue;
    // TOPIX represents more of the full equity market; use it if present.
    const benchmark = topix !== null ? "TOPIX" : "日経平均";
    events.push({ date, previousDate, benchmark, indexReturn: topix ?? nikkei,
      nikkeiReturn: nikkei, topixReturn: topix });
  }
  return events;
}

function buildEventStocks(event, priceDays) {
  const index = priceDays.position.get(event.date);
  if (index === undefined) return [];
  const today = priceDays.days.get(event.date);
  const previous = priceDays.days.get(event.previousDate);
  if (!today || !previous) return [];
  const output = [];
  for (const stock of today.values()) {
    const before = previous.get(stock.code);
    if (!before) continue;
    const dailyReturn = change(before.price, stock.price);
    const forwardReturn = (horizon) => {
      const futureDate = priceDays.dates[index + horizon];
      const future = futureDate ? priceDays.days.get(futureDate)?.get(stock.code) : null;
      return future && future.price > 0 ? change(stock.price, future.price) : null;
    };
    output.push({code: stock.code, name: stock.name, price: stock.price,
      cost100: round(stock.price * 100), dailyReturn,
      excessReturn: round(dailyReturn - event.indexReturn),
      after1: forwardReturn(1), after3: forwardReturn(3), after5: forwardReturn(5)});
  }
  return output;
}

function historyByCode(events, priceDays, latestDate) {
  const histories = new Map();
  const bucket = { strong: { returns: [], dates: new Set() }, weak: { returns: [], dates: new Set() } };
  for (const event of events) {
    if (event.date >= latestDate) continue;
    const idx = priceDays.position.get(event.date);
    // Prevent using results that were not yet knowable when latest signal fired.
    if (idx === undefined || !priceDays.dates[idx + 1] || priceDays.dates[idx + 1] >= latestDate) continue;
    for (const item of buildEventStocks(event, priceDays)) {
      const side = item.excessReturn >= 1.5 ? "strong" : item.excessReturn <= -1.5 ? "weak" : null;
      if (side === null || item.after1 === null) continue;
      bucket[side].returns.push(item.after1);
      bucket[side].dates.add(event.date);
      const key = side + ":" + item.code;
      if (!histories.has(key)) histories.set(key, []);
      histories.get(key).push(item.after1);
    }
  }
  const stats = (values) => ({
    sampleCount: values.length,
    // Per-stock historic 1-day estimates are withheld until 5 separate crashes.
    average1: values.length >= 5 ? round(average(values)) : null,
    positiveRate1: values.length >= 5 ? round(values.filter(v => v > 0).length / values.length * 100) : null
  });
  return {
    individual: histories,
    groups: Object.fromEntries(Object.entries(bucket).map(([side, b]) => [side, {
      eventCount: b.dates.size,
      sampleCount: b.returns.length,
      average1: b.dates.size >= 5 && b.returns.length >= 30 ? round(average(b.returns)) : null,
      positiveRate1: b.dates.size >= 5 && b.returns.length >= 30
        ? round(b.returns.filter(v => v > 0).length / b.returns.length * 100) : null
    }])),
    stats
  };
}

export function analyzeCrashStrength({ marketRows = [], priceRows = [], asOf }) {
  if (!validDate(asOf)) throw new Error("INVALID_AS_OF_DATE");
  const priceDays = makePriceDays(priceRows, asOf);
  const events = shockEvents(marketRows, priceDays, asOf);
  const coverage = { validSavedDays: priceDays.dates.length, minimumStocksPerDay: MIN_STOCK_COVERAGE,
    latestSavedDate: priceDays.dates.at(-1) ?? null, source: "daily_stock_results.price / market_learning_logs" };
  if (events.length === 0) return {
    version: CRASH_STRENGTH_VERSION, asOf, coverage, event: null, eventCount: 0,
    strong: [], weak: [], historical: null, note: "条件を満たす保存済み急落日はありません。"
  };
  const event = events.at(-1);
  const histories = historyByCode(events, priceDays, event.date);
  const candidates = buildEventStocks(event, priceDays);
  const withHistory = (stock, side) => ({
    ...stock, historical1: histories.stats(histories.individual.get(side + ":" + stock.code) ?? [])
  });
  const strong = candidates.filter(r => r.excessReturn >= 0.5)
    .sort((a, b) => b.excessReturn - a.excessReturn || a.code.localeCompare(b.code))
    .slice(0, MAX_DISPLAY).map(r => withHistory(r, "strong"));
  const weak = candidates.filter(r => r.excessReturn <= -0.5)
    .sort((a, b) => a.excessReturn - b.excessReturn || a.code.localeCompare(b.code))
    .slice(0, MAX_DISPLAY).map(r => withHistory(r, "weak"));
  return {
    version: CRASH_STRENGTH_VERSION, asOf, coverage, event, eventCount: events.length,
    examinedStocks: candidates.length, strong, weak, historical: histories.groups,
    note: "強弱は急落当日の市場相対騰落率です。翌日予測・売買推奨ではありません。翌日/3日/5日の成績は保存済み株価の事後観測です。"
  };
}
