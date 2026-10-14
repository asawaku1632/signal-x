import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read=p=>readFileSync(p,'utf8');
const runner=read('app/lib/research/bollingerBreakoutArchiveRunner.ts');
const api=read('app/api/admin/bollinger-breakout-shadow/batches/route.ts');
const db=read('supabase/migrations/20261015_bb_breakout_shadow_batch_archive.sql');
const basket=read('app/lib/research/bollingerBreakoutBatches.ts');
const page=read('app/admin/bollinger-breakout-shadow/BollingerBatchArchive.tsx');
const client=read('app/admin/bollinger-breakout-shadow/BollingerBreakoutClient.tsx');
test('four fixed batches contain exactly 20 different valid numeric stock codes',()=>{
  const lines=basket.match(/\['\d{4}'(?:,'\d{4}')+\]/g)??[];
  assert.equal(lines.length,4);
  const all=lines.flatMap(line=>line.match(/\d{4}/g));
  assert.equal(all.length,20);
  assert.equal(new Set(all).size,20);
  assert.ok(all.includes('9984')&&all.includes('3762'));
});
test('claim is durable before Yahoo calls and retries are forbidden',()=>{
  const claim=runner.indexOf('INSERT INTO public.bb_breakout_shadow_batch_attempts');
  const fetched=runner.indexOf('getForwardCandles))');
  assert.ok(claim>=0&&fetched>claim);
  assert.match(runner,/ON CONFLICT \(batch_id,target_date\) DO NOTHING/);
  assert.match(runner,/if\(!claim.rowCount\)/);
  assert.match(runner,/for\(let start=0;start<codes.length;start\+=2\)/);
  assert.doesNotMatch(runner,/setInterval|\/api\/cron|executeTrade|sendNotification/);
});
test('append-only outcome primary key and RLS prevent arbitrary duplicate records',()=>{
  assert.match(db,/PRIMARY KEY\(detector_version,code,signal_time,horizon\)/);
  assert.match(db,/PRIMARY KEY \(batch_id,target_date\)/);
  assert.match(db,/ALTER TABLE public.bb_breakout_shadow_outcomes ENABLE ROW LEVEL SECURITY/);
  assert.match(db,/REVOKE ALL ON public.bb_breakout_shadow_batch_attempts,/);
  assert.match(db,/TO service_role/);
  assert.doesNotMatch(db,/GRANT.*(?:UPDATE|DELETE).*bb_breakout_shadow_outcomes/);
  assert.match(runner,/FROZEN_PRICE_SOURCE_REVISION/);
  assert.match(runner,/ON CONFLICT \(detector_version,code,signal_time,horizon\) DO NOTHING/);
});
test('owner check precedes provider or archive operations in API',()=>{
  const get=api.indexOf('export async function GET');
  const post=api.indexOf('export async function POST');
  assert.ok(api.indexOf('getLearningOwnerSession',get)<api.indexOf('getBollingerBatchProgress',get));
  assert.ok(api.indexOf('getLearningOwnerSession',post)<api.indexOf('runBollingerBatch',post));
  assert.match(api,/INVALID_BATCH/);
  assert.match(api,/Cache-Control.*private, no-store/);
});
test('30 complete cases minimum and three fixed horizons',()=>{
  assert.match(runner,/const n=Number\(r\?\.samples\?\?0\)/);
  assert.match(runner,/n>=30/);
  assert.match(runner,/\[1,3,5\] as const/);
  assert.match(runner,/result\?\.status!=="COMPLETE"/);
  assert.match(runner,/expectedDates/);
  assert.match(runner,/splitEvents/);
});
test('manual only, no changes to existing trading or cron code',()=>{
  assert.match(client,/<BollingerBatchArchive\/>/);
  assert.match(page,/onClick=\{run\}/);
  assert.match(page,/今回、新規保存した期間別結果/);
  assert.doesNotMatch(runner,/\/api\/scan|\/api\/ranking|notificationEngine|aiPower|nextAuth/);
  assert.doesNotMatch(api,/export async function PUT|export async function DELETE/);
});
