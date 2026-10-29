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

export function outcomeCoverageByDate(rows: OutcomeRecord[]) {
  const dates = new Map<string, { total: number; completed: number }>();
  for (const row of rows) {
    const item = dates.get(row.trade_date) ?? { total: 0, completed: 0 };
    item.total++;
    if (validOutcome(row.return_5d) !== null) item.completed++;
    dates.set(row.trade_date, item);
  }
  return [...dates.entries()].sort(([a], [b]) => b.localeCompare(a))
    .map(([date, item]) => ({ date, ...item, pending: item.total - item.completed,
      completionRate: item.total ? 100 * item.completed / item.total : 0 }));
}

export function matchedDaySensitivity(rows: ComparedRecord[]) {
  const comparison = sameDayComparison(rows);
  const days = comparison.days;
  const variants = days.map(excluded => {
    const remaining = days.filter(day => day.date !== excluded.date);
    return {
      excludedDate: excluded.date,
      remainingDays: remaining.length,
      averageGap: remaining.length
        ? remaining.reduce((sum, day) => sum + day.gap, 0) / remaining.length
        : null,
    };
  });
  const remainingMeans = variants.map(v => v.averageGap).filter((v): v is number => v !== null);
  return {
    variants,
    minimum: remainingMeans.length ? Math.min(...remainingMeans) : null,
    maximum: remainingMeans.length ? Math.max(...remainingMeans) : null,
  };
}

export function assessedOutcomeCoverage(rows: OutcomeRecord[]) {
  const total = rows.length;
  const checked = rows.filter(row => validOutcome(row.return_5d) !== null).length;
  return { total, checked, pending: total - checked,
    completionRate: total ? checked / total * 100 : null };
}

export function thresholdSensitivity(rows: ComparedRecord[], thresholds = [3, 5, 7]) {
  return thresholds.map(drop => {
    const atRisk = rows.filter(row => {
      const change = validOutcome(row.previous_candidate_change_pct);
      return change !== null && change < -drop;
    });
    const result = summarizeGroup(atRisk);
    return { drop, ...result, pending: result.count - result.checked };
  });
}

export type OutcomeDatedRecord = OutcomeRecord & { outcome_5d_date: string | null };
export function outcomeDateIntegrity(rows: OutcomeDatedRecord[]) {
  let returnWithoutDate = 0;
  let dateWithoutReturn = 0;
  let outcomeBeforeTrade = 0;
  for (const row of rows) {
    const hasReturn = validOutcome(row.return_5d) !== null;
    const date = row.outcome_5d_date?.trim() || null;
    if (hasReturn && !date) returnWithoutDate++;
    if (!hasReturn && date) dateWithoutReturn++;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < row.trade_date) outcomeBeforeTrade++;
  }
  return { returnWithoutDate, dateWithoutReturn, outcomeBeforeTrade,
    suspectCount: returnWithoutDate + dateWithoutReturn + outcomeBeforeTrade };
}

/** Retain pending observations but prevent inconsistent dated outcomes from entering metrics. */
export function excludeUnverifiedDatedOutcomes<T extends OutcomeDatedRecord>(rows: T[]): T[] {
  return rows.map(row => {
    const outcome = validOutcome(row.return_5d);
    if (outcome === null) return row;
    const date = row.outcome_5d_date?.trim() ?? "";
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
      && date > row.trade_date
      && !Number.isNaN(Date.parse(date + "T00:00:00Z"))
      && new Date(date + "T00:00:00Z").toISOString().slice(0, 10) === date;
    return validDate ? row : { ...row, return_5d: null };
  });
}

/** Audit only the saved dates; this cannot verify exchange trading calendars or prices. */
export function outcomeCalendarAudit(rows: OutcomeDatedRecord[]) {
  let invalidCalendarDate = 0;
  let sameDayOutcome = 0;
  for (const row of rows) {
    const date = row.outcome_5d_date?.trim();
    if (!date) continue;
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(date + "T00:00:00Z") : NaN;
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date) invalidCalendarDate++;
    else if (date === row.trade_date) sameDayOutcome++;
  }
  return { invalidCalendarDate, sameDayOutcome };
}
