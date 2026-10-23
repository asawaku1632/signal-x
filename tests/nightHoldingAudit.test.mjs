import test from "node:test";
import assert from "node:assert/strict";
import {auditHoldingPeriods} from "../app/lib/research/nightHoldingAudit.mjs";

function date(i){return new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10);}
function rows(trainingFav=3,testingFav=3){
  const out=[];
  // 33 successive business-label days, simulated study. targetDays 5 days
  // after entry makes an explicit embargo before validation starts.
  for(let day=0;day<36;day++){
    for(let j=0;j<3;j++){
      const fav=day<24?trainingFav:testingFav;
      out.push({date:date(day),code:String(3000+j+day*3),score:96,
        entries:{"09:05":100},targetDates:{5:date(day+5)},
        exits:{1:fav===1?103:101,3:fav===3?103:101,5:fav===5?103:101}});
    }
  }
  return out;
}
test("holdout winner can disagree with earlier training winner",()=>{
  const s=auditHoldingPeriods(rows(3,1),date(50),96);
  assert.equal(s.ready,true);
  assert.equal(s.chosen,3);
  assert.equal(s.reproduced,false);
  assert.equal(s.holdout.find(x=>x.horizon===1).meanPct,3);
  assert.equal(s.train.find(x=>x.horizon===3).meanPct,3);
});
test("outcome embargo excludes training whose five-day label reaches test",()=>{
  const s=auditHoldingPeriods(rows(),date(50),96);
  assert.equal(s.ready,true);
  assert.ok(s.trainLastDate<s.testFirstDate);
  assert.equal(s.trainCount,57); // training is first 19 dates (24 - 5)
  assert.equal(s.testCount,36);
});
test("future entries and score mismatch do not modify frozen test",()=>{
  const base=rows();
  const a=auditHoldingPeriods(base,date(50),96);
  const b=auditHoldingPeriods([...base,{...base[0],date:date(60),code:"9999",
    exits:{1:10000,3:2,5:10000}}],date(50),96);
  assert.deepEqual(a,b);
  assert.equal(auditHoldingPeriods(base,date(50),86).ready,false);
});
test("one missing horizon excludes whole stock-day, no hindsight imputation",()=>{
  const data=rows();
  data.forEach(x=>x.exits[5]=null);
  const s=auditHoldingPeriods(data,date(50),96);
  assert.equal(s.ready,false);
});
test("no fabricated probability for sparse data",()=>{
  const s=auditHoldingPeriods(rows().slice(0,4),date(50),96);
  assert.equal(s.ready,false);
  assert.equal(s.chosen,null);
  assert.equal(s.reproduced,null);
});
