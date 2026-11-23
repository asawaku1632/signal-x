/**
 * Offline adapter for an already fetched J-Quants v2 /markets/calendar payload.
 * No network, database writes, paid endpoint calls or automatic trust promotion.
 * HolDiv: 0=closed, 1=business, 2=TSE half-day, 3=closed (OSE holiday trading).
 * Source: https://jpx-jquants.com/en/spec/mkt-cal
 */
const validDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s + "T00:00:00Z")) &&
  new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;

export function parseJQuantsTseCalendar({
  data, from, to, sourceVerified = false, responseComplete = false,
} = {}) {
  const blocked = (reason) => ({
    status: "BLOCKED", reason, exchangeSessions: [],
    calendarVerified: false, calendarComplete: false,
  });
  if (!sourceVerified || !responseComplete) return blocked("UNVERIFIED_SOURCE_OR_PAGINATION");
  if (!validDate(from) || !validDate(to) || from > to) return blocked("INVALID_RANGE");
  if (!Array.isArray(data) || !data.length) return blocked("MISSING_CALENDAR_ROWS");
  const byDate = new Map();
  for (const row of data) {
    if (!row || !validDate(row.Date) || !["0", "1", "2", "3"].includes(row.HolDiv))
      return blocked("INVALID_CALENDAR_ROW");
    if (byDate.has(row.Date)) return blocked("DUPLICATE_CALENDAR_DATE");
    byDate.set(row.Date, row.HolDiv);
  }
  const sessions = [];
  for (let day = Date.parse(from + "T00:00:00Z"), end = Date.parse(to + "T00:00:00Z");
    day <= end; day += 86400000) {
    const date = new Date(day).toISOString().slice(0, 10);
    if (!byDate.has(date)) return blocked("INCOMPLETE_CALENDAR_RANGE");
    if (["1", "2"].includes(byDate.get(date))) sessions.push(date);
  }
  return {
    status: "RESEARCH_ONLY", reason: null, exchangeSessions: sessions,
    calendarVerified: true, calendarComplete: true,
    source: "J-Quants v2 /markets/calendar",
  };
}
