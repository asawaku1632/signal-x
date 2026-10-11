import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { eventObservationDayDelta, usEconomicEvents } from "@/app/lib/usEconomicEvents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// UTC 22:23 = JST 07:23 the next day, after the US cash-market close.
// Records references only; never invokes AI, scans, purchases or notifications.
const SYMBOLS = [
  { key: "sp500", symbol: "^GSPC", zone: "America/New_York" },
  { key: "nasdaq", symbol: "^IXIC", zone: "America/New_York" },
  { key: "nikkei", symbol: "^N225", zone: "Asia/Tokyo" },
  { key: "usdJpy", symbol: "JPY=X", zone: "Asia/Tokyo" },
] as const;

type Quote = { close: number; quoteDate: string; candleAt: string } | null;
type QuoteMap = Record<(typeof SYMBOLS)[number]["key"], Quote>;

function dateInZone(date: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

async function fetchDailyClose(item: (typeof SYMBOLS)[number]): Promise<Quote> {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(item.symbol) + "?range=10d&interval=1d";
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) return null;

  const json = await response.json();
  const chart = json?.chart?.result?.[0];
  const times: unknown[] = chart?.timestamp ?? [];
  const closes: unknown[] = chart?.indicators?.quote?.[0]?.close ?? [];
  for (let i = Math.min(times.length, closes.length) - 1; i >= 0; i--) {
    const close = Number(closes[i]);
    const timestamp = Number(times[i]);
    if (closes[i] === null || !Number.isFinite(close) || close <= 0 ||
      !Number.isFinite(timestamp) || timestamp <= 0) continue;
    const time = new Date(timestamp * 1000);
    return {
      close: Number(close.toFixed(4)),
      quoteDate: dateInZone(time, item.zone),
      candleAt: time.toISOString(),
    };
  }
  return null;
}

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const windowEvents = usEconomicEvents.filter((event) => {
    const delta = eventObservationDayDelta(event, now);
    return delta >= -3 && delta <= 5;
  });
  if (windowEvents.length === 0) {
    return NextResponse.json({ success: true, status: "OUTSIDE_EVENT_WINDOW" });
  }

  // Independent quote failures are stored as null, never guessed as zero.
  const results = await Promise.allSettled(SYMBOLS.map((item) => fetchDailyClose(item)));
  const quotes = Object.fromEntries(SYMBOLS.map((item, index) => [
    item.key,
    results[index].status === "fulfilled" ? results[index].value : null,
  ])) as QuoteMap;
  const retrieved = Object.values(quotes).filter(Boolean).length;
  if (retrieved === 0) {
    return NextResponse.json({ success: false, error: "No fresh market references available" },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const observationDay = now.toISOString().slice(0, 10);
  try {
    let inserted = 0;
    for (const event of windowEvents) {
      const record = await pool.query(
        `INSERT INTO public.us_economic_market_observations
           (event_key, event_kind, scheduled_at, observation_day_utc, observed_at,
            quote_source, market_quotes)
         VALUES ($1, $2, $3::timestamptz, $4::date, $5::timestamptz,
                 'yahoo-chart-daily-unadjusted', $6::jsonb)
         ON CONFLICT (event_key, observation_day_utc) DO NOTHING`,
        [event.id, event.kind, event.scheduledAt, observationDay,
          now.toISOString(), JSON.stringify(quotes)],
      );
      inserted += record.rowCount ?? 0;
    }
    return NextResponse.json({
      success: true, observationDay, observedAt: now.toISOString(),
      eventCount: windowEvents.length, inserted, availableSymbols: retrieved,
      source: "Yahoo Finance daily chart reference values",
      note: "Each quote includes its own trade date; prices may be delayed or revised.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[us-economic-observations] research-only capture failed", error);
    return NextResponse.json({ success: false, error: "Research observation table unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
