import test from "node:test";
import assert from "node:assert/strict";
import {fiveMinuteFromReconciled,replayBbCandleArchives,ENTRY_SLOTS} from "../app/lib/research/bbCandleReplay.mjs";
const row=(minute,price)=>({minute,open:price,high:price+1,low:price-1,close:price+.5,volume:100});
test("5m grouping preserves session and close timestamps",()=>{
  const day={date:"2026-11-18",dailyMatched:true,minutes:[row(540,100),row(541,101),row(545,102),row(750,103),row(930,104)]};
  const bars=fiveMinuteFromReconciled([day]);
  assert.equal(bars.length,4);
  assert.equal(bars[0].slot,"09:00");
  assert.equal(bars[0].open,100);
  assert.equal(bars[0].close,101.5);
  assert.equal(bars[0].volume,200);
  assert.equal(bars[0].time,Date.parse("2026-11-18T09:05:00+09:00")/1000);
  assert.equal(bars[3].slot,"15:25");
  assert.equal(bars[3].time,Date.parse("2026-11-18T15:30:00+09:00")/1000);
});
test("lunch auction and afternoon are never bridged",()=>{
 const bars=fiveMinuteFromReconciled([{date:"2026-11-18",dailyMatched:true,minutes:[row(690,101),row(750,102)]}]);
 assert.deepEqual(bars.map(x=>x.slot),["11:25","12:30"]);
});
test("incomplete or duplicate archives block rather than output invented results",()=>{
 assert.throws(()=>replayBbCandleArchives([]),/INVALID_ARCHIVE_COUNT/);
 assert.throws(()=>replayBbCandleArchives([{code:"3762",minuteDays:[],dailyDays:[]}]),/INCOMPLETE_ARCHIVE_DAYS/);
 assert.deepEqual([...ENTRY_SLOTS],["09:20","11:20","14:15"]);
});
