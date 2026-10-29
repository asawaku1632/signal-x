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
  const sorted = [...completed].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : null;
  return {
    median,
    positiveRate: completed.length ? 100 * completed.filter(value => value > 0).length / completed.length : null,
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

export type ComparedRecord = OutcomeRecord & { previous_candidate_change_pct: number | string | null; previous_candidate_drop_over_5pct?: boolean };

export function sameDayComparison(rows: ComparedRecord[]) {
  const byDate = new Map<string, { risk: number[]; other: number[] }>();
  for (const row of rows) {
    const outcome = validOutcome(row.return_5d);
    const change = validOutcome(row.previous_candidate_change_pct);
    if (outcome === null || change === null) continue;
    const group = byDate.get(row.trade_date) ?? { risk: [], other: [] };
    const isRisk = typeof row.previous_candidate_drop_over_5pct === "boolean" ? row.previous_candidate_drop_over_5pct : change < -5;
    (isRisk ? group.risk : group.other).push(outcome);
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
      return change !== null && (drop === 5 && typeof row.previous_candidate_drop_over_5pct === "boolean"
        ? row.previous_candidate_drop_over_5pct : change < -drop);
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

/** Weekday-only screening, not a JPX trading-calendar verification (holidays are unknown). */
export function weekdayGapAudit(rows: OutcomeDatedRecord[]) {
  const counts = { assessed: 0, weekdayMismatch: 0, insufficientCalendarEvidence: 0 };
  for (const row of rows) {
    if (validOutcome(row.return_5d) === null) continue;
    const start = Date.parse(row.trade_date + "T00:00:00Z");
    const end = Date.parse((row.outcome_5d_date ?? "") + "T00:00:00Z");
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      counts.insufficientCalendarEvidence++;
      continue;
    }
    let weekdays = 0;
    for (let at = start + 86400000; at <= end && weekdays <= 10; at += 86400000) {
      const dow = new Date(at).getUTCDay();
      if (dow !== 0 && dow !== 6) weekdays++;
    }
    counts.assessed++;
    if (weekdays !== 5) counts.weekdayMismatch++;
  }
  return counts;
}

/** Diagnostic only: repeat observations sharing a decision date are not independent trials. */
export function completedDateConcentration(rows: OutcomeRecord[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (validOutcome(row.return_5d) === null) continue;
    counts.set(row.trade_date, (counts.get(row.trade_date) ?? 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = ordered.reduce((sum, [, count]) => sum + count, 0);
  return {
    total,
    days: counts.size,
    dominantDate: ordered[0]?.[0] ?? null,
    dominantCount: ordered[0]?.[1] ?? 0,
    dominantShare: total ? (ordered[0][1] / total) * 100 : null,
  };
}

/** Compare outcome availability across exact risk cohorts, not their investment quality. */
export function cohortCoverageContrast(rows: ComparedRecord[]) {
  const risk = rows.filter(row => row.previous_candidate_drop_over_5pct === true);
  const other = rows.filter(row => row.previous_candidate_drop_over_5pct === false);
  const riskCoverage = assessedOutcomeCoverage(risk);
  const otherCoverage = assessedOutcomeCoverage(other);
  return {
    risk: riskCoverage,
    other: otherCoverage,
    completionGapPoints: riskCoverage.completionRate === null || otherCoverage.completionRate === null
      ? null : riskCoverage.completionRate - otherCoverage.completionRate,
  };
}

export function pairedDayCompletion(rows: ComparedRecord[]) {
  const dates = [...new Set(rows.map(r => r.trade_date))].sort().reverse();
  return dates.map(date => {
    const day = rows.filter(r => r.trade_date === date);
    const risk = assessedOutcomeCoverage(day.filter(r => r.previous_candidate_drop_over_5pct === true));
    const other = assessedOutcomeCoverage(day.filter(r => r.previous_candidate_drop_over_5pct === false));
    return { date, risk, other, bothPresent: risk.total > 0 && other.total > 0, bothComplete: risk.total > 0 && other.total > 0 && risk.pending === 0 && other.pending === 0 };
  }).filter(d => d.bothPresent);
}

/** Sensitivity check: only use dates where both cohorts have all outcomes. */
export function fullyObservedDayComparison(rows: ComparedRecord[]) {
  const pairedDates = pairedDayCompletion(rows);
  const completeDates = new Set(pairedDates.filter(day => day.bothComplete).map(day => day.date));
  const comparison = sameDayComparison(rows.filter(row => completeDates.has(row.trade_date)));
  return { ...comparison, excludedPartialDays: pairedDates.filter(day => !day.bothComplete).length };
}

/** Evidence gate is informational only; it never activates trading or alerts. */
export function repeatRiskEvidenceGate(rows: ComparedRecord[], truncated = false) {
  const complete = fullyObservedDayComparison(rows);
  const riskRows = rows.filter(r => r.previous_candidate_drop_over_5pct === true);
  const concentration = completedDateConcentration(riskRows);
  const reasons: string[] = [];
  if (truncated) reasons.push("取得上限で集計対象が打ち切られています");
  if (complete.matchedDayCount < 5) reasons.push("全件確定した比較可能な取引日が5日未満です");
  if (concentration.dominantShare === null || concentration.dominantShare > 50) reasons.push("評価結果が特定の取引日に集中しています");
  if (riskRows.filter(r => validOutcome(r.return_5d) !== null).length < 30) reasons.push("下落群の評価済み観測が30件未満です");
  const coverage = cohortCoverageContrast(rows);
  const finishedDates = new Set(riskRows.filter(r => validOutcome(r.return_5d) !== null).map(r => r.trade_date));
  if (finishedDates.size < 5) reasons.push("下落群の評価済み取引日が5日未満です");
  if (coverage.risk.pending > 0 || coverage.other.pending > 0) reasons.push("5日後結果が未確定の観測が残っています");
  if (coverage.completionGapPoints !== null && Math.abs(coverage.completionGapPoints) > 10) reasons.push("2群の評価完了率に10ポイント超の差があります");
  const followUp = [
    { task: "独立した価格・結果日を照合", ready: false, detail: "保存価格と外部市場データの一致は未確認" },
    { task: "異なる取引日を追加検証", ready: complete.matchedDayCount >= 5, detail: `全件確定の比較日 ${complete.matchedDayCount}日` },
    { task: "日付集中を再評価", ready: concentration.dominantShare !== null && concentration.dominantShare <= 50, detail: `最多日の占有率 ${concentration.dominantShare?.toFixed(1) ?? "未検証"}%` },
    { task: "未確定結果を追跡", ready: coverage.risk.pending === 0 && coverage.other.pending === 0, detail: `未確定 ${coverage.risk.pending + coverage.other.pending}件` },
  ];
  return { status: "HOLD" as const, reasons, followUp, completeDays: complete.matchedDayCount, dominantShare: concentration.dominantShare,
    note: "暫定的な観測条件です。独立した市場価格照合と将来データでの再現性検証を必要とし、自動採用しません。" };
}
