import test from 'node:test';
import assert from 'node:assert/strict';
import {studyCrashEntryArchive} from '../../app/lib/research/crashEntryJQuantsAdapter.mjs';
const date='2026-11-19',tradeDate='2026-11-20',code='7203';
const page=rows=>[{requestPaginationKey:null,receivedAt:'2026-11-20T08:00:00Z',response:{data:rows}}];
const rows=[
 {Date:tradeDate,Time:'09:00',Code:'72030',O:100,H:100,L:100,C:100,Vo:100,Va:10000},
 {Date:tradeDate,Time:'09:20',Code:'72030',O:101,H:101,L:101,C:101,Vo:100,Va:10100},
 {Date:tradeDate,Time:'11:20',Code:'72030',O:102,H:102,L:102,C:102,Vo:100,Va:10200},
 {Date:tradeDate,Time:'15:30',Code:'72030',O:103,H:103,L:103,C:103,Vo:100,Va:10300},
];
const archive={code,minuteDays:[{date:tradeDate,pages:page(rows)}],
 dailyDays:[{date:tradeDate,pages:page([{Date:tradeDate,Code:'72030',O:100,H:103,L:100,C:103,Vo:400,AdjFactor:1,ExRT:null}])}]};
test('verified 1m rows give references only; absent 14:15 is missing',()=>{
 const result=studyCrashEntryArchive({signalDate:date,tradeDate,code,archive,exitClose:105});
 assert.equal(result.status,'HISTORICAL_REFERENCE_ONLY');
 assert.equal(result.slots[0].entryPrice,101);
 assert.equal(result.slots[1].entryPrice,102);
 assert.equal(result.slots[2].entryPrice,null);
});
test('missing archive day does not create synthetic reference',()=>{
 const result=studyCrashEntryArchive({signalDate:date,tradeDate,code,archive:{code,minuteDays:[],dailyDays:[]}});
 assert.equal(result.status,'MISSING_RECONCILED_TRADE_DAY');
});
test('invalid date order blocks lookahead',()=>{
 assert.throws(()=>studyCrashEntryArchive({signalDate:tradeDate,tradeDate:date,code,archive}),/INVALID_CRASH_ENTRY_ARCHIVE_TARGET/);
});
test('mismatched daily OHLC fails closed',()=>{
 const bad=structuredClone(archive);
 bad.dailyDays[0].pages[0].response.data[0].C=104;
 assert.throws(()=>studyCrashEntryArchive({signalDate:date,tradeDate,code,archive:bad}),/UNADJUSTED_MINUTE_DAILY_MISMATCH/);
});
