import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNextSessionBudgetWatch, NEXT_SESSION_BUDGET_PRESETS} from '../../app/lib/research/nextSessionBudgetWatch.mjs';
import {nightMorningTradingDates} from '../../app/lib/research/nightMorningWatch.mjs';

const base={sourceDate:'2026-11-02',tradeDate:'2026-11-04'};
const rows=[
 {code:'5333',name:'日本ガイシ',score:99,price:4600,snapshotDate:'2026-11-02'},
 {code:'8316',name:'三井住友FG',score:92,price:3174.4,snapshotDate:'2026-11-02'},
 {code:'2811',name:'カゴメ',score:89,price:3200,snapshotDate:'2026-11-02'},
 {code:'8923',name:'トーセイ',score:87,price:3400,snapshotDate:'2026-11-02'},
];

test('calendar handoff skips 2026-11-03 holiday (fixture)',()=>{
 const dates=nightMorningTradingDates(new Date('2026-11-02T09:30:00Z'),
   day => day!=='2026-11-03' && ![0,6].includes(new Date(day+'T00:00:00Z').getUTCDay()));
 assert.deepEqual(dates,{sourceDate:'2026-11-02',tradeDate:'2026-11-04'});
});

test('35万円 cap excludes 46万円 headline pick; keeps 100-share affordable stocks',()=>{
 const v=buildNextSessionBudgetWatch({...base,rows,budgetYen:350000});
 assert.deepEqual(v.candidates.map(x=>x.code),['8316','2811','8923']);
 assert.equal(v.candidates[0].referenceCostYen,317440);
 assert.equal(v.candidates[0].requiredRiseYenPerShare,70);
 assert.equal(v.candidates[0].requiredRisePercent,2.21);
 assert.equal(v.candidates[0].status,'RECHECK_AFTER_0905');
 assert.equal(v.candidates[0].catalystVerification,'NOT_VERIFIED');
});

test('presets use 100 shares and score sort without promising returns',()=>{
 for(const budgetYen of NEXT_SESSION_BUDGET_PRESETS){
   const v=buildNextSessionBudgetWatch({...base,rows,budgetYen});
   assert.ok(v.candidates.every(x=>x.referenceCostYen<=budgetYen));
   assert.ok(v.candidates.every(x=>x.evidence==='PRIOR_AI_ONLY'));
 }
 assert.equal(buildNextSessionBudgetWatch({...base,rows,budgetYen:100000}).candidates.length,0);
 assert.equal(buildNextSessionBudgetWatch({...base,rows,budgetYen:500000}).candidates[0].code,'5333');
});

test('conflicting duplicate code is excluded; exact duplicate is deduplicated',()=>{
 const v=buildNextSessionBudgetWatch({...base,rows:[rows[1],{...rows[1],price:3173},rows[2],rows[2]]});
 assert.deepEqual(v.candidates.map(x=>x.code),['2811']);
 assert.equal(v.conflictsExcluded,1);
});

test('invalid, mismatched, stale or missing saved prices are never repaired',()=>{
 const v=buildNextSessionBudgetWatch({...base,rows:[{...rows[1],snapshotDate:'2026-11-04'},
   {...rows[1],price:null},{...rows[2],name:''},{...rows[2],score:101}]});
 assert.equal(v.candidates.length,0);
 assert.equal(v.invalidRows,4);
});

test('outcome and unverified news cannot enter the shortlist rank',()=>{
 const changed=rows.map((r,i)=>({...r,result_5d:i%2?200:-100,latestNews:'guaranteed surge'}));
 const a=buildNextSessionBudgetWatch({...base,rows});
 const b=buildNextSessionBudgetWatch({...base,rows:changed});
 assert.deepEqual(a.candidates,b.candidates);
});

test('invalid dates and unapproved budget/shares fail closed',()=>{
 for(const args of [
  {...base,rows,tradeDate:'2026-11-03',sourceDate:'2026-11-04'},
  {...base,rows,sourceDate:'2026-11-31'},
  {...base,rows,budgetYen:400000},
  {...base,rows,shares:200},
  {...base,rows,targetProfitYen:-1},
 ]) assert.throws(()=>buildNextSessionBudgetWatch(args));
});
