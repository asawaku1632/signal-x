import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {main} from './post905-local-validation-bundle.mjs';

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
