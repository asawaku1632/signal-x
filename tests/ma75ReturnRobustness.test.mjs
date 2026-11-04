import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMa75Robustness } from '../app/lib/research/ma75ReturnRobustness.mjs';

test('empty results do not imply success', () => {
  const result = summarizeMa75Robustness([]);
  assert.equal(result.overall.mean, null);
  assert.equal(result.eligibleForProduction, false);
});

test('date-balanced average differs from trade average', () => {
  const result = summarizeMa75Robustness([
    { code: '1001', date: '2026-10-01', return5Percent: 10, regime: 'DOWN' },
    { code: '1002', date: '2026-10-01', return5Percent: 10, regime: 'DOWN' },
    { code: '1001', date: '2026-10-02', return5Percent: -10, regime: 'UP' },
  ]);
  assert.ok(Math.abs(result.overall.mean - 10 / 3) < 1e-10);
  assert.equal(result.overall.equalDateMean, 0);
  assert.equal(result.regimes.DOWN.count, 2);
});

test('duplicate and invalid returns are rejected', () => {
  assert.throws(() => summarizeMa75Robustness([
    { code: '1001', date: '2026-10-01', return5Percent: 1 },
    { code: '1001', date: '2026-10-01', return5Percent: 2 },
  ]));
  assert.throws(() => summarizeMa75Robustness([
    { code: '1001', date: '2026-10-01', return5Percent: NaN },
  ]));
});

test('rejects impossible dates and unknown regime labels', () => {
  assert.throws(() => summarizeMa75Robustness([
    { code: '1001', date: '2026-02-30', return5Percent: 1, regime: 'DOWN' },
  ]));
  assert.throws(() => summarizeMa75Robustness([
    { code: '1001', date: '2026-10-01', return5Percent: 1, regime: 'FUTURE_UP' },
  ]));
});

test('trimmed mean limits a single extreme outlier in a sufficiently large sample', () => {
  const rows = Array.from({length: 20}, (_, i) => ({
    code: String(1000+i), date: '2026-10-01', return5Percent: i === 0 ? 113.81 : 0,
    regime: 'DOWN',
  }));
  const result = summarizeMa75Robustness(rows);
  assert.ok(result.overall.mean > 5);
  assert.equal(result.overall.trimmedMean, 0);
  assert.equal(result.overall.distinctDates, 1);
  assert.equal(result.eligibleForNotifications, false);
});
