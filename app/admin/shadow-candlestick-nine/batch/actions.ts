"use server";

import { createHash } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import {
  detectShadowCandlePatterns,
  SHADOW_CANDLE_DETECTOR_VERSION,
} from "@/app/lib/research/shadowCandlestickNine";
import {
  parseShadowBatchCodes,
  studyShadowCandleBatch,
} from "@/app/lib/research/shadowCandlestickBatch";
import { dateJst, fetchCohort } from "@/app/lib/research/shadowCandleYahoo";

/**
 * The form is a POST server action and cannot be prefetched by Next Link.
 * Owner permission is rechecked when the button is pressed; do not trust
 * client-side report totals or hidden form inputs.
 *
 * One press <=5 Yahoo daily requests; only a fresh server-recomputed research
 * report is archived. No production model or learning table is updated.
 */
export async function saveShadowCandleBatch(form: FormData): Promise<void> {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const raw = form.get("codes");
  if (typeof raw !== "string" || raw.length > 180) {
    redirect("/admin/shadow-candlestick-nine/batch?save=invalid");
  }
  const parsed = parseShadowBatchCodes(raw);
  if (parsed.error || !parsed.codes.length) {
    redirect("/admin/shadow-candlestick-nine/batch?save=invalid");
  }
  const loaded = await fetchCohort(parsed.codes);
  // Fail closed on partial provider failures; do not persist a misleading
  // cohort with a missing comparison stock.
  if (loaded.length !== parsed.codes.length || loaded.some(row => row.error || !row.candles.length)) {
    redirect("/admin/shadow-candlestick-nine/batch?save=unavailable");
  }
  const cohort = loaded.map(({ code, candles }) => ({ code, candles }));
  const report = studyShadowCandleBatch(cohort);
  const snapshots = cohort.map(({ code, candles }) => ({
    code,
    candles: candles.map(c => [c.time, c.open, c.high, c.low, c.close]),
  }));
  const inputHash = createHash("sha256").update(JSON.stringify({
    version: SHADOW_CANDLE_DETECTOR_VERSION,
    stocks: [...snapshots].sort((a, b) => a.code.localeCompare(b.code)),
  })).digest("hex");
  const events = cohort.flatMap(({ code, candles }) =>
    detectShadowCandlePatterns(candles).map(hit => ({
      code,
      patternId: hit.id,
      tradeDate: dateJst(hit.time),
      direction: hit.direction,
      detectionClose: hit.entryClose,
      outcomes: ([1, 3, 5] as const).map(days => {
        const future = candles[hit.index + days];
        const rawReturn = future && Number.isFinite(future.close) && future.close > 0
          ? 100 * (future.close - hit.entryClose) / hit.entryClose
          : null;
        return {
          days,
          date: future && rawReturn !== null ? dateJst(future.time) : null,
          directionalReturn: rawReturn === null ? null : Math.round(
            (hit.direction === "BUY" ? rawReturn : -rawReturn) * 10000,
          ) / 10000,
        };
      }),
    })),
  );
  const days = cohort.flatMap(x => x.candles.map(c => dateJst(c.time)));
  const first = days.sort()[0];
  const last = days[days.length - 1];
  const codes = parsed.codes.slice().sort();
  const batchKey = codes.join(",");
  const values = [
    SHADOW_CANDLE_DETECTOR_VERSION, batchKey, inputHash, codes,
    parsed.codes.length, cohort.length, first, last,
    JSON.stringify(report), JSON.stringify(events), "[]",
  ];
  let id: string;
  try {
    const inserted = await pool.query<{ id: string }>(`
      INSERT INTO public.shadow_candle_research_runs
        (detector_version, batch_key, input_hash, codes, requested_count,
         succeeded_count, first_bar_date, last_bar_date, aggregate, events, excluded)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb)
      ON CONFLICT (input_hash) DO NOTHING
      RETURNING id
    `, values);
    if (inserted.rows[0]) {
      id = inserted.rows[0].id;
    } else {
      const existing = await pool.query<{ id: string }>(
        "SELECT id FROM public.shadow_candle_research_runs WHERE input_hash=$1 LIMIT 1",
        [inputHash],
      );
      if (!existing.rows[0]) throw new Error("archive conflict not readable");
      id = existing.rows[0].id;
    }
  } catch (error) {
    console.error("owner shadow candle archive save unavailable", error);
    redirect("/admin/shadow-candlestick-nine/batch?save=error");
  }
  redirect(`/admin/shadow-candlestick-nine/archive?run=${encodeURIComponent(id)}`);
}
