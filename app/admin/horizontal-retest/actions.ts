"use server";

import { createHash } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { dateJst, fetchCohort } from "@/app/lib/research/shadowCandleYahoo";
import {
  HORIZONTAL_COMPARE_VERSION,
  compareHorizontalRetest,
} from "@/app/lib/research/horizontalRetestComparison";

/**
 * Explicit owner-triggered POST: re-verify owner and independently re-fetch
 * at most five completed daily charts (max 3 simultaneous calls).
 * Only append-only shadow research tables may change.
 */
export async function saveHorizontalRetestStudy(form: FormData): Promise<void> {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const raw = form.get("codes");
  if (typeof raw !== "string" || raw.length > 80) {
    redirect("/admin/horizontal-retest?save=invalid");
  }
  const codes = raw.trim().split(/[\s,、]+/).filter(Boolean);
  if (codes.length < 1 || codes.length > 5 ||
      new Set(codes).size !== codes.length ||
      codes.some(code => !/^[0-9]{4}$/.test(code))) {
    redirect("/admin/horizontal-retest?save=invalid");
  }

  const loaded = await fetchCohort(codes);
  if (loaded.length !== codes.length ||
      loaded.some(row => row.error || row.candles.length < 60)) {
    redirect("/admin/horizontal-retest?save=unavailable");
  }
  const studies = loaded.map(({ code, candles }) => ({ code, candles }));
  const result = compareHorizontalRetest(studies);

  // Entire trusted server-fetched confirmed OHLCV AND version, never client-supplied stats.
  const fingerprints = studies.map(({ code, candles }) => ({
    code, bars: candles.map(c => [c.time, c.open, c.high, c.low, c.close, c.volume ?? null]),
  })).sort((a,b) => a.code.localeCompare(b.code));
  const inputHash = createHash("sha256").update(JSON.stringify({
    version: HORIZONTAL_COMPARE_VERSION, stocks: fingerprints,
  })).digest("hex");

  const times = studies.flatMap(s => s.candles.map(c => c.time));
  const firstDate = dateJst(Math.min(...times));
  const lastDate = dateJst(Math.max(...times));
  let saveStatus: "saved" | "duplicate" = "saved";
  let runId = "";
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const inserted = await client.query<{id: string}>(
      "INSERT INTO public.horizontal_retest_archive_runs " +
      "(detector_version, input_hash, codes, requested_count, succeeded_count, " +
      "first_bar_date, last_bar_date, base_trade_count) " +
      "VALUES ($1,$2,$3,$4,$5,$6,$7,$8) " +
      "ON CONFLICT (input_hash) DO NOTHING RETURNING id::text",
      [HORIZONTAL_COMPARE_VERSION, inputHash, [...codes].sort(), codes.length,
       loaded.length, firstDate, lastDate, result.completedBaseTrades],
    );
    if (!inserted.rows.length) {
      const existing = await client.query<{id: string}>(
        "SELECT id::text FROM public.horizontal_retest_archive_runs WHERE input_hash=$1 LIMIT 1",
        [inputHash],
      );
      if (!existing.rows[0]) throw new Error("archive hash conflict not readable");
      runId = existing.rows[0].id;
      saveStatus = "duplicate";
    } else {
      runId = inserted.rows[0].id;
      for (const event of result.entries) {
        await client.query(
          "INSERT INTO public.horizontal_retest_archive_trades " +
          "(detector_version, code, breakout_time, retest_time, entry_time, " +
          "exit_time, profit_yen_100, return_percent, volume_eligible, " +
          "technical_eligible, first_run_id) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) " +
          "ON CONFLICT (detector_version, code, breakout_time, retest_time, entry_time) DO NOTHING",
          [HORIZONTAL_COMPARE_VERSION, event.code, event.breakoutTime,
           event.retestTime, event.entryTime, event.exitTime,
           event.trade.profitYen100, event.trade.returnPercent,
           event.eligible.TREND_VOLUME, event.eligible.TECHNICAL, runId],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    console.error("isolated horizontal archive save failed", error);
    redirect("/admin/horizontal-retest?save=error");
  } finally {
    client?.release();
  }
  redirect("/admin/horizontal-retest/archive?save=" + saveStatus +
    "&run=" + encodeURIComponent(runId));
}
