import pool from "@/app/lib/postgres";

export type DailyStockResult = {
  id: string;
  date: string;
  code: string;
  name: string;
  score: number;
  price: number;
  nextPrice: number | null;
  changePercent: number | null;
  result: "WIN" | "LOSE" | "HOLD" | "UNKNOWN";
  checkedAt: string | null;
  createdAt: string;
};

function mapRow(row: any): DailyStockResult {
  return {
    id: row.id,
    date: row.date,
    code: row.code,
    name: row.name,
    score: Number(row.score ?? 0),
    price: Number(row.price ?? 0),
    nextPrice: row.next_price === null ? null : Number(row.next_price),
    changePercent:
      row.change_percent === null ? null : Number(row.change_percent),
    result: row.result,
    checkedAt: row.checked_at,
    createdAt: row.created_at,
  };
}

export async function getDailyStockResults(): Promise<DailyStockResult[]> {
  const { rows } = await pool.query(`
    SELECT *
    FROM daily_stock_results
    ORDER BY created_at DESC
  `);

  return rows.map(mapRow);
}

export async function saveDailyStocks(
  date: string,
  stocks: {
    code: string;
    name: string;
    score?: number;
    aiPower?: number;
    price?: number;
  }[]
) {
  const validStocks = stocks.filter((stock) => {
    const price = stock.price ?? 0;

    return Boolean(stock.code && stock.name && price > 0);
  });

  const invalidCount = stocks.length - validStocks.length;

  if (validStocks.length === 0) {
    const totalResult = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM daily_stock_results
    `);

    return {
      added: 0,
      skipped: stocks.length,
      total: totalResult.rows[0]?.total ?? 0,
    };
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];

  validStocks.forEach((stock, index) => {
    const base = index * 6;
    const score = stock.score ?? stock.aiPower ?? 0;
    const price = stock.price ?? 0;
    const id = `${date}-${stock.code}`;

    values.push(id, date, stock.code, stock.name, score, price);

    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
        base + 5
      }, $${base + 6}, 'UNKNOWN', NOW())`
    );
  });

  const insertResult = await pool.query(
    `
    INSERT INTO daily_stock_results (
      id,
      date,
      code,
      name,
      score,
      price,
      result,
      created_at
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (id) DO NOTHING
    RETURNING id
    `,
    values
  );

  const added = insertResult.rowCount ?? 0;
  const conflictSkipped = validStocks.length - added;
  const skipped = invalidCount + conflictSkipped;

  const totalResult = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM daily_stock_results
  `);

  return {
    added,
    skipped,
    total: totalResult.rows[0]?.total ?? 0,
  };
}

export async function updateDailyStockResult(
  id: string,
  data: {
    nextPrice: number;
    changePercent: number;
    result: "WIN" | "LOSE" | "HOLD";
  }
) {
  const { rows } = await pool.query(
    `
    UPDATE daily_stock_results
    SET
      next_price = $1,
      change_percent = $2,
      result = $3,
      checked_at = NOW()
    WHERE id = $4
    RETURNING *
    `,
    [data.nextPrice, data.changePercent, data.result, id]
  );

  if (!rows[0]) return null;

  return mapRow(rows[0]);
}