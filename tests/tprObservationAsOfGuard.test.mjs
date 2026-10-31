import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/lib/learning/trendPullbackReversal.ts', import.meta.url), 'utf8');
const observation = source.split('export async function updateTrendPullbackReversalOutcomes')[0];

test('TPR observations use distinct historical trading dates', () => {
  assert.match(observation, /DISTINCT ON \(d3\.date::date\)/);
  assert.match(observation, /OFFSET 2 LIMIT 1/);
});
test('TPR observations select one same-day price and bound snapshot creation', () => {
  assert.match(observation, /JOIN LATERAL/);
  assert.match(observation, /d\.created_at < \(p\.trade_date \+ INTERVAL '1 day'\)/);
  assert.match(observation, /ORDER BY d\.created_at DESC LIMIT 1/);
});
test('TPR learning and market inputs have explicit JST cutoff', () => {
  assert.match(observation, /AT TIME ZONE 'Asia\/Tokyo'/);
  assert.match(observation, /ml\.created_at </);
  assert.match(observation, /pattern_learning_logs WHERE trade_date=\$1::date/);
});
