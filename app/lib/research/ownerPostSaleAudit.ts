import pool from "@/app/lib/postgres";
import { getJstDateString } from "@/app/lib/learning/learningSaveStatus";
import { isTseTradingDate, isTseTargetDateReady, resolveTseTradingDatesAfter } from "@/app/lib/technicalObservation/tseMarketCalendar";

const HORIZONS = [1, 3, 5] as const;
const LIMIT = 150;
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
  // Only reading immutable owner-entered executions; no order/paper trade/AI mutations.
  const pending = await pool.query<Row>(
    "SELECT * FROM public.owner_post_sale_audits " +
    "WHERE outcome_1d_price IS NULL OR outcome_3d_price IS NULL OR outcome_5d_price IS NULL " +
    "ORDER BY sale_date DESC, id DESC LIMIT $1",
    [LIMIT],
  );
  let updated = 0;
  let incomplete = 0;
  for (const sale of pending.rows) {
    let sessions: string[];
    try { sessions = resolveTseTradingDatesAfter(dateOnly(sale.sale_date), 5, { maxLookaheadDays: 20 }); }
    catch { incomplete++; continue; }

    for (const days of HORIZONS) {
      if (sale[("outcome_" + days + "d_price") as keyof Row] != null) continue;
      const targetDate = sessions[days - 1];
      try {
        if (!isTseTargetDateReady(targetDate)) continue;
      } catch { continue; }
      // Never use intraday/pre-open or the nearest available day's price.
      // 15:30 JST is the Tokyo cash-market close; these remain reference prices.
      const prices = await pool.query<{ price: Price }>(
        "SELECT price FROM public.daily_stock_results WHERE code=$1 AND date::date=$2::date " +
        "AND price>0 AND created_at >= (($2::date + TIME '15:30') AT TIME ZONE 'Asia/Tokyo') " +
        "AND created_at < ((($2::date + INTERVAL '1 day')::date + TIME '00:00') AT TIME ZONE 'Asia/Tokyo') " +
        "ORDER BY created_at DESC LIMIT 1",
        [sale.code, targetDate],
      );
      const price = validPrice(prices.rows[0]?.price ?? null);
      if (price === null) { incomplete++; continue; }
      // Column names come solely from the fixed, internal HORIZONS tuple.
      const wrote = await pool.query(
        "UPDATE public.owner_post_sale_audits SET outcome_" + days + "d_date=$2::date, " +
        "outcome_" + days + "d_price=$3, updated_at=now() WHERE id=$1 " +
        "AND outcome_" + days + "d_price IS NULL",
        [sale.id, targetDate, price],
      );
      updated += wrote.rowCount ?? 0;
    }
  }
  return { checked: pending.rows.length, checkpointsSaved: updated, priceUnavailable: incomplete };
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
    note: "手入力された約定履歴と、指定営業日の引け後に保存された参考価格を比較。価格は実際の約定可能価格・公式終値を保証しません。過去日付で登録された取引は後知恵の影響を排除できないため別集計。税金・手数料、途中の高安値は計算外。"
  };
}
