import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { collectYahooDailyReferences } from "@/app/lib/learning/dailyPriceAudit";
import { evaluateSector, weeklyPriceDates, type DailyClose, type FrozenSector, type SectorOutcome } from "@/app/lib/weeklySectorOutcome";
import { jstToday } from "@/app/lib/learning/priceReferenceObservations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type Forecast = {
  target_week_start: string;
  target_week_end: string;
  items: FrozenSector[];
  outcome_status: "COMPLETE" | "INCOMPLETE" | null;
};

async function yahooDailyBars(code: string): Promise<DailyClose[]> {
  if (!/^[0-9]{4}$/.test(code)) throw new Error("INVALID_STOCK_CODE");
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${code}.T?range=3mo&interval=1d`,
    {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) throw new Error("YAHOO_DAILY_UNAVAILABLE");
  const json = await response.json();
  return collectYahooDailyReferences(json?.chart?.result?.[0]);
}

async function oneForecast(forecast: Forecast) {
  const { baseline, finish } = weeklyPriceDates(forecast.target_week_start, forecast.target_week_end);
  const today = jstToday();
  if (finish >= today) return { week: forecast.target_week_start, status: "WAITING_FINAL_CLOSE" };

  const members = [...new Set(forecast.items.flatMap((item) =>
    Array.isArray(item.codes) ? item.codes : [],
  ))].filter((code) => /^[0-9]{4}$/.test(code));
  if (!members.length || members.length > 40) {
    return { week: forecast.target_week_start, status: "MISSING_FROZEN_MEMBERS" };
  }
  const quotes = new Map<string, readonly DailyClose[]>();
  // Bounded concurrency: upstream failures only cause an honest incomplete grade.
  for (let offset = 0; offset < members.length; offset += 3) {
    const group = members.slice(offset, offset + 3);
    const results = await Promise.allSettled(group.map((code) => yahooDailyBars(code)));
    results.forEach((result, i) => {
      if (result.status === "fulfilled") quotes.set(group[i], result.value);
      else console.warn("[weekly-sector-outcome] reference unavailable", { code: group[i] });
    });
  }
  const outcomes: SectorOutcome[] = forecast.items.map((sector, i) =>
    evaluateSector(sector, i + 1, quotes, baseline, finish),
  );
  const complete = outcomes.length === 3 && outcomes.every((sector) => sector.status === "COMPLETE");
  const status = complete ? "COMPLETE" : "INCOMPLETE";
  await pool.query(`
    INSERT INTO weekly_sector_outcome_audits
      (target_week_start, baseline_date, end_date, status, items, price_source, methodology_version)
    VALUES ($1::date,$2::date,$3::date,$4,$5::jsonb,'YAHOO_CHART_1D','close_to_close_equal_weight_v1')
    ON CONFLICT (target_week_start) DO UPDATE
    SET status = EXCLUDED.status, items = EXCLUDED.items,
        baseline_date = EXCLUDED.baseline_date, end_date = EXCLUDED.end_date,
        evaluated_at = now()
    WHERE weekly_sector_outcome_audits.status <> 'COMPLETE'
  `, [forecast.target_week_start, baseline, finish, status, JSON.stringify(outcomes)]);
  return { week: forecast.target_week_start, status,
    graded: outcomes.filter((outcome) => outcome.status === "COMPLETE").length,
    total: outcomes.length, baseline, finish };
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", weekday: "short" }).format(new Date());
  if (weekday !== "Sat" && weekday !== "Sun") {
    return NextResponse.json({ success: false, error: "Weekend verification only" }, { status: 409 });
  }
  try {
    const { rows } = await pool.query<Forecast>(`
      SELECT f.target_week_start::text, f.target_week_end::text, f.items,
             o.status AS outcome_status
      FROM weekly_sector_forecasts f
      LEFT JOIN weekly_sector_outcome_audits o USING (target_week_start)
      WHERE o.status IS DISTINCT FROM 'COMPLETE'
      ORDER BY f.target_week_start DESC
      LIMIT 4
    `);
    const completed = [];
    for (const row of rows) {
      completed.push(await oneForecast(row));
    }
    return NextResponse.json({ success: true, results: completed });
  } catch (error) {
    console.error("[weekly-sector-outcome] verification failed", error);
    return NextResponse.json({ success: false, error: "Verification unavailable" }, { status: 503 });
  }
}
