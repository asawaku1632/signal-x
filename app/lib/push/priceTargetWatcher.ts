import pool from "@/app/lib/postgres";
import { pushWebToUser } from "./userPush";

type ScanStock = { code?: string | number; name?: string; price?: number };
type PendingPriceTarget = {
  id: string;
  user_email: string;
  code: string;
  direction: "ABOVE" | "BELOW";
  threshold: number;
};

export async function checkUserPriceTargets(
  stocks: ScanStock[],
  scanMetadata: { status?: string; updatedAt?: string; marketClosed?: boolean },
) {
  const scannedAt = Date.parse(scanMetadata.updatedAt ?? "");
  const ageMs = Date.now() - scannedAt;
  // Never turn a stale or partial research scan into a user's stock-price alert.
  if (scanMetadata.status !== "fresh" || scanMetadata.marketClosed !== false ||
      !Number.isFinite(ageMs) || ageMs < 0 || ageMs > 10 * 60_000 || stocks.length < 800) {
    return { skipped: "SCAN_NOT_FRESH_OR_INCOMPLETE", checked: 0, notified: 0 };
  }

  const prices = new Map<string, { price: number; name: string }>();
  for (const stock of stocks) {
    const code = String(stock.code ?? "");
    const price = Number(stock.price ?? 0);
    if (/^[0-9A-Z]{4}$/.test(code) && Number.isFinite(price) && price > 0) {
      prices.set(code, { price, name: String(stock.name ?? code) });
    }
  }

  // Bounded work: at most 60 pending thresholds per Cron execution.
  const pending = await pool.query<PendingPriceTarget>(
    `SELECT id::text, user_email, code, direction, threshold::float8 AS threshold
     FROM public.push_price_targets
     WHERE notified_at IS NULL ORDER BY created_at ASC LIMIT 60`,
  );
  let notified = 0;
  let attempted = 0;
  for (const target of pending.rows) {
    const stock = prices.get(target.code);
    if (!stock) continue;
    const hit = target.direction === "ABOVE"
      ? stock.price >= target.threshold
      : stock.price <= target.threshold;
    if (!hit) continue;

    const lock = await pool.query(
      `UPDATE public.push_price_targets SET claimed_at = now()
       WHERE id = $1 AND notified_at IS NULL
         AND (claimed_at IS NULL OR claimed_at < now() - interval '5 minutes')
       RETURNING id`, [target.id],
    );
    if (!lock.rows[0]) continue;
    attempted += 1;
    try {
      const push = await pushWebToUser(target.user_email, {
        title: "🎯 SIGNALX 指定株価到達",
        body: `${target.code} ${stock.name}｜参考株価 ${stock.price.toLocaleString("ja-JP")}円｜${target.direction === "ABOVE" ? "以上" : "以下"} ${target.threshold.toLocaleString("ja-JP")}円`,
        url: `/analysis/${target.code}`,
        tag: `signalx-price-target-${target.id}`,
      }, "price_target");

      if (push.ok) {
        await pool.query(
          "UPDATE public.push_price_targets SET notified_at = now(), claimed_at = NULL WHERE id = $1",
          [target.id],
        );
        notified += 1;
      } else {
        await pool.query(
          "UPDATE public.push_price_targets SET claimed_at = NULL WHERE id = $1 AND notified_at IS NULL",
          [target.id],
        );
      }
    } catch (error) {
      await pool.query(
        "UPDATE public.push_price_targets SET claimed_at = NULL WHERE id = $1 AND notified_at IS NULL",
        [target.id],
      ).catch(() => {});
      console.error("Failed to dispatch a price target Web Push", error);
    }
  }
  return { checked: pending.rows.length, attempted, notified };
}
