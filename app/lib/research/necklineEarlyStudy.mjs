// Research only: causal, daily-close double-bottom / neckline study.
// A pivot low at day i becomes observable only after i+2 completed candles.
// No hindsight labeling, user trades, AI scores, notifications or DB writes.
// Simulated entry: next session OPEN; exit: CLOSE after 3 or 5 sessions.
// Fixed round-trip cost: 0.2 percentage points by default (not a real fee quote).
export function analyzeNecklineTimeline(source, roundTripCostPercent = 0.2) {
  const empty = { dataValid: false, events: [], latest: null, totalCandidates: 0, totalBreakouts: 0, leadSevenCount: 0, early3: null, early5: null, breakout3: null, breakout5: null, pairedSevenEarly5: null, pairedSevenBreakout5: null };
  if (!Array.isArray(source) || source.length < 25 || !Number.isFinite(roundTripCostPercent) || roundTripCostPercent < 0) return empty;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (!c || ![c.time,c.open,c.high,c.low,c.close].every(x => typeof x === "number" && Number.isFinite(x) && x > 0)
      || c.high < Math.max(c.open,c.close,c.low) || c.low > Math.min(c.open,c.close,c.high)
      || (i && c.time <= source[i-1].time)) return empty;
  }
  const dateOf = i => new Date(source[i].time * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  function confirmedLows(end) {
    const lows = [];
    for (let i = 2; i <= end - 2; i++) {
      const low = source[i].low;
      if (low < source[i-1].low && low < source[i-2].low
        && low <= source[i+1].low && low <= source[i+2].low) lows.push(i);
    }
    return lows;
  }
  function candidateAt(end) {
    const lows = confirmedLows(end).slice(-12);
    for (let j = lows.length - 1; j > 0; j--) {
      const second = lows[j];
      // First detectable while the second bottom is recent, after right-hand confirmation.
      if (end - second > 6) break;
      for (let k = j-1; k >= 0; k--) {
        const first = lows[k], gap = second - first;
        if (gap < 4 || gap > 40) continue;
        const low1 = source[first].low, low2 = source[second].low;
        if (Math.abs(low1 - low2) / Math.max(low1, low2) > 0.035) continue;
        const between = source.slice(first+1,second);
        if (!between.length) continue;
        const neckline = Math.max(...between.map(c => c.high));
        if (neckline < Math.max(low1,low2)*1.03 || neckline > Math.min(low1,low2)*1.35) continue;
        if (source[end].close < low2*1.01 || source[end].close >= neckline*1.002) continue;
        return { first, second, low1, low2, neckline };
      }
    }
    return null;
  }
  const raw = [], seen = new Set();
  let active = null;
  for (let end = 0; end < source.length; end++) {
    if (active) {
      if (end > active.firstSeenIndex) {
        const close = source[end].close;
        if (close >= active.neckline*1.002) {
          active.breakoutIndex = end;
          active.status = "BREAKOUT";
          const previous20 = source.slice(Math.max(0, end-20),end);
          const avgVolume = previous20.length===20 && previous20.every(c => Number.isFinite(c.volume) && c.volume>0)
            ? previous20.reduce((sum,c)=>sum+c.volume,0)/20 : null;
          active.breakoutVolumeRatio = avgVolume && Number.isFinite(source[end].volume) && source[end].volume>0
            ? source[end].volume/avgVolume : null;
          active = null;
        } else if (close < Math.min(active.low1,active.low2)*0.985) {
          active.status = "INVALIDATED";
          active = null;
        } else if (end - active.firstSeenIndex >= 20) {
          active.status = "EXPIRED";
          active = null;
        }
      }
      continue;
    }
    const match = candidateAt(end);
    if (!match) continue;
    const key = match.first + ":" + match.second;
    if (seen.has(key)) continue;
    seen.add(key);
    const event = { ...match, firstSeenIndex: end, breakoutIndex: null, status: "WATCH", breakoutVolumeRatio: null };
    raw.push(event);
    active = event;
  }
  function simulatedReturn(index, holdingSessions) {
    if (index === null || index + holdingSessions >= source.length) return null;
    const entry = source[index+1].open;
    const exit = source[index+holdingSessions].close;
    return (exit / entry - 1) * 100 - roundTripCostPercent;
  }
  const events = raw.map(e => {
    const leadSessions = e.breakoutIndex === null ? null : e.breakoutIndex - e.firstSeenIndex;
    return {
      ...e,
      firstSeenDate: dateOf(e.firstSeenIndex),
      low1Date: dateOf(e.first),
      low2Date: dateOf(e.second),
      breakoutDate: e.breakoutIndex === null ? null : dateOf(e.breakoutIndex),
      leadSessions,
      earlyReturn3: simulatedReturn(e.firstSeenIndex,3),
      earlyReturn5: simulatedReturn(e.firstSeenIndex,5),
      breakoutReturn3: simulatedReturn(e.breakoutIndex,3),
      breakoutReturn5: simulatedReturn(e.breakoutIndex,5),
    };
  });
  function stats(xs) {
    const valid = xs.filter(x => typeof x === "number" && Number.isFinite(x));
    return valid.length ? {
      n: valid.length,
      averagePercent: valid.reduce((sum,x)=>sum+x,0)/valid.length,
      winRatePercent: valid.filter(x=>x>0).length*100/valid.length,
    } : null;
  }
  const seven = events.filter(e=>e.leadSessions!==null && e.leadSessions>=7);
  return {
    dataValid: true,
    events,
    latest: events.at(-1) ?? null,
    totalCandidates: events.length,
    totalBreakouts: events.filter(e=>e.status==="BREAKOUT").length,
    leadSevenCount: seven.length,
    early3: stats(events.map(e=>e.earlyReturn3)),
    early5: stats(events.map(e=>e.earlyReturn5)),
    breakout3: stats(events.map(e=>e.breakoutReturn3)),
    breakout5: stats(events.map(e=>e.breakoutReturn5)),
    pairedSevenEarly5: stats(seven.map(e=>e.earlyReturn5)),
    pairedSevenBreakout5: stats(seven.map(e=>e.breakoutReturn5)),
  };
}
