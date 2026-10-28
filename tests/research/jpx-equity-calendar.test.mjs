import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFiveJpxEquitySessions as next } from '../../app/lib/learning/jpxEquityCalendar2026.mjs';
test('Oct 27 2026 skips Culture Day',()=>assert.deepEqual(next('2026-10-27'),[
 '2026-10-28','2026-10-29','2026-10-30','2026-11-02','2026-11-04'
]));
test('2026 to 2027 year boundary correctly skips new year closures',()=>assert.deepEqual(next('2026-12-29'),[
 '2026-12-30','2027-01-04','2027-01-05','2027-01-06','2027-01-07'
]));
test('2027 vernal equinox observed holiday is excluded',()=>assert.deepEqual(next('2027-03-19'),[
 '2027-03-23','2027-03-24','2027-03-25','2027-03-26','2027-03-29'
]));
test('non-trading anchor and unaudited years fail closed',()=>{
 for(const day of ['2026-11-03','2026-10-25','2026-02-30','2025-10-27','2027-12-30','2028-01-04']){
  assert.equal(next(day),null,day);
 }
});
