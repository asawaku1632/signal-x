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
