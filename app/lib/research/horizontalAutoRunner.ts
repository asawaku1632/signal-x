import "server-only";
import { createHash } from "node:crypto";
import pool from "@/app/lib/postgres";
import { ACTIVE_STOCKS } from "@/app/lib/activeStockList";
import { dateJst, fetchCohort, type LoadedStock } from "./shadowCandleYahoo";
import { runMsbAutoShared, type MsbAutoStatus } from "./msbAutoRunner";
import { HORIZONTAL_COMPARE_VERSION, compareHorizontalRetest } from "./horizontalRetestComparison";
import { selectHorizontalAutoDailyStocks, HORIZONTAL_AUTO_POLICY_VERSION } from "./horizontalAutoPolicy";

type Result = { success: boolean; skipped: boolean; dateJst: string; status: string;
  codes?: string[]; archiveId?: string; reason?: string; msb?: MsbAutoStatus };

/** Only reached from authenticated cron + owner-enabled switch.
 * Every JST day is claimed ONCE before any HTTP request. Failed claims
 * are never automatically retried. Nothing touches production analysis.
 */
export async function runHorizontalAutoDaily(now = new Date(), shareMsb = false): Promise<Result> {
  // Manual archives and prior auto claims (including failed) are excluded.
  const existing = await pool.query<{code:string}>(
    "SELECT DISTINCT code FROM (" +
    "SELECT unnest(codes) AS code FROM public.horizontal_retest_archive_runs " +
    "UNION ALL " +
    "SELECT unnest(codes) AS code FROM public.horizontal_retest_auto_daily_runs" +
    ") covered"
  );
  const decision = selectHorizontalAutoDailyStocks({
    now, universe: ACTIVE_STOCKS.map(s => String(s.code)),
    coveredCodes: new Set(existing.rows.map(x => x.code)),
  });
  if (!decision.ok) {
    return { success:true, skipped:true, dateJst:decision.dateJst, status:"SKIPPED", reason:decision.reason };
  }
  const { codes, dateJst: tradeDate } = decision;

  const claim = await pool.query<{trade_date:string}>(
    "INSERT INTO public.horizontal_retest_auto_daily_runs (trade_date, detector_version, codes) " +
    "VALUES ($1::date,$2,$3::text[]) ON CONFLICT (trade_date) DO NOTHING RETURNING trade_date::text",
    [tradeDate, HORIZONTAL_COMPARE_VERSION, codes]
  );
  if (!claim.rows.length) {
    return { success:true, skipped:true, dateJst:tradeDate, status:"SKIPPED", reason:"ALREADY_CLAIMED" };
  }

  try {
    const loaded: LoadedStock[] = await fetchCohort(codes); // 1 request per code, <=5 daily, <=3 simultaneous
    // Only after the existing once-per-day horizontal claim and bounded fetch:
    // MSB analyses the EXACT SAME completed candles; no additional HTTP requests.
    // A failure in independent MSB research must never stop horizontal study.
    let msb: MsbAutoStatus | undefined;
    if (shareMsb) {
      try { msb = await runMsbAutoShared(loaded, tradeDate); }
      catch (e) { console.error("isolated MSB research failed",e); }
    }
    if (loaded.length !== codes.length || loaded.some(x => x.error || x.candles.length < 60)) {
      await pool.query(
        "UPDATE public.horizontal_retest_auto_daily_runs SET status='FAILED', " +
        "note='DATA_UNAVAILABLE', finished_at=now() WHERE trade_date=$1::date AND status='CLAIMED'",
        [tradeDate]
      );
      return { success:false, skipped:false, status:"FAILED", dateJst:tradeDate, codes,
        reason:"DATA_UNAVAILABLE", msb };
    }
    const studies = loaded.map(({code,candles}) => ({code,candles}));
    const report = compareHorizontalRetest(studies);
    const hash = createHash("sha256").update(JSON.stringify({
      version: HORIZONTAL_COMPARE_VERSION,
      stocks: studies.map(({code,candles}) => ({
        code, bars: candles.map(c => [c.time,c.open,c.high,c.low,c.close,c.volume ?? null]),
      })).sort((a,b) => a.code.localeCompare(b.code)),
    })).digest("hex");
    const times = studies.flatMap(s => s.candles.map(c => c.time));
    const first = dateJst(Math.min(...times));
    const last = dateJst(Math.max(...times));
    const client = await pool.connect();
    let archiveId: string;
    try {
      await client.query("BEGIN");
      const saved = await client.query<{id:string}>(
        "INSERT INTO public.horizontal_retest_archive_runs " +
        "(detector_version, input_hash, codes, requested_count, succeeded_count, " +
        "first_bar_date, last_bar_date, base_trade_count) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (input_hash) DO NOTHING RETURNING id::text",
        [HORIZONTAL_COMPARE_VERSION,hash,[...codes].sort(),codes.length,studies.length,
         first,last,report.completedBaseTrades]
      );
      if (saved.rows[0]) {
        archiveId = saved.rows[0].id;
        for (const entry of report.entries) {
          await client.query(
            "INSERT INTO public.horizontal_retest_archive_trades " +
            "(detector_version,code,breakout_time,retest_time,entry_time,exit_time," +
            "profit_yen_100,return_percent,volume_eligible,technical_eligible,first_run_id) " +
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) " +
            "ON CONFLICT (detector_version,code,breakout_time,retest_time,entry_time) DO NOTHING",
            [HORIZONTAL_COMPARE_VERSION,entry.code,entry.breakoutTime,entry.retestTime,
             entry.entryTime,entry.exitTime,entry.trade.profitYen100,entry.trade.returnPercent,
             entry.eligible.TREND_VOLUME,entry.eligible.TECHNICAL,archiveId]
          );
        }
      } else {
        const found = await client.query<{id:string}>(
          "SELECT id::text FROM public.horizontal_retest_archive_runs WHERE input_hash=$1 LIMIT 1",
          [hash]
        );
        if (!found.rows[0]) throw new Error("ARCHIVE_NOT_READABLE");
        archiveId = found.rows[0].id;
      }
      const completed = await client.query(
        "UPDATE public.horizontal_retest_auto_daily_runs SET " +
        "status='COMPLETED',archive_run_id=$2::uuid,finished_at=now(),note=$3 " +
        "WHERE trade_date=$1::date AND status='CLAIMED' RETURNING trade_date",
        [tradeDate,archiveId,HORIZONTAL_AUTO_POLICY_VERSION]
      );
      if (!completed.rowCount) throw new Error("DAILY_CLAIM_STATE_CHANGED");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return { success:true, skipped:false, status:"COMPLETED", dateJst:tradeDate, codes, archiveId, msb };
  } catch (error) {
    console.error("horizontal shadow auto run failed", error);
    // DO NOT delete claim or retry; fail safe if status update also fails.
    await pool.query(
      "UPDATE public.horizontal_retest_auto_daily_runs SET " +
      "status='FAILED',finished_at=now(),note='RUN_ERROR' " +
      "WHERE trade_date=$1::date AND status='CLAIMED'",[tradeDate]
    ).catch(e => console.error("horizontal auto status save failed",e));
    return {success:false,skipped:false,dateJst:tradeDate,status:"FAILED",codes,reason:"RUN_ERROR"};
  }
}
