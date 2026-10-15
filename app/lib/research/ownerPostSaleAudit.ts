import pool from "@/app/lib/postgres";
import { getForwardCandles } from "@/app/lib/emaForwardShadowStore";
import { getJstDateString } from "@/app/lib/learning/learningSaveStatus";
import { isTseTradingDate, isTseTargetDateReady, resolveTseTradingDatesAfter } from "@/app/lib/technicalObservation/tseMarketCalendar";

const HORIZONS = [1, 3, 5] as const;
const LIMIT = 150;
const MAX_YAHOO_CODES_PER_RUN = 8;
const yahooJstDate = (unix: number) => new Date(unix * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
type Price = number | string | null;
type Row = {
  id: number | string; owner_email: string; code: string; name: string;
  sale_date: Date | string; buy_price: Price; sale_price: Price; quantity: number;
  cohort: "FORWARD" | "LATE_REGISTERED"; created_at: Date | string;
  outcome_1d_date: Date | string | null; outcome_1d_price: Price;
  outcome_3d_date: Date | string | null; outcome_3d_price: Price;
  outcome_5d_date: Date | string | null; outcome_5d_price: Price;
};
const dateOnly = (v: Date | string) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const validPrice = (v: Price) => v != null && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;

export type NewSale = {
  code: string; name: string; saleDate: string; buyPrice: number; salePrice: number; quantity: number;
};

export function validatePostSale(input: NewSale, today = getJstDateString()): string | null {
  if (!/^[0-9]{4}$/.test(input.code) || !input.name || input.name.length > 100) return "銘柄コードと名前を確認してください";
  if (![input.buyPrice, input.salePrice, input.quantity].every(Number.isFinite) ||
      input.buyPrice <= 0 || input.salePrice <= 0 || !Number.isInteger(input.quantity) ||
      input.quantity < 1 || input.quantity > 1000000) return "価格・株数を確認してください";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.saleDate) || input.saleDate > today) return "売却日を確認してください";
  try {
    if (!isTseTradingDate(input.saleDate)) return "売却日は取引日を指定してください";
  } catch { return "市場カレンダーの対象外です"; }
  return null;
}

export async function registerPostSale(ownerEmail: string, input: NewSale) {
  const problem = validatePostSale(input);
  if (problem) throw new Error(problem);
  const cohort = input.saleDate === getJstDateString() ? "FORWARD" : "LATE_REGISTERED";
  const result = await pool.query<{ id: number | string }>(
    "INSERT INTO public.owner_post_sale_audits " +
    "(owner_email, code, name, sale_date, buy_price, sale_price, quantity, cohort) " +
    "VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8) " +
    "ON CONFLICT ON CONSTRAINT owner_post_sale_unique_trade DO NOTHING RETURNING id",
    [ownerEmail.toLowerCase(), input.code, input.name, input.saleDate, input.buyPrice,
     input.salePrice, input.quantity, cohort],
  );
  return { created: result.rowCount === 1, id: result.rows[0]?.id ?? null, cohort };
}

