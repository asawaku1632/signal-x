/** Offline-only descriptive MA75 robustness statistics. */
export function summarizeMa75Robustness(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Expected observations array');
  const ids = new Set();
  const groups = new Map();
  for (const row of rows) {
    if (!row || typeof row.code !== 'string' || typeof row.date !== 'string' ||
        !Number.isFinite(row.return5Percent)) throw new TypeError('Invalid observation');
    const id = row.code + ':' + row.date;
    if (ids.has(id)) throw new TypeError('Duplicate code/date');
    ids.add(id);
    const regime = ['UP', 'DOWN'].includes(row.regime) ? row.regime : 'UNKNOWN';
    if (!groups.has(regime)) groups.set(regime, []);
    groups.get(regime).push(row);
  }
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const summary = subset => {
    if (!subset.length) return { count: 0, mean: null, median: null, trimmedMean: null, equalDateMean: null, positiveRate: null, distinctCodes: 0, distinctDates: 0 };
    const values = subset.map(row => row.return5Percent).sort((a,b) => a-b);
    const cut = Math.floor(values.length / 10);
    const dates = new Map();
    for (const row of subset) {
      if (!dates.has(row.date)) dates.set(row.date, []);
      dates.get(row.date).push(row.return5Percent);
    }
    const mid = Math.floor(values.length / 2);
    return { count: values.length, mean: mean(values),
      median: values.length % 2 ? values[mid] : (values[mid-1]+values[mid])/2,
      trimmedMean: mean(values.slice(cut, values.length-cut)),
      equalDateMean: mean([...dates.values()].map(mean)),
      positiveRate: 100 * values.filter(value => value > 0).length / values.length,
      distinctCodes: new Set(subset.map(row => row.code)).size,
      distinctDates: dates.size };
  };
  return { version: 'ma75_robustness_shadow_v1',
    overall: summary(rows),
    regimes: Object.fromEntries(['UP','DOWN','UNKNOWN'].map(name => [name, summary(groups.get(name) || [])])),
    independentlyValidated: false, eligibleForProduction: false, eligibleForNotifications: false };
}
