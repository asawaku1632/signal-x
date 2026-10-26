import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteDateJst } from '../app/lib/marketScanGuard.ts';

test('Unix-seconds quote timestamp resolves to Tokyo trading date', () => {
  const timestamp = Date.parse('2026-10-26T00:02:00Z') / 1000;
  assert.equal(quoteDateJst(timestamp), '2026-10-26');
  assert.equal(new Date(timestamp * 1000).toISOString(), '2026-10-26T00:02:00.000Z');
});

test('previous-day quote must not match current trading day', () => {
  const timestamp = Date.parse('2026-10-23T06:30:00Z') / 1000;
  assert.notEqual(quoteDateJst(timestamp), '2026-10-26');
});

test('missing, empty and malformed quote timestamps fail closed', () => {
  for (const timestamp of [null, undefined, '', 'bad', 0, -1]) {
    assert.equal(quoteDateJst(timestamp), null);
  }
});
