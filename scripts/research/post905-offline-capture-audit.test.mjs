import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditCaptures, parseArgs, main } from './post905-offline-capture-audit.mjs';

const valid = () => ({
  code:'1301', trade_date:'2026-10-30', source_name:'historical-minute',
  source_bar_at:'2026-10-30T09:04:00+09:00',
  scan_received_at:'2026-10-30T09:04:30+09:00',
  captured_at:'2026-10-30T09:05:00+09:00',
  capture_status:'ACCEPTED'
});

test('timely historical rows remain ineligible for production', () => {
  const r = auditCaptures([valid()]);
  assert.equal(r.timelyHistoricalRecords,1);
  assert.equal(r.reasonCounts.NO_INDEPENDENT_SIGNAL_REPLAY,1);
  assert.equal(r.eligibleForProduction,false);
  assert.equal(r.eligibleForNotifications,false);
});

test('late capture cannot pass 09:05 cutoff', () => {
  const r = auditCaptures([{...valid(),captured_at:'2026-10-30T09:05:01+09:00'}]);
  assert.equal(r.timelyHistoricalRecords,0);
  assert.equal(r.reasonCounts.NOT_AVAILABLE_BY_0905,1);
});

test('rejects duplicate symbol and trade date', () => {
  assert.throws(()=>auditCaptures([valid(),valid()]),/DUPLICATE_SCOPE/);
});

test('rejects malformed input and untrusted scope', () => {
  assert.throws(()=>auditCaptures({rows:[]}),/INPUT_MUST_BE_ARRAY/);
  assert.throws(()=>auditCaptures([{...valid(),code:'1301; DROP'}]),/INVALID_SCOPE/);
  assert.throws(()=>auditCaptures([null]),/INVALID_ROW/);
});

test('output is exclusive and does not expose raw records', () => {
  const dir=mkdtempSync(join(tmpdir(),'post905-audit-'));
  try {
    const input=join(dir,'rows.json'),output=join(dir,'summary.json');
    writeFileSync(input,JSON.stringify([valid()]));
    const r=main(['--input='+input,'--output='+output]);
    assert.equal(r.rows,1);
    assert.equal(JSON.parse(readFileSync(output,'utf8')).timelyHistoricalRecords,1);
    assert.equal(readFileSync(output,'utf8').includes('source_bar_at'),false);
    assert.throws(()=>main(['--input='+input,'--output='+output]),/EEXIST/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('requires separate input and output paths', () => {
  assert.throws(()=>parseArgs(['--input=x','--output=x']),/INPUT_OUTPUT_REQUIRED/);
  assert.throws(()=>parseArgs(['--input=x','--output=y','--unknown=z']),/INVALID_ARGUMENTS/);
});
