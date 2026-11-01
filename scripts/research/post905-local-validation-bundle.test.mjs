import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {main,planNextEvidence} from './post905-local-validation-bundle.mjs';

test('offline bundle refuses empty report directory without creating output',()=>{
 const dir=mkdtempSync(join(tmpdir(),'validation-'));
 try {
  const out=join(dir,'summary.json');
  assert.throws(()=>main(['--input-dir='+dir,'--output='+out]),/INVALID_REPORT_COUNT/);
  assert.equal(existsSync(out),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid argument shape fails before reading',()=>{
 assert.throws(()=>main([]),/USE_--input-dir/);
 assert.throws(()=>main(['--input-dir=x','--output=report.txt']),/INVALID_PATH/);
});

test('evidence plan identifies distinct date and timestamp shortfalls without claiming edge',()=>{
 const plan=planNextEvidence({acceptedDates:1,reportsWithoutPre905TimestampEvidence:3});
 assert.equal(plan[0].minimumAdditionalDates,1);
 assert.equal(plan[1].affectedReports,3);
 assert.ok(plan.some(step=>step.code==='INDEPENDENT_ASOF_REPLAY'));
 assert.ok(plan.some(step=>step.code==='FORWARD_AND_COST_VALIDATION'));
});
test('date shortfall is omitted after two accepted dates but replay remains mandatory',()=>{
 const plan=planNextEvidence({acceptedDates:2,reportsWithoutPre905TimestampEvidence:0});
 assert.equal(plan.some(step=>step.code==='MORE_DISTINCT_DATES'),false);
 assert.equal(plan.some(step=>step.code==='PRE905_TIMESTAMP_EVIDENCE'),false);
 assert.ok(plan.some(step=>step.code==='INDEPENDENT_ASOF_REPLAY'));
});
