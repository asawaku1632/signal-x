"use server";

import { notFound, redirect } from "next/navigation";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { parseShadowBatchCodes } from "@/app/lib/research/shadowCandlestickBatch";
import { fetchCohort } from "@/app/lib/research/shadowCandleYahoo";
import { archiveShadowCandleCohort } from "@/app/lib/research/shadowCandleArchiveWriter";

/** No hidden auto-saving: explicit owner POST only; never trust client metrics. */
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
  if (loaded.length !== parsed.codes.length || loaded.some(row => row.error || !row.candles.length)) {
    redirect("/admin/shadow-candlestick-nine/batch?save=unavailable");
  }
  let id: string;
  try {
    id = await archiveShadowCandleCohort(loaded.map(({ code, candles }) => ({ code, candles })));
  } catch (error) {
    console.error("owner shadow candle archive save unavailable", error);
    redirect("/admin/shadow-candlestick-nine/batch?save=error");
  }
  redirect(`/admin/shadow-candlestick-nine/archive?run=${encodeURIComponent(id)}`);
}
