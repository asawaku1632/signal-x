import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inventoryDirectory,main} from './post905-local-source-inventory.mjs';

test('inventory counts only named minute reports and does not expose contents',()=>{
 const dir=mkdtempSync(join(tmpdir(),'inventory-'));
 try {
  writeFileSync(join(dir,'1301_2026-10-30.json'),JSON.stringify({secret:'must-not-leak'}));
  writeFileSync(join(dir,'cohort-summary-v5.json'),'{}');
  const result=inventoryDirectory(dir);
  assert.equal(result.minuteReportFiles,1);
  assert.equal(result.otherJsonFiles,1);
  assert.deepEqual(result.reportScopes,['1301_2026-10-30']);
  assert.equal(JSON.stringify(result).includes('must-not-leak'),false);
  assert.equal(result.eligibleForProduction,false);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('invalid JSON is counted without halting inventory',()=>{
 const dir=mkdtempSync(join(tmpdir(),'inventory-'));
 try {
  writeFileSync(join(dir,'1301_2026-10-30.json'),'{invalid');
  assert.equal(inventoryDirectory(dir).invalidReportFiles,1);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('creates output once and refuses overwrite',()=>{
 const dir=mkdtempSync(join(tmpdir(),'inventory-'));
 try {
  const out=join(dir,'inventory.json');
  const r=main(['--dir='+dir,'--output='+out]);
  assert.equal(r.reportFiles,0);
  assert.equal(JSON.parse(readFileSync(out,'utf8')).historicalOnly,true);
  assert.throws(()=>main(['--dir='+dir,'--output='+out]),/EEXIST/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
