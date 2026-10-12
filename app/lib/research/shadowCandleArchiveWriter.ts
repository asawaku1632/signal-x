import "server-only";
import { createHash } from "node:crypto";
import pool from "@/app/lib/postgres";
import {
  detectShadowCandlePatterns,
  SHADOW_CANDLE_DETECTOR_VERSION,
} from "@/app/lib/research/shadowCandlestickNine";
import {
  studyShadowCandleBatch,
  type BatchStockData,
} from "@/app/lib/research/shadowCandlestickBatch";
import { dateJst } from "@/app/lib/research/shadowCandleYahoo";

/** The SAME canonical research writer for explicit saves and bounded Cron. */
export async function archiveShadowCandleCohort(cohort: readonly BatchStockData[]): Promise<string> {
  if (cohort.length === 0 || cohort.length > 5) throw new Error("RESEARCH_COHORT_LIMIT");
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
  const codes = cohort.map(s => s.code).sort();
  const batchKey = codes.join(",");
  const values = [
    SHADOW_CANDLE_DETECTOR_VERSION, batchKey, inputHash, codes,
    cohort.length, cohort.length, first, last,
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
    console.error("shadow candle research archive insert failed", error);
    throw error;
  }
  return id;
}
