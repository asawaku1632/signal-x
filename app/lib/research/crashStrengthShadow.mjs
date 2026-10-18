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

/**
 * Only dates confirmed by an actual market daily bar count as Japanese stock
 * sessions. When Nikkei is available it is the calendar authority; otherwise
 * TOPIX is the fallback. A saved holiday/duplicated reference price is not an
 * extra trading session. Do not edit or delete those original observations.
 */
function tradingReferenceDates(marketRows, asOf) {
  const rows = new Map();
  for (const row of marketRows) {
    const date = String(row.date ?? "").slice(0, 10);
    if (!validDate(date) || date >= asOf) continue;
    const weekday = new Date(date + "T00:00:00Z").getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (!rows.has(date)) rows.set(date, {nikkei: false, topix: false});
    const item = rows.get(date);
    item.nikkei ||= validPrice(row.nikkei);
    item.topix ||= validPrice(row.topix);
  }
  const preferNikkei = [...rows.values()].some(x => x.nikkei);
  return [...rows].filter(([, data])=>preferNikkei ? data.nikkei : data.topix)
    .map(([date])=>date).sort();
}

function tradingPriceDays(saved, referenceDates) {
  const allowed = new Set(referenceDates);
  const dates = saved.dates.filter(date=>allowed.has(date));
  const days = new Map(dates.map(date=>[date,saved.days.get(date)]));
  return {days,dates,position:new Map(dates.map((date,i)=>[date,i])),
    excludedSavedDates: saved.dates.filter(date=>!allowed.has(date))};
}

function comparableMarketDays(marketRows, priceDays, referenceDates, asOf) {
  const marketsByDate = new Map();
  for (const r of marketRows) {
    const date = String(r.date ?? "").slice(0, 10);
    if (validDate(date) && date < asOf && !marketsByDate.has(date)) marketsByDate.set(date, r);
  }
  const markets = referenceDates.filter(date=>marketsByDate.has(date))
    .map(date=>[date, marketsByDate.get(date)]);
  const events = [];
  for (let i = 1; i < markets.length; i++) {
    const [previousDate, previous] = markets[i - 1];
    const [date, current] = markets[i];
    // Require actual full saved snapshots for both consecutive index trading
    // sessions; holiday snapshots never create an extra adjacency gap.
    if (!priceDays.days.has(previousDate) || !priceDays.days.has(date)) continue;
    // Reject abnormally long market gaps, which can represent stale data.
    if ((Date.parse(date) - Date.parse(previousDate)) / 86400000 > 6) continue;
    const nikkei = validPrice(previous.nikkei) && validPrice(current.nikkei)
      ? change(Number(previous.nikkei), Number(current.nikkei)) : null;
    const topix = validPrice(previous.topix) && validPrice(current.topix)
      ? change(Number(previous.topix), Number(current.topix)) : null;
    // Return aligned comparable days, not only crashes. The caller decides whether
    // the day belongs in the genuine crash history or routine relative-strength view.
    if (nikkei === null && topix === null) continue;
    // TOPIX represents more of the full equity market; use it if present.
    const benchmark = topix !== null ? "TOPIX" : "日経平均";
    events.push({ date, previousDate, benchmark, indexReturn: topix ?? nikkei,
      nikkeiReturn: nikkei, topixReturn: topix });
  }
  return events;
}

