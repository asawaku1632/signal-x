#!/usr/bin/env node
/**
 * Offline CLI for pre-aggregated, CLOSED 1D / 30m / 60m OHLCV archives.
 * Usage: node scripts/research/run-four-patterns-shadow.mjs /path/to/archive.json
 * No network, storage, background scans, orders, notification or AI POWER writes.
 */
import { readFileSync, statSync } from 'node:fs';
import { studyFourPatterns } from '../../app/lib/research/fourStrategyShadow.mjs';

const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  console.error('Usage: node scripts/research/run-four-patterns-shadow.mjs archive.json');
  process.exit(2);
}
try {
  if (statSync(file).size > 4_000_000) throw new Error('ARCHIVE_TOO_LARGE');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (!data || Array.isArray(data) || typeof data !== 'object' ||
      !Array.isArray(data.candles) ||
      (data.fundamentals !== undefined && !Array.isArray(data.fundamentals)))
    throw new Error('INVALID_ARCHIVE_FORMAT');
  const report = studyFourPatterns({
    code: data.code, timeframe: data.timeframe, candles: data.candles,
    fundamentals: data.fundamentals ?? [],
    source: 'LOCAL_ARCHIVED_INPUT_UNVERIFIED',
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'OFFLINE_SHADOW_ONLY') process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'INVALID_ARCHIVE');
  process.exitCode = 1;
}
