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

export type ComparedRecord = OutcomeRecord & { previous_candidate_change_pct: number | string | null };

export function sameDayComparison(rows: ComparedRecord[]) {
  const byDate = new Map<string, { risk: number[]; other: number[] }>();
  for (const row of rows) {
    const outcome = validOutcome(row.return_5d);
    const change = validOutcome(row.previous_candidate_change_pct);
    if (outcome === null || change === null) continue;
    const group = byDate.get(row.trade_date) ?? { risk: [], other: [] };
    (change < -5 ? group.risk : group.other).push(outcome);
    byDate.set(row.trade_date, group);
  }
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const matchedDays = [...byDate.entries()]
    .filter(([, group]) => group.risk.length > 0 && group.other.length > 0)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, group]) => {
      const riskMean = mean(group.risk);
      const otherMean = mean(group.other);
      return { date, riskCount: group.risk.length, otherCount: group.other.length,
        riskMean, otherMean, gap: riskMean - otherMean };
    });
  return {
    days: matchedDays,
    dateBalancedGap: matchedDays.length ? mean(matchedDays.map(day => day.gap)) : null,
    matchedDayCount: matchedDays.length,
  };
}