function buildEventStocks(event, priceDays, referenceDates) {
  const index = referenceDates.indexOf(event.date);
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
      // The Nth trading session comes from the market reference calendar,
      // not from saved stock dates (which may include holiday carry-forwards).
      const futureDate = referenceDates[index + horizon];
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

function historyByCode(events, priceDays, referenceDates, latestDate) {
  const histories = new Map();
  const bucket = { strong: { returns: [], dates: new Set() }, weak: { returns: [], dates: new Set() } };
  for (const event of events) {
    if (event.date >= latestDate) continue;
    const idx = referenceDates.indexOf(event.date);
    // Prevent using results that were not yet knowable when latest signal fired.
    const nextDate = idx < 0 ? null : referenceDates[idx + 1];
    if (!nextDate || nextDate >= latestDate || !priceDays.days.has(nextDate)) continue;
    for (const item of buildEventStocks(event, priceDays, referenceDates)) {
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

// Five separate and *completed* earlier crash episodes are the minimum required
// to publish per-stock historical rates. It is not a statistical guarantee.
export const MIN_NEXT_DAY_EPISODES = 5;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Strictly historical, as-of-the-selected-crash ranking.
 * Cohort: stocks actually present on the most recent saved shock day.
 * Features: ONLY distinct earlier completed shock episodes for that stock.
 * A "next day" is the immediately following dated market index bar, not
 * merely the next usable saved stock day (which could skip missing sessions).
 * The selected crash day's forward result is NEVER included in training, even
 * if the next stock snapshot has since been saved.
 */
function historicalNextDayEvidence(events, priceDays, referenceDates, marketRows) {
  const selected = events.at(-1);
  if (!selected) return null;
  const currentCohort = buildEventStocks(selected, priceDays, referenceDates);
  const histories = new Map();
  const relativeHistories = new Map();
  const nikkeiByDate = new Map(marketRows
    .filter(r=>validDate(String(r.date ?? "").slice(0,10)) && validPrice(r.nikkei))
    .map(r=>[String(r.date).slice(0,10), Number(r.nikkei)]));
  const following = new Map(referenceDates.map((date,i)=>[date,referenceDates[i+1] ?? null]));
  let settledEpisodes = 0;
  for (const event of events) {
    if (event.date >= selected.date) continue;
    const nextDate = following.get(event.date);
    // No future knowledge relative to the selected crash event.
    if (!nextDate || nextDate >= selected.date) continue;
    const next = priceDays.days.get(nextDate);
    if (!next) continue; // partial / missing stock-day snapshots are not substituted.
    settledEpisodes++;
    // Nikkei-only reference for apples-to-apples next-session excess return.
    // When either close is absent, retain absolute results but withhold
    // benchmark outperformance rather than replacing it with TOPIX.
    const nStart = nikkeiByDate.get(event.date);
    const nEnd = nikkeiByDate.get(nextDate);
    const nikkeiNext = validPrice(nStart) && validPrice(nEnd)
      ? change(nStart, nEnd) : null;
    for (const stock of buildEventStocks(event, priceDays, referenceDates)) {
      const endPrice = next.get(stock.code)?.price;
      if (!validPrice(endPrice)) continue;
      const return1 = change(stock.price, endPrice);
      if (!histories.has(stock.code)) histories.set(stock.code, []);
      histories.get(stock.code).push(return1);
      if (nikkeiNext !== null) {
        if (!relativeHistories.has(stock.code)) relativeHistories.set(stock.code, []);
        relativeHistories.get(stock.code).push({
          excess: round(return1 - nikkeiNext),
          outperformed: return1 > nikkeiNext,
          nikkeiReturn: nikkeiNext,
          stockReturn: return1,
        });
      }
    }
  }
  const analyzed = currentCohort.map(stock => {
    const returns = histories.get(stock.code) ?? [];
    const relative = relativeHistories.get(stock.code) ?? [];
    const outperformedCount = relative.filter(x=>x.outperformed).length;
    const benchmarkReady = relative.length >= MIN_NEXT_DAY_EPISODES;
    if (returns.length < MIN_NEXT_DAY_EPISODES) return null;
    const up = returns.filter(v => v > 0).length;
    const down = returns.filter(v => v < 0).length;
    return {
      code: stock.code, name: stock.name, referencePrice: stock.price,
      cost100: stock.cost100, latestShockReturn: stock.dailyReturn,
      latestRelativeReturn: stock.excessReturn,
      sampleCount: returns.length, upCount: up, downCount: down,
      positiveRate1: round(up / returns.length * 100),
      average1: round(average(returns)), median1: round(median(returns)),
      worst1: Math.min(...returns), best1: Math.max(...returns),
      benchmarkSampleCount: relative.length,
      outperformedCount,
      benchmarkBeatRate: benchmarkReady ? round(outperformedCount/relative.length*100) : null,
      benchmarkAverage1: benchmarkReady ? round(average(relative.map(x=>x.nikkeiReturn))) : null,
      benchmarkStockAverage1: benchmarkReady ? round(average(relative.map(x=>x.stockReturn))) : null,
      averageExcess1: benchmarkReady ? round(average(relative.map(x=>x.excess))) : null,
      worstExcess1: benchmarkReady ? Math.min(...relative.map(x=>x.excess)) : null,
    };
  }).filter(Boolean);
  const ascCode = (a,b) => a.code.localeCompare(b.code);
  const sortedStrong = [...analyzed].sort((a,b)=> b.positiveRate1-a.positiveRate1
    || b.average1-a.average1 || b.median1-a.median1
    || b.sampleCount-a.sampleCount || ascCode(a,b));
  const sortedWeak = [...analyzed].sort((a,b)=> a.positiveRate1-b.positiveRate1
    || a.average1-b.average1 || a.median1-b.median1
    || b.sampleCount-a.sampleCount || ascCode(a,b));
  const benchEligible = analyzed.filter(x=>x.benchmarkBeatRate !== null);
  const benchmarkLeaders = [...benchEligible].sort((a,b)=>
    b.benchmarkBeatRate-a.benchmarkBeatRate ||
    b.averageExcess1-a.averageExcess1 ||
    b.benchmarkSampleCount-a.benchmarkSampleCount || ascCode(a,b));
  const benchmarkLaggers = [...benchEligible].sort((a,b)=>
    a.benchmarkBeatRate-b.benchmarkBeatRate ||
    a.averageExcess1-b.averageExcess1 ||
    b.benchmarkSampleCount-a.benchmarkSampleCount || ascCode(a,b));

  // The most recent crash is NOT included in the historical rates above.
  // Replay its already-known next-day result separately, using only ranks
  // calculated as-of the crash date. These ranks are reconstructed now, NOT
  // contemporaneously stored predictions: do not call this live OOS proof.
  const selectedNextDate = following.get(selected.date);
  const selectedNext = selectedNextDate ? priceDays.days.get(selectedNextDate) : null;
  const selectedNStart = nikkeiByDate.get(selected.date);
  const selectedNEnd = selectedNextDate ? nikkeiByDate.get(selectedNextDate) : null;
  const replayIndexReturn = validPrice(selectedNStart) && validPrice(selectedNEnd)
    ? change(selectedNStart, selectedNEnd) : null;
  const replay = (entries) => {
    if (!selectedNext || replayIndexReturn === null) return null;
    const observed = entries.map(entry=>{
      const stock = currentCohort.find(x=>x.code===entry.code);
      const nextPrice = selectedNext.get(entry.code)?.price;
      if (!stock || !validPrice(nextPrice)) return null;
      const stockReturn = change(stock.price, nextPrice);
      return {
        code: entry.code, return1: stockReturn,
        excess1: round(stockReturn - replayIndexReturn),
        outperformed: stockReturn > replayIndexReturn,
      };
    }).filter(Boolean);
    if (!observed.length) return null;
    return {
      eligibleShown: entries.length, observedCount: observed.length,
      beatCount: observed.filter(x=>x.outperformed).length,
      beatRate: round(observed.filter(x=>x.outperformed).length/observed.length*100),
      averageExcess: round(average(observed.map(x=>x.excess1))),
    };
  };
  return {
    selectedDate: selected.date, settledPastEpisodes: settledEpisodes,
    cohortCount: currentCohort.length, eligibleCount: analyzed.length,
    minSamples: MIN_NEXT_DAY_EPISODES,
    leaders: sortedStrong.slice(0,MAX_DISPLAY),
    laggers: sortedWeak.slice(0,MAX_DISPLAY),
    benchmarkEligibleCount: benchEligible.length,
    benchmarkLeaders: benchmarkLeaders.slice(0,MAX_DISPLAY),
    benchmarkLaggers: benchmarkLaggers.slice(0,MAX_DISPLAY),
    retrospectiveReplay: {
      status: !selectedNextDate || !selectedNext || replayIndexReturn === null
        ? "PENDING_REFERENCE_OR_PRICES" : "RETROSPECTIVE_ONLY",
      nextSessionDate: selectedNextDate ?? null,
      indexReturn1: replayIndexReturn,
      leaders: replay(benchmarkLeaders.slice(0,MAX_DISPLAY)),
      laggers: replay(benchmarkLaggers.slice(0,MAX_DISPLAY)),
    },
    note: "過去の独立した急落日だけを集計。日経平均を上回った割合は、株と日経平均の両方が確定している回のみ計算。最新急落日の結果は過去勝率に混ぜません。事後再現は実際に事前保存された予測ではありません。"
  };
}

/**
 * @param {{
 *   marketRows?: Array<{ date: string, nikkei?: number|string|null, topix?: number|string|null }>,
 *   priceRows?: Array<{ date: string, code: string, name?: string, price: number|string|null }>,
 *   asOf: string
 * }} input
 */
export function analyzeCrashStrength({ marketRows = [], priceRows = [], asOf }) {
  if (!validDate(asOf)) throw new Error("INVALID_AS_OF_DATE");
  const saved = makePriceDays(priceRows, asOf);
  const referenceDates = tradingReferenceDates(marketRows, asOf);
  const priceDays = tradingPriceDays(saved, referenceDates);
  const comparable = comparableMarketDays(marketRows, priceDays, referenceDates, asOf);
  const events = comparable.filter(e =>
    (e.nikkeiReturn !== null && e.nikkeiReturn <= CRASH_DROP_THRESHOLD) ||
    (e.topixReturn !== null && e.topixReturn <= CRASH_DROP_THRESHOLD)
  );
  const coverage = { validSavedDays: priceDays.dates.length, minimumStocksPerDay: MIN_STOCK_COVERAGE,
    latestSavedDate: saved.dates.at(-1) ?? null,
    latestTradingPriceDate: priceDays.dates.at(-1) ?? null,
    source: "daily_stock_results.price / Yahoo日足参考指数",
    comparableDays: comparable.length,
    marketSessions: referenceDates.length,
    excludedSavedNonTradingDays: priceDays.excludedSavedDates.length,
    excludedSavedDates: priceDays.excludedSavedDates.slice(-8) };
  // Routine ranking is not a crash prediction; it makes the research page useful
  // even if no qualifying -2% crash is inside the saved history.
  const recentEvent = comparable.at(-1) ?? null;
  const recentStocks = recentEvent ? buildEventStocks(recentEvent, priceDays, referenceDates) : [];
  const recent = recentEvent ? {
    event: recentEvent,
    examinedStocks: recentStocks.length,
    isLatestSavedDate: recentEvent.date === coverage.latestSavedDate,
    strong: [...recentStocks].sort((a,b)=>b.excessReturn-a.excessReturn || a.code.localeCompare(b.code)).slice(0,MAX_DISPLAY),
    weak: [...recentStocks].sort((a,b)=>a.excessReturn-b.excessReturn || a.code.localeCompare(b.code)).slice(0,MAX_DISPLAY),
  } : null;
  if (events.length === 0) return {
    version: CRASH_STRENGTH_VERSION, asOf, coverage, event: null, eventCount: 0,
    strong: [], weak: [], recent, historical: null,
    note: "保存済み価格と参考指数の両方がそろった急落日はありません。通常日の市場比ランキングは別表示です。"
  };
  const event = events.at(-1);
  const nextDayEvidence = historicalNextDayEvidence(events, priceDays, referenceDates, marketRows);
  const histories = historyByCode(events, priceDays, referenceDates, event.date);
  const candidates = buildEventStocks(event, priceDays, referenceDates);
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
    examinedStocks: candidates.length, strong, weak, recent, nextDayEvidence, historical: histories.groups,
    note: "強弱は急落当日の市場相対騰落率です。翌日予測・売買推奨ではありません。翌日・3日・5日後は指数の日足に対応する取引日で計測し、休場日の保存価格は除外しています。"
  };
}
