import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { getLatestScanSnapshot } from "@/app/lib/scanSnapshot";
import { getTseCashSessionStatus, resolveTseTradingDatesAfter } from "@/app/lib/technicalObservation/tseMarketCalendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SLOTS = {
  "0930": { label: "09:30", minute: 9 * 60 + 30 },
  "1030": { label: "10:30", minute: 10 * 60 + 30 },
  "1300": { label: "13:00", minute: 13 * 60 },
  "1430": { label: "14:30", minute: 14 * 60 + 30 },
} as const;
type SlotKey = keyof typeof SLOTS;
const MAX_SAMPLES = 30;
const MAX_SCAN_AGE_MS = 6 * 60 * 1000;
const MIN_UNIVERSE_COVERAGE = 800;

type ScanStock = {
  code?: unknown;
  name?: unknown;
  price?: unknown;
  currentPrice?: unknown;
  score?: unknown;
  aiPower?: unknown;
};

function isValidPrice(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
function score(value: unknown) {
  const number = Number(value);
  return value === null || value === undefined || !Number.isFinite(number) ? null : number;
}
function dateJst(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("slot") ?? "";
    if (!(key in SLOTS)) {
      return NextResponse.json({ success: false, error: "Invalid slot" }, { status: 400 });
    }
    const slot = SLOTS[key as SlotKey];
    const now = new Date();
    const market = getTseCashSessionStatus(now);
    if (!market.open) {
      return NextResponse.json({ success: true, skipped: market.reason, date: market.date });
    }
    if (Math.abs(market.hour * 60 + market.minute - slot.minute) > 9) {
      return NextResponse.json({ success: true, skipped: "OUTSIDE_SLOT_WINDOW", slot: slot.label });
    }

    // Never trigger another full-market scan: reuse only a timely, wide snapshot.
    const snapshot = await getLatestScanSnapshot();
    if (!snapshot || !Array.isArray(snapshot.payload?.stocks) ||
        snapshot.itemCount < MIN_UNIVERSE_COVERAGE ||
        snapshot.payload.stocks.length < MIN_UNIVERSE_COVERAGE) {
      return NextResponse.json({ success: true, skipped: "NO_WIDE_SCAN_SNAPSHOT", slot: slot.label });
    }
    const sampleTimestamp = new Date(snapshot.updatedAt);
    const snapshotAgeMs = now.getTime() - sampleTimestamp.getTime();
    if (!Number.isFinite(snapshotAgeMs) || snapshotAgeMs < -10_000 ||
        snapshotAgeMs > MAX_SCAN_AGE_MS || dateJst(sampleTimestamp) !== market.date) {
      return NextResponse.json({ success: true, skipped: "STALE_SCAN", slot: slot.label,
        snapshotAgeSeconds: Number.isFinite(snapshotAgeMs) ? Math.round(snapshotAgeMs / 1000) : null });
    }

    const stocks = snapshot.payload.stocks as ScanStock[];
    const seen = new Set<string>();
    const selected = stocks.flatMap((stock) => {
      const code = String(stock?.code ?? "").trim().toUpperCase();
      const name = String(stock?.name ?? "").trim();
      const price = isValidPrice(stock?.price ?? stock?.currentPrice);
      if (!/^[0-9A-Z]{4}$/.test(code) || !name || price === null || seen.has(code)) return [];
      seen.add(code);
      return [{ code, name, price, aiPower: score(stock?.aiPower ?? stock?.score) }];
    }).slice(0, MAX_SAMPLES);
    if (selected.length < MAX_SAMPLES) {
      return NextResponse.json({ success: true, skipped: "INSUFFICIENT_VALID_STOCKS", eligible: selected.length });
    }

    const outcomeDate = resolveTseTradingDatesAfter(market.date, 1)[0];
    const values: unknown[] = [];
    const tuples = selected.map((row, index) => {
      const base = index * 8;
      values.push(market.date, slot.label, row.code, row.name, row.price, row.aiPower,
        snapshot.updatedAt, outcomeDate);
      return `(${Array.from({length: 8}, (_, i) => `$${base + i + 1}`).join(",")})`;
    });
    const saved = await pool.query(
      `INSERT INTO public.golden_zone_observations
         (trade_date, time_slot, code, name, entry_price, ai_power, sampled_at, outcome_date)
       VALUES ${tuples.join(",")}
       ON CONFLICT (trade_date, time_slot, code) DO NOTHING`,
      values,
    );
    const result = {
      success: true, date: market.date, slot: slot.label, sampledAt: snapshot.updatedAt,
      outcomeDate, selected: selected.length, added: saved.rowCount ?? 0, source: "cached_scan_top_30",
    };
    console.info("[golden-zone]", JSON.stringify(result));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[golden-zone] capture failed", error);
    return NextResponse.json({ success: false, error: "Golden-zone capture failed" }, { status: 500 });
  }
}
