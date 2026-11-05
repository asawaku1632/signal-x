import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  FOUR_PATTERN_IDS, auditFourPatternCandles, verifiedFundamentalsAt,
  signalAtFourPatterns, studyFourPatterns,
} from '../app/lib/research/fourStrategyShadow.mjs';

function bar(i, close = 100 + i * 0.01, extras = {}) {
  const open = extras.open ?? close - 0.1;
  return {
    time: 1790000000 + i * 86400,
    open, high: extras.high ?? Math.max(open, close) + 0.3,
    low: extras.low ?? Math.min(open, close) - 0.3,
    close, volume: extras.volume ?? 1000,
  };
}
const flat = (count = 96) => Array.from({ length: count }, (_, i) => bar(i));
function compression(count = 96) {
  const bars = flat(count);
  bars[90] = bar(90, 104, { open: 101, high: 104.5, low: 100.5, volume: 3000 });
  for (let i = 91; i < count; i++) bars[i] = bar(i, 104.2 + (i - 91) * 0.4,
    { open: 104 + (i - 91) * 0.4, high: 105 + (i - 91) * 0.4, low: 103.5 });
  return bars;
}
const goodFundamentals = time => [{
  publishedAt: time, revenueGrowthPct: 9, operatingProfitGrowthPct: 14,
  equityRatioPct: 55, operatingCashFlowYen: 100000000,
}];
test('all four strategies are independent, with fixed names', () => {
  assert.deepEqual(FOUR_PATTERN_IDS, [
    'BREAKOUT_RETEST', 'EMA_COMPRESSION', 'HIGHER_LOW', 'QUALITY_PULLBACK']);
});
test('invalid, missing volume, gap and unsorted history fail closed', () => {
  assert.equal(auditFourPatternCandles(flat(25)), 'INSUFFICIENT_OR_EXCESSIVE_HISTORY');
  const noVolume = flat(); delete noVolume[5].volume;
  assert.equal(auditFourPatternCandles(noVolume), 'INVALID_OHLCV_OR_ORDER');
  const duplicate = flat(); duplicate[6].time = duplicate[5].time;
  assert.equal(auditFourPatternCandles(duplicate), 'INVALID_OHLCV_OR_ORDER');
  const split = flat(); split[60] = bar(60, 170, { open: 170, high: 171, low: 169 });
  assert.equal(auditFourPatternCandles(split), 'CORPORATE_ACTION_OR_PRICE_GAP_REVIEW');
  assert.equal(studyFourPatterns({ code:'7203', candles: noVolume }).rows.length, 0);
});
test('historical EMA compression needs high breakout and prior volume confirmation', () => {
  const input = compression();
  const signal = signalAtFourPatterns({ candles: input, index: 90 });
  assert.ok(signal.some(x => x.strategy === 'EMA_COMPRESSION'));
  const thin = compression(); thin[90].volume = 800;
  assert.equal(signalAtFourPatterns({ candles: thin, index: 90 })
    .some(x => x.strategy === 'EMA_COMPRESSION'), false);
});
test('future OHLC mutations do not change signal at the decision bar', () => {
  const original = compression();
  const expected = signalAtFourPatterns({ candles: original, index: 90 });
  const changed = compression();
  for (let i = 91; i < changed.length; i++) changed[i] = bar(i, 500, {
    open: 500, high: 502, low: 498, volume: 900000 });
  assert.deepEqual(signalAtFourPatterns({ candles: changed, index: 90 }), expected);
});
test('no unverified or future financial result is accepted', () => {
  const bars = flat();
  assert.equal(verifiedFundamentalsAt([], bars[90].time), null);
  assert.equal(verifiedFundamentalsAt(goodFundamentals(bars[90].time + 60), bars[90].time), null);
  assert.ok(verifiedFundamentalsAt(goodFundamentals(bars[90].time), bars[90].time));
  const weak = goodFundamentals(bars[90].time);
  weak[0].operatingProfitGrowthPct = -1;
  assert.equal(verifiedFundamentalsAt(weak, bars[90].time), null);
  assert.equal(studyFourPatterns({ code:'7203', candles: bars }).summaries
    .find(s => s.strategy === 'QUALITY_PULLBACK').signals, 0);
});
test('signal freeze, next-open entry, completed outcomes and correct horizon labels', () => {
  const data = compression();
  const result = studyFourPatterns({ code:'7203', candles: data });
  const row = result.rows.find(x => x.strategy === 'EMA_COMPRESSION' && x.index === 90);
  assert.ok(row);
  assert.equal(row.outcomes.find(x => x.horizon === 5).entryTime, data[91].time);
  assert.equal(row.outcomes.find(x => x.horizon === 5).exitTime, data[95].time);
  assert.equal(result.metricsUnit, 'TRADING_SESSIONS');
  assert.equal(result.eligibleForNotifications, false);
  assert.equal(result.eligibleForLiveOrders, false);
  const pending = studyFourPatterns({ code:'7203', candles: data.slice(0, 92) });
  const truncated = pending.rows.find(x => x.index === 90 && x.strategy === 'EMA_COMPRESSION');
  assert.ok(truncated);
  assert.equal(truncated.outcomes.find(x => x.horizon === 5).status, 'PENDING');
  assert.equal(pending.summaries.find(s => s.strategy === 'EMA_COMPRESSION').measured5, 0);
  assert.equal(pending.summaries.find(s => s.strategy === 'EMA_COMPRESSION').winRate5Percent, null);
  const bars = studyFourPatterns({ code:'7203', candles: data, timeframe:'30m' });
  assert.equal(bars.metricsUnit, 'BARS');
});
test('production AI scoring, notifications, network and DB are never imported', () => {
  const source = readFileSync(new URL('../app/lib/research/fourStrategyShadow.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:\bfetch\s*\(|\bINSERT\b|\bUPDATE\b|\bDELETE\b|sendLine|calculateAiScore|process\.env)/);
});

test('retained two-peak breakout enters only after confirmed retest', () => {
  const bars = Array.from({ length: 100 }, (_, i) => bar(i, 90 + i * 0.22, {
    open: 89.8 + i * 0.22, high: 90.6 + i * 0.22,
    low: 89.2 + i * 0.22 }));
  bars[60] = bar(60, 103.2, { open: 103, high: 114, low: 102.5 });
  bars[72] = bar(72, 105.84, { open: 105.5, high: 114.2, low: 105 });
  bars[90] = bar(90, 116, { open: 111, high: 117, low: 110, volume: 2500 });
  bars[91] = bar(91, 115.5, { open: 114, high: 116, low: 113.5 });
  const initial = signalAtFourPatterns({ candles: bars, index: 90 });
  assert.equal(initial.some(s => s.strategy === 'BREAKOUT_RETEST'), false);
  const confirmed = signalAtFourPatterns({ candles: bars, index: 91 });
  assert.ok(confirmed.some(s => s.strategy === 'BREAKOUT_RETEST'));
});
test('higher low is confirmed by a later bullish bar rather than hindsight', () => {
  const bars = flat();
  bars[70] = bar(70, 94, { open: 93.5, high: 94.5, low: 92 });
  bars[86] = bar(86, 95, { open: 94.6, high: 95.5, low: 93 });
  bars[90] = bar(90, 104, { open: 101, high: 104.5, low: 100.4 });
  assert.ok(signalAtFourPatterns({ candles: bars, index: 90 })
    .some(s => s.strategy === 'HIGHER_LOW'));
  const disqualified = flat();
  disqualified[70] = bars[70];
  disqualified[86] = bar(86, 91, { open: 90, high: 91.5, low: 89 });
  disqualified[90] = bars[90];
  assert.equal(signalAtFourPatterns({ candles: disqualified, index: 90 })
    .some(s => s.strategy === 'HIGHER_LOW'), false);
});
test('quality pullback requires point-in-time good fundamentals AND price rebound', () => {
  const bars = Array.from({ length: 105 }, (_, i) => bar(i, 100 + i * 0.35));
  const prices = [126, 124, 121, 120];
  for (let i = 96; i <= 99; i++) {
    bars[i] = bar(i, prices[i - 96], { open: prices[i - 96] + 1,
      high: prices[i - 96] + 2, low: prices[i - 96] - 1 });
  }
  bars[100] = bar(100, 130, { open: 124, high: 131, low: 123 });
  const confirmed = signalAtFourPatterns({
    candles: bars, fundamentals: goodFundamentals(bars[99].time), index: 100,
  });
  assert.ok(confirmed.some(s => s.strategy === 'QUALITY_PULLBACK'));
  assert.equal(signalAtFourPatterns({ candles: bars, index: 100 })
    .some(s => s.strategy === 'QUALITY_PULLBACK'), false);
});
