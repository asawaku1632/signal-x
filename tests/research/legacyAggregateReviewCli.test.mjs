import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reviewLegacyAggregateFile} from '../../scripts/research/legacy-aggregate-review.mjs';
const summary={total_rows:'2',distinct_signal_dates:'1',distinct_stock_codes:'2',first_signal_date:'2026-08-21',last_signal_date:'2026-08-21',wins:'1',losses:'1',holds:'0',unknowns:'0',checked_rows:'2',future_prices:'2',return_rows:'2',temporal_conflicts:'0',save_date_mismatches:'0'};
const data={summary,daily:[{signal_date:'2026-08-21',rows:'2',resolved:'2',evaluated:'2',priced:'2'}],duplicates:{duplicate_stock_date_groups:'0',duplicate_extra_rows:'0'}};
async function withFile(body,fn){const dir=await mkdtemp(join(tmpdir(),'signalx-aggregate-'));try{const path=join(dir,'aggregate.json');await writeFile(path,body);return await fn(path)}finally{await rm(dir,{recursive:true,force:true})}}
test('realistic PostgreSQL bigint JSON aggregates can be reviewed offline',()=>withFile(JSON.stringify(data),async path=>{const result=await reviewLegacyAggregateFile(path);assert.equal(result.coverage.rows,2);assert.equal(result.coverage.dailyRowsReconciled,true);assert.equal(result.productionEligible,false)}));
test('invalid JSON is rejected',()=>withFile('{bad',async path=>assert.rejects(()=>reviewLegacyAggregateFile(path),/INVALID_AGGREGATE_JSON/)));
test('raw row payloads cannot be smuggled through top-level fields',()=>withFile(JSON.stringify({...data,rawRows:[{code:'9983'}]}),async path=>assert.rejects(()=>reviewLegacyAggregateFile(path),/UNEXPECTED_AGGREGATE_EXPORT_FIELDS/)));
test('missing file path is rejected',async()=>assert.rejects(()=>reviewLegacyAggregateFile(''),/LOCAL_AGGREGATE_FILE_REQUIRED/));
test('missing aggregate sections fail closed',()=>withFile(JSON.stringify({summary}),async path=>assert.rejects(()=>reviewLegacyAggregateFile(path),/INVALID_AGGREGATE_EXPORT/)));
