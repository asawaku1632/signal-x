"use server";

import { notFound, redirect } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { validateExternalArchive } from "@/app/lib/research/externalAiArchive.mjs";

/** POST-only Next server action: Next origin checks + re-verified owner session.
 * Inserting manually supplied predictions is never an AI training operation.
 */
export async function archiveExternalForecast(form: FormData): Promise<void> {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const input = (name: string) => {
    const item = form.get(name);
    return typeof item === "string" ? item : "";
  };
  const parsed = validateExternalArchive({
    tradeDate: input("tradeDate"),
    code: input("code"),
    providerName: input("providerName"),
    stockName: input("stockName"),
    buyLimit: input("buyLimit"),
    originalPostUrl: input("originalPostUrl"),
    publishedAtJst: input("publishedAtJst"),
    sourceNote: input("sourceNote")
  });
  if (!parsed.ok || !parsed.value) redirect("/admin/external-ai-audit?result=invalid");

  const p = parsed.value;
  let message = "saved";
  try {
    await pool.query(
      "INSERT INTO public.external_ai_forecast_archive " +
      "(trade_date, provider_name, code, stock_name, buy_limit, " +
      "original_post_url, claimed_published_at, source_note) " +
      "VALUES ($1::date,$2,$3,$4,$5,$6,$7::timestamptz,$8)",
      [p.tradeDate, p.providerName, p.code, p.stockName, p.buyLimit,
        p.originalPostUrl, p.claimedPublishedAt, p.sourceNote]
    );
  } catch (error) {
    // Idempotent duplicate handling without touching immutable records.
    message = (error as {code?: string})?.code === "23505" ? "duplicate" : "unavailable";
    if (message === "unavailable") console.error("External research-only archive insert unavailable", error);
  }
  redirect("/admin/external-ai-audit?result=" + message);
}
