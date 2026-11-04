import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classifyHistoricalEvidence } from '../../app/lib/research/post905EvidenceClassification.mjs';

const datePattern = /^20\d\d-\d\d-\d\d$/;
function validTradeDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
const allowed = new Set(['--input', '--output']);

export function auditCaptures(rows) {
  if (!Array.isArray(rows)) throw new Error('INPUT_MUST_BE_ARRAY');
  const seen = new Set();
  const reasons = {};
  let timely = 0, scoped = 0;
  const dates = new Set();
  const codes = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('INVALID_ROW');
    const code = row.code, date = row.trade_date;
    if (typeof code !== 'string' || !/^(?:\d{4}|\d{3}[A-Z])$/.test(code) || !validTradeDate(date)) throw new Error('INVALID_SCOPE');
    const key = date + '/' + code;
    if (seen.has(key)) throw new Error('DUPLICATE_SCOPE');
    seen.add(key); dates.add(date); codes.add(code); scoped++;
    const result = classifyHistoricalEvidence(row, {code, date});
    if (result.timestampsWithin905 && result.sourcePresent && !result.reasons.includes('CAPTURE_STATUS_NOT_ACCEPTED')) timely++;
    for (const reason of result.reasons) reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  return {
    version: 'post905_offline_capture_audit_v1', inputRows: rows.length,
    uniqueScopes: scoped, uniqueDates: dates.size, uniqueCodes: codes.size,
    timelyHistoricalRecords: timely, reasonCounts: Object.fromEntries(Object.entries(reasons).sort()),
    historicalOnly: true, independentCaptureVerified: false,
    verifiedTradingEdge: false, eligibleForNotifications: false, eligibleForProduction: false
  };
}

export function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    const i = arg.indexOf('='), key = arg.slice(0, i), value = arg.slice(i + 1);
    if (i < 0 || !allowed.has(key) || !value || options[key]) throw new Error('INVALID_ARGUMENTS');
    options[key] = value;
  }
  if (!options['--input'] || !options['--output'] || resolve(options['--input']) === resolve(options['--output'])) throw new Error('INPUT_OUTPUT_REQUIRED_AND_DISTINCT');
  return options;
}

export function main(argv) {
  const args = parseArgs(argv);
  const input = JSON.parse(readFileSync(args['--input'], 'utf8'));
  const result = auditCaptures(input);
  writeFileSync(args['--output'], JSON.stringify(result, null, 2) + '\n', {flag:'wx', mode:0o600});
  return {status:'OFFLINE_CAPTURE_AUDIT_CREATED', output: args['--output'], rows: result.inputRows, timelyHistoricalRecords: result.timelyHistoricalRecords};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)))); }
  catch (e) { console.error('OFFLINE_CAPTURE_AUDIT_FAILED:', e.code === 'EEXIST' ? 'OUTPUT_EXISTS' : e.message); process.exitCode = 1; }
}
