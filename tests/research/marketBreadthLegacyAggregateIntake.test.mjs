import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectLegacyAggregateExport as inspect} from '../../lib/research/marketBreadthLegacyAggregateIntake.mjs';
const summary={total_rows:10,distinct_signal_dates:2,distinct_stock_codes:4,first_signal_date:'2026-08-21',last_signal_date:'2026-08-28',wins:3,losses:2,holds:1,unknowns:4,checked_rows:6,future_prices:5,return_rows:5,temporal_conflicts:0,save_date_mismatches:0};
const daily=[{signal_date:'2026-08-28',rows:4,resolved:2,evaluated:2,priced:2},{signal_date:'2026-08-21',rows:6,resolved:3,evaluated:4,priced:3}];
const duplicates={duplicate_stock_date_groups:0,duplicate_extra_rows:0};
const run=(s=summary,d=daily,dup=duplicates)=>inspect({summary:s,daily:d,duplicates:dup});
test('reads only aggregates without approving AI promotion',()=>{const x=run();assert.equal(x.coverage.rows,10);assert.equal(x.coverage.judged,5);assert.equal(x.aiPromotionAuthorized,false);assert.equal(x.independentImprovementVerified,false)});
test('rejects missing summary',()=>assert.throws(()=>inspect({daily,duplicates}),/INVALID_AGGREGATE_EXPORT/));
test('rejects negative counts',()=>assert.throws(()=>run({...summary,wins:-1}),/INVALID_AGGREGATE_COUNT/));
test('rejects fractional counts',()=>assert.throws(()=>run({...summary,wins:1.5}),/INVALID_AGGREGATE_COUNT/));
test('rejects inconsistent result totals',()=>assert.throws(()=>run({...summary,unknowns:3}),/INCONSISTENT_RESULT_TOTALS/));
test('rejects impossible checked count',()=>assert.throws(()=>run({...summary,checked_rows:11}),/IMPOSSIBLE_AGGREGATE_COUNT/));
test('rejects duplicate daily dates',()=>assert.throws(()=>run(summary,[daily[0],daily[0]]),/INVALID_DAILY_AGGREGATE/));
test('rejects resolved greater than daily rows',()=>assert.throws(()=>run(summary,[{...daily[0],resolved:5}]),/INVALID_DAILY_AGGREGATE/));
test('rejects daily total greater than summary',()=>assert.throws(()=>run(summary,[{...daily[0],rows:11}]),/INCONSISTENT_DAILY_TOTALS/));
test('rejects impossible calendar dates',()=>assert.throws(()=>run({...summary,first_signal_date:'2026-02-30'}),/INVALID_AGGREGATE_DATE_RANGE/));
test('rejects daily dates outside summary range',()=>assert.throws(()=>run(summary,[{...daily[0],signal_date:'2026-09-01'}]),/DAILY_DATE_OUTSIDE_RANGE/));
test('empty valid export remains nonpromotable',()=>{const empty={...summary,total_rows:0,distinct_signal_dates:0,distinct_stock_codes:0,first_signal_date:null,last_signal_date:null,wins:0,losses:0,holds:0,unknowns:0,checked_rows:0,future_prices:0,return_rows:0};const x=run(empty,[]);assert.equal(x.requiresFollowup,false);assert.equal(x.coverage.rows,0)});
test('empty export with daily rows fails',()=>{const empty={...summary,total_rows:0,distinct_signal_dates:0,distinct_stock_codes:0,first_signal_date:null,last_signal_date:null,wins:0,losses:0,holds:0,unknowns:0,checked_rows:0,future_prices:0,return_rows:0};assert.throws(()=>run(empty,daily),/INCONSISTENT_EMPTY_EXPORT/)});

test('complete daily coverage reconciles rows and judged totals',()=>{const x=run();assert.equal(x.coverage.dailyCoverageComplete,true);assert.equal(x.coverage.dailyRowsReconciled,true)});
test('missing daily rows despite complete date coverage fail closed',()=>assert.throws(()=>run(summary,[{...daily[0],rows:3},daily[1]]),/INCOMPLETE_DAILY_RECONCILIATION/));
test('missing judged results despite complete date coverage fail closed',()=>assert.throws(()=>run(summary,[{...daily[0],resolved:1},daily[1]]),/INCOMPLETE_DAILY_RECONCILIATION/));
test('partial daily coverage is explicitly disclosed',()=>{const x=run(summary,[daily[0]]);assert.equal(x.coverage.dailyCoverageComplete,false);assert.equal(x.coverage.dailyRowsReconciled,false)});

test('PostgreSQL bigint text counts are normalized without losing precision',()=>{const s=Object.fromEntries(Object.entries(summary).map(([k,v])=>typeof v==='number'?[k,String(v)]:[k,v]));const d=daily.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>typeof v==='number'?[k,String(v)]:[k,v])));const x=run(s,d,{duplicate_stock_date_groups:'0',duplicate_extra_rows:'0'});assert.equal(x.coverage.rows,10);assert.equal(x.coverage.dailyRowsReconciled,true)});
test('unsafe PostgreSQL bigint above safe integer range is rejected',()=>assert.throws(()=>run({...summary,total_rows:'9007199254740993'}),/INVALID_AGGREGATE_COUNT/));
test('decimal and scientific notation counts are rejected',()=>{assert.throws(()=>run({...summary,wins:'3.0'}),/INVALID_AGGREGATE_COUNT/);assert.throws(()=>run({...summary,wins:'3e0'}),/INVALID_AGGREGATE_COUNT/)});
test('negative bigint strings are rejected',()=>assert.throws(()=>run({...summary,wins:'-1'}),/INVALID_AGGREGATE_COUNT/));
test('daily bigint strings must be safe integers',()=>assert.throws(()=>run(summary,[{...daily[0],rows:'9007199254740993'}]),/INVALID_DAILY_AGGREGATE/));

test('duplicate group count cannot exceed duplicate extra rows',()=>assert.throws(()=>run(summary,daily,{duplicate_stock_date_groups:2,duplicate_extra_rows:1}),/IMPOSSIBLE_AGGREGATE_COUNT/));
test('unsafe sum of individually safe result counts is rejected',()=>assert.throws(()=>run({...summary,total_rows:Number.MAX_SAFE_INTEGER,wins:Number.MAX_SAFE_INTEGER,losses:2,holds:0,unknowns:0},[]),/INCONSISTENT_RESULT_TOTALS/));
test('unsafe sum of individually safe daily counts is rejected',()=>assert.throws(()=>run({...summary,total_rows:Number.MAX_SAFE_INTEGER,distinct_signal_dates:2,wins:0,losses:0,holds:0,unknowns:Number.MAX_SAFE_INTEGER,checked_rows:0,future_prices:0,return_rows:0},[{signal_date:'2026-08-21',rows:Number.MAX_SAFE_INTEGER,resolved:0,evaluated:0,priced:0},{signal_date:'2026-08-28',rows:1,resolved:0,evaluated:0,priced:0}]),/UNSAFE_DAILY_TOTALS/));
