import fs from "fs/promises";
import path from "path";

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

const filePath = path.join(
  process.cwd(),
  "data",
  "daily-stock-results.json"
);

async function ensureFile() {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf-8");
  }
}

export async function getDailyStockResults(): Promise<DailyStockResult[]> {
  await ensureFile();

  const text = await fs.readFile(filePath, "utf-8");
  return JSON.parse(text || "[]");
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
  const results = await getDailyStockResults();

  let added = 0;
  let skipped = 0;

  for (const stock of stocks) {
    const exists = results.find(
      (item) =>
        item.date === date &&
        item.code === stock.code
    );

    if (exists) {
      skipped += 1;
      continue;
    }

    const score = stock.score ?? stock.aiPower ?? 0;
    const price = stock.price ?? 0;

    if (!stock.code || !stock.name || price <= 0) {
      skipped += 1;
      continue;
    }

    results.push({
      id: `${date}-${stock.code}`,
      date,
      code: stock.code,
      name: stock.name,

      score,
      price,

      nextPrice: null,
      changePercent: null,

      result: "UNKNOWN",

      checkedAt: null,
      createdAt: new Date().toISOString(),
    });

    added += 1;
  }

  await fs.writeFile(
    filePath,
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  return {
    added,
    skipped,
    total: results.length,
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
  const results = await getDailyStockResults();

  const target = results.find(
    (item) => item.id === id
  );

  if (!target) {
    return null;
  }

  target.nextPrice = data.nextPrice;
  target.changePercent = data.changePercent;
  target.result = data.result;
  target.checkedAt = new Date().toISOString();

  await fs.writeFile(
    filePath,
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  return target;
}