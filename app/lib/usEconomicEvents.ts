// Official BLS publication dates. Times are 08:30 America/New_York.
// Deliberately kept separate from stock scores, decisions and notifications.
// Sources: https://www.bls.gov/schedule/news_release/empsit.htm
//          https://www.bls.gov/schedule/news_release/cpi.htm
export type UsEconomicEventKind = "employment" | "cpi";

export type UsEconomicEvent = {
  id: string;
  kind: UsEconomicEventKind;
  title: string;
  usDate: string;
  scheduledAt: string;
  sourceUrl: string;
};

const releaseDates: ReadonlyArray<{ date: string; kind: UsEconomicEventKind }> = [
  { date: "2026-10-02", kind: "employment" },
  { date: "2026-10-14", kind: "cpi" },
  { date: "2026-11-06", kind: "employment" },
  { date: "2026-11-10", kind: "cpi" },
  { date: "2026-12-04", kind: "employment" },
  { date: "2026-12-10", kind: "cpi" },
  { date: "2027-01-08", kind: "employment" },
  { date: "2027-01-13", kind: "cpi" },
  { date: "2027-02-05", kind: "employment" },
  { date: "2027-02-11", kind: "cpi" },
  { date: "2027-03-05", kind: "employment" },
  { date: "2027-03-10", kind: "cpi" },
  { date: "2027-04-02", kind: "employment" },
  { date: "2027-04-13", kind: "cpi" },
  { date: "2027-05-07", kind: "employment" },
  { date: "2027-05-12", kind: "cpi" },
  { date: "2027-06-04", kind: "employment" },
  { date: "2027-06-10", kind: "cpi" },
  { date: "2027-07-02", kind: "employment" },
  { date: "2027-07-14", kind: "cpi" },
  { date: "2027-08-06", kind: "employment" },
  { date: "2027-08-11", kind: "cpi" },
  { date: "2027-09-03", kind: "employment" },
  { date: "2027-09-14", kind: "cpi" },
  { date: "2027-10-08", kind: "employment" },
  { date: "2027-10-14", kind: "cpi" },
  { date: "2027-11-05", kind: "employment" },
  { date: "2027-11-10", kind: "cpi" },
  { date: "2027-12-03", kind: "employment" },
  { date: "2027-12-10", kind: "cpi" },
];

const sources: Record<UsEconomicEventKind, string> = {
  employment: "https://www.bls.gov/schedule/news_release/empsit.htm",
  cpi: "https://www.bls.gov/schedule/news_release/cpi.htm",
};

const names: Record<UsEconomicEventKind, string> = {
  employment: "米国雇用統計（失業率など）",
  cpi: "米国CPI（消費者物価指数）",
};

// Convert the actual 08:30 New York release time into UTC using the
// America/New_York timezone, avoiding hard-coded EST / EDT assumptions.
export function nyReleaseUtc(usDate: string): string {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(usDate)) {
    throw new Error("Invalid official release date");
  }
  const [year, month, day] = usDate.split("-").map(Number);
  const middayUtc = new Date(Date.UTC(year, month - 1, day, 17));
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  }).formatToParts(middayUtc).find((part) => part.type === "timeZoneName")?.value;
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(zone ?? "");
  if (!match) throw new Error("Cannot resolve US Eastern timezone offset");
  const offsetMinutes = (match[1] === "+" ? 1 : -1) *
    (Number(match[2]) * 60 + Number(match[3] ?? 0));
  return new Date(Date.UTC(year, month - 1, day, 8, 30) - offsetMinutes * 60_000).toISOString();
}

export const usEconomicEvents: UsEconomicEvent[] = releaseDates.map(({ date, kind }) => ({
  id: "bls-" + kind + "-" + date,
  kind,
  title: names[kind],
  usDate: date,
  scheduledAt: nyReleaseUtc(date),
  sourceUrl: sources[kind],
})).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

export function nextUsEconomicEvent(now = new Date()): UsEconomicEvent | undefined {
  return usEconomicEvents.find((item) => Date.parse(item.scheduledAt) >= now.getTime());
}

export function eventObservationDayDelta(item: UsEconomicEvent, at: Date): number {
  const start = Date.parse(item.usDate + "T00:00:00Z");
  const todayUtc = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return Math.round((todayUtc - start) / 86_400_000);
}
