import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {main} from './post905-local-validation-bundle.mjs';

test('offline bundle retains fail-closed flags for empty reports',()=>{
 const dir=mkdtempSync(join(tmpdir(),'validation-'));
 try {
  const out=join(dir,'summary.json');
  const result=main(['--input-dir='+dir,'--output='+out]);
  assert.equal(result.accepted,0);
  const saved=JSON.parse(readFileSync(out,'utf8'));
  assert.equal(saved.verifiedTradingEdge,false);
  assert.equal(saved.eligibleForNotifications,false);
  assert.ok(saved.readiness.gaps.includes('NO_INDEPENDENT_AS_OF_0905_SIGNAL_REPLAY'));
  assert.throws(()=>main(['--input-dir='+dir,'--output='+out]),/EEXIST/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid argument shape fails before reading',()=>{
 assert.throws(()=>main([]),/USE_--input-dir/);
 assert.throws(()=>main(['--input-dir=x','--output=report.txt']),/INVALID_PATH/);
});
