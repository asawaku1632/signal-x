import "server-only";
import { createHash } from "node:crypto";
import pool from "@/app/lib/postgres";
import { ACTIVE_STOCKS } from "@/app/lib/activeStockList";
import { SHADOW_CANDLE_DETECTOR_VERSION, detectShadowCandlePatterns } from "./shadowCandlestickNine";
import { studyShadowCandleBatch } from "./shadowCandlestickBatch";
import { dateJst, fetchCohort } from "./shadowCandleYahoo";
import { selectShadowAutoDailyStocks, SHADOW_CANDLE_AUTO_POLICY_VERSION } from "./shadowCandleAutoPolicy";

type AutoRunResult = {
  success: boolean;
  skipped: boolean;
  dateJst: string;
  status: string;
  codes?: string[];
  archiveId?: string;
  reason?: string;
};

/** Only invoked by an authenticated, explicitly enabled Cron route.
 * A day's DB claim is permanently consumed BEFORE any Yahoo access.
 * Crashed/failed days are not automatically retried: hard cap <=5 Yahoo calls.
 */
export async function runShadowCandleAutoDaily(now = new Date()): Promise<AutoRunResult> {
  // Read public research archives and the dedicated auto attempt ledger only.
  // The same existing 10 manually studied codes are excluded up front.
  const existing = await pool.query<{ code: string }>(`
    SELECT DISTINCT code FROM (
      SELECT unnest(codes) AS code FROM public.shadow_candle_research_runs
      UNION ALL
      SELECT unnest(codes) AS code FROM public.shadow_candle_auto_daily_runs
    ) covered
  `);
  const eligible = selectShadowAutoDailyStocks({
    now,
    universe: ACTIVE_STOCKS.map(x => x.code),
    coveredCodes: new Set(existing.rows.map(x => x.code)),
  });
  if (!eligible.ok) {
    return { success: true, skipped: true, dateJst: eligible.dateJst, status: "SKIPPED", reason: eligible.reason };
  }
  const { dateJst: tradeDate, codes } = eligible;
  // Primary-key claim enforces at most one attempt / JST trade date,
  // across Vercel retries, manual invocations and concurrent deployments.
  const claim = await pool.query<{ trade_date: string }>(`
    INSERT INTO public.shadow_candle_auto_daily_runs (trade_date, detector_version, codes)
    VALUES ($1::date, $2, $3::text[])
    ON CONFLICT (trade_date) DO NOTHING RETURNING trade_date::text
  `, [tradeDate, SHADOW_CANDLE_DETECTOR_VERSION, codes]);
  if (claim.rows.length === 0) {
    return { success: true, skipped: true, dateJst: tradeDate, status: "SKIPPED", reason: "ALREADY_CLAIMED" };
  }

  try {
    const loaded = await fetchCohort(codes);
    if (loaded.length !== codes.length || loaded.some(x => x.error || x.candles.length < 20)) {
      const failedCodes = loaded.filter(x => x.error || x.candles.length < 20).map(x => x.code);
      await pool.query(`
        UPDATE public.shadow_candle_auto_daily_runs SET status='FAILED',
          note=$2, finished_at=now() WHERE trade_date=$1::date
      `, [tradeDate, `DATA_UNAVAILABLE:${failedCodes.join(",")}`]);
      return { success: false, skipped: false, dateJst: tradeDate, status: "FAILED", reason: "DATA_UNAVAILABLE", codes };
    }
    const cohort = loaded.map(({code,candles}) => ({code,candles}));
    const report = studyShadowCandleBatch(cohort);
    const snapshots = cohort.map(({code,candles}) => ({
      code, candles: candles.map(c => [c.time,c.open,c.high,c.low,c.close]),
    }));
    const hash = createHash("sha256").update(JSON.stringify({
      version: SHADOW_CANDLE_DETECTOR_VERSION,
      stocks: [...snapshots].sort((a,b) => a.code.localeCompare(b.code)),
    })).digest("hex");
    const events = cohort.flatMap(({code,candles}) =>
      detectShadowCandlePatterns(candles).map(hit => ({
        code,
        patternId: hit.id,
        tradeDate: dateJst(hit.time),
        direction: hit.direction,
        detectionClose: hit.entryClose,
        outcomes: ([1,3,5] as const).map(days => {
          const future = candles[hit.index + days];
          const raw = future && Number.isFinite(future.close) && future.close > 0
            ? 100 * (future.close - hit.entryClose) / hit.entryClose : null;
          return {
            days,
            date: future && raw !== null ? dateJst(future.time) : null,
            directionalReturn: raw === null ? null : Math.round(
              (hit.direction === "BUY" ? raw : -raw) * 10000,
            ) / 10000,
          };
        }),
      })),
    );
    const dates = cohort.flatMap(stock => stock.candles.map(c => dateJst(c.time))).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const sortedCodes = [...codes].sort();
    const client = await pool.connect();
    let archiveId: string;
    try {
      await client.query("BEGIN");
      const saved = await client.query<{id:string}>(`
        INSERT INTO public.shadow_candle_research_runs
          (detector_version, batch_key, input_hash, codes, requested_count,
           succeeded_count, first_bar_date, last_bar_date, aggregate, events, excluded)
        VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8::date,$9::jsonb,$10::jsonb,$11::jsonb)
        ON CONFLICT (input_hash) DO NOTHING RETURNING id::text
      `, [
        SHADOW_CANDLE_DETECTOR_VERSION, sortedCodes.join(","), hash, sortedCodes,
        codes.length, cohort.length, firstDate, lastDate,
        JSON.stringify(report), JSON.stringify(events), "[]",
      ]);
      if (saved.rows[0]) {
        archiveId = saved.rows[0].id;
      } else {
        const found = await client.query<{id:string}>(
          "SELECT id::text FROM public.shadow_candle_research_runs WHERE input_hash=$1 LIMIT 1",
          [hash],
        );
        if (!found.rows[0]) throw new Error("ARCHIVE_NOT_READABLE");
        archiveId = found.rows[0].id;
      }
      await client.query(`
        UPDATE public.shadow_candle_auto_daily_runs
        SET status='COMPLETED', archive_run_id=$2::uuid, finished_at=now(),
            note=$3 WHERE trade_date=$1::date AND status='CLAIMED'
      `, [tradeDate, archiveId, SHADOW_CANDLE_AUTO_POLICY_VERSION]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally { client.release(); }
    return {
      success: true, skipped: false, dateJst: tradeDate, status: "COMPLETED",
      codes, archiveId,
    };
  } catch (error) {
    console.error("shadow candle auto daily research failed", error);
    // Deliberately never delete or reset this claim; no same-day auto retry.
    await pool.query(`
      UPDATE public.shadow_candle_auto_daily_runs SET status='FAILED',
        note='RUN_ERROR', finished_at=now()
      WHERE trade_date=$1::date AND status='CLAIMED'
    `, [tradeDate]).catch(e => console.error("shadow candle auto failed status write",e));
    return { success: false, skipped: false, dateJst: tradeDate, status: "FAILED", reason: "RUN_ERROR", codes };
  }
}