export async function updatePostSaleOutcomes() {
  // Independent, limited daily follow-up. No stock trading, AI changes or notifications.
  const pending = await pool.query<Row>(
    "SELECT * FROM public.owner_post_sale_audits " +
    "WHERE outcome_1d_price IS NULL OR outcome_3d_price IS NULL OR outcome_5d_price IS NULL " +
    "ORDER BY sale_date DESC, id DESC LIMIT $1",
    [LIMIT],
  );
  let updated = 0, unavailable = 0;
  const byCode = new Map<string, Awaited<ReturnType<typeof getForwardCandles>> | null>();
  for (const sale of pending.rows) {
    let sessions: string[];
    try { sessions = resolveTseTradingDatesAfter(dateOnly(sale.sale_date), 5, { maxLookaheadDays: 20 }); }
    catch { unavailable++; continue; }
    const due = HORIZONS.filter(days => {
      const day = sessions[days - 1];
      // Yahoo's current-day 1d candle can still be provisional.
      // Use yesterday-or-earlier daily bars only. Automatic audits lag at least one market day.
      if (day >= getJstDateString()) return false;
      try { return isTseTargetDateReady(day); } catch { return false; }
    }).filter(days => sale[("outcome_" + days + "d_price") as keyof Row] == null);
    if (due.length === 0) continue;
    if (!byCode.has(sale.code)) {
      if (byCode.size >= MAX_YAHOO_CODES_PER_RUN) { unavailable++; continue; }
      try { byCode.set(sale.code, await getForwardCandles(sale.code)); }
      catch (error) {
        console.warn("[owner-post-sale] no completed daily data", sale.code,
          error instanceof Error ? error.message : "UNKNOWN");
        byCode.set(sale.code, null);
      }
    }
    const archive = byCode.get(sale.code);
    if (!archive) { unavailable++; continue; }
    const saleDate = dateOnly(sale.sale_date);
    for (const days of due) {
      const targetDate = sessions[days - 1];
      // A split between execution and checkpoint invalidates a raw-price comparison.
      if (archive.splitEvents.some(unix => {
        const d = yahooJstDate(unix);
        return d > saleDate && d <= targetDate;
      })) { unavailable++; continue; }
      const bar = archive.candles.find(item => yahooJstDate(item.time) === targetDate);
      const price = validPrice(bar?.close ?? null);
      if (price === null || !bar || !Number.isFinite(bar.low) || !Number.isFinite(bar.high) ||
          bar.low <= 0 || bar.high < Math.max(bar.close, bar.open)) {
        unavailable++; continue;
      }
      const wrote = await pool.query(
        "UPDATE public.owner_post_sale_audits SET outcome_" + days + "d_date=$2::date, " +
        "outcome_" + days + "d_price=$3, updated_at=now() WHERE id=$1 " +
        "AND outcome_" + days + "d_price IS NULL",
        [sale.id, targetDate, price],
      );
      updated += wrote.rowCount ?? 0;
    }
  }
  return { checked: pending.rows.length, checkpointsSaved: updated, priceUnavailable: unavailable,
    provider: "YAHOO_DAILY_CLOSE", uniqueCodesRequested: byCode.size,
    sameDayBarsExcluded: true };
}

export async function getPostSaleReport(ownerEmail: string) {
  const query = await pool.query<Row>(
    "SELECT * FROM public.owner_post_sale_audits WHERE owner_email=$1 " +
    "ORDER BY sale_date DESC, id DESC LIMIT $2",
    [ownerEmail.toLowerCase(), LIMIT],
  );
  const items = query.rows.map(row => {
    const buy = validPrice(row.buy_price)!;
    const sell = validPrice(row.sale_price)!;
    const outcomes = HORIZONS.map(days => {
      const price = validPrice(row[("outcome_" + days + "d_price") as keyof Row] as Price);
      const date = row[("outcome_" + days + "d_date") as keyof Row] as Date | string | null;
      return { days, date: date ? dateOnly(date) : null, price,
        extraYen: price === null ? null : Math.round((price - sell) * row.quantity),
        holdProfitYen: price === null ? null : Math.round((price - buy) * row.quantity),
        changePercent: price === null ? null : (price / sell - 1) * 100 };
    });
    return { id: String(row.id), code: row.code, name: row.name, saleDate: dateOnly(row.sale_date),
      buyPrice: buy, salePrice: sell, quantity: row.quantity, cohort: row.cohort,
      createdAt: new Date(row.created_at).toISOString(),
      realizedProfitYen: Math.round((sell - buy) * row.quantity), outcomes };
  });
  const cohorts = (["FORWARD", "LATE_REGISTERED"] as const).map(cohort => ({
    cohort, total: items.filter(x => x.cohort === cohort).length,
    summary: HORIZONS.map((days, index) => {
      const cases = items.filter(x => x.cohort === cohort).map(x => x.outcomes[index])
        .filter(x => x.extraYen !== null);
      const gains = cases.filter(x => x.extraYen! > 0).length;
      const protectedCount = cases.filter(x => x.extraYen! < 0).length;
      return { days, evaluated: cases.length, earlySaleCount: gains, protectedCount,
        earlySaleRate: cases.length ? gains / cases.length * 100 : null };
    }),
  }));
  return { items, cohorts, horizons: [...HORIZONS],
    note: "手入力された約定履歴と、Yahoo Financeの翌取引日以降に確定した日足終値を比較。日足の反映を待つため追跡結果は少なくとも1営業日遅れます。価格は実際の約定可能価格や取引手数料を保証しません。過去日付で登録された取引は後知恵の影響を排除できないため別集計。税金・手数料、途中の高安値は計算外。"
  };
}
