export type OutcomeRecord = { trade_date: string; return_5d: number | string | null };

export function validOutcome(value: number | string | null): number | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function summarizeGroup(rows: OutcomeRecord[]) {
  const byDay = new Map<string, number[]>();
  const completed: number[] = [];
  for (const row of rows) {
    const outcome = validOutcome(row.return_5d);
    if (outcome === null) continue;
    completed.push(outcome);
    const values = byDay.get(row.trade_date) ?? [];
    values.push(outcome);
    byDay.set(row.trade_date, values);
  }
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const dayMeans = [...byDay.values()].map(mean);
  return {
    count: rows.length,
    checked: completed.length,
    days: byDay.size,
    average: completed.length ? mean(completed) : null,
    dateBalancedAverage: dayMeans.length ? mean(dayMeans) : null,
  };
}

export function withoutLargestDay(rows: OutcomeRecord[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (validOutcome(row.return_5d) === null) continue;
    counts.set(row.trade_date, (counts.get(row.trade_date) ?? 0) + 1);
  }
  const topDate = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const remaining = rows.filter(row => row.trade_date !== topDate);
  return { topDate, ...summarizeGroup(remaining) };
}
