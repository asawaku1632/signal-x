import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runMa75NextSignalLocal}
 from '../scripts/research/ma75-next-signal-local.mjs';
const freeze=JSON.parse(readFileSync(new URL(
 '../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url),'utf8'));
const policy=JSON.parse(readFileSync(new URL(
 '../docs/ma75-prospective-20261111-predeclared-policy.json',import.meta.url),'utf8'));
const pinned=policy.originalNov02PinnedFreezeSha256;
const historical=Array.from({length:121},(_,i)=>new Date(
 Date.parse('2026-05-01T00:00:00Z')+i*86400000).toISOString().slice(0,10));
const names=[...historical,'2026-10-30'].map(d=>d+'-jquants-daily.json');
const forecast=['2026-11-12','2026-11-13','2026-11-16',
 '2026-11-17','2026-11-18'];
const prior=[...historical.slice(-68),'2026-10-30',
 ...policy.precedingPostfreezeSessions];
function projected(date){
 return {
  date,completeProviderPagination:true,originalAllListedRows:4440,
  projectedFrozenRows:953,
  audit:{failures:[],rows:freeze.codes.map(code=>{
   let close=100;
   if(date===prior[0]&&code==='1332')close=125;
   if(date==='2026-11-11'&&code==='1301')close=110;
   if(date==='2026-11-11'&&code==='1332')close=100.1;
   return {code,tradeDate:date,status:'DAILY_BAR',
    bar:{code,tradeDate:date,open:close,high:Math.max(130,close),
     low:95,close,volume:1000}};
  })}
 };
}
const projections=new Map();
const make=(at='2026-11-11T09:00:00Z')=>{
 let lockRaw=null,writeCount=0;
 const v={
  clock:()=>new Date(at),expectedOldSha:pinned,
  fileInfo:path=>{
   if(String(path).endsWith('/research-private'))
    return {isDirectory:()=>true,isSymbolicLink:()=>false};
   if(String(path).endsWith('ma75-2026-11-11-new-signal-lock.json')&&!lockRaw){
    const err=new Error('Missing');err.code='ENOENT';throw err;
   }
   return {isFile:()=>true,isSymbolicLink:()=>false,size:1200}
  },
  read:path=>{
   if(String(path).includes('predeclared-policy.json'))return JSON.stringify(policy);
   if(String(path).includes('forward-cohort-freeze-20261031.json'))
    return JSON.stringify(freeze);
   if(String(path).endsWith('ma75-2026-11-11-new-signal-lock.json'))
    return lockRaw;
   return Buffer.from('Synthetic private testing original path: '+path);
  },
  list:()=>names,
  auditArchive:()=>({
   status:'OFFLINE_HISTORICAL_DIAGNOSTIC_ONLY',
   from:'2026-05-01',to:'2026-10-30',dates:122
  }),
  verifyNov02:()=>({
   status:'LOCAL_FROZEN_SHADOW_COHORT_INTEGRITY_MATCH',
   freezeSha256:pinned,allBreakouts:27,risingBreakouts:22
  }),
  readSaved:path=>{
   const date=String(path).match(/20\d\d-\d\d-\d\d/)?.[0]??null;
   if(forecast.includes(date))return null;
   return {date,pages:[{receivedAt:date+'T08:00:00Z'}]};
  },
  project:(_,date)=>{
   if(!projections.has(date))projections.set(date,projected(date));
   return projections.get(date);
  },
  write:(path,content,opts)=>{
   assert.equal(opts.flag,'wx');
   assert.ok(String(path).endsWith('ma75-2026-11-11-new-signal-lock.json'));
   assert.equal(lockRaw,null);
   writeCount++;
   lockRaw=content;
  }
 };
 return {v,get writeCount(){return writeCount},get lockRaw(){return lockRaw}};
};
test('before Nov11 source exists, plan returns pending policy metadata without API or writes',()=>{
 const x=make('2026-11-10T11:30:00Z');
 const plan=runMa75NextSignalLocal(['--plan'],x.v);
 assert.equal(plan.mode,'PREDECLARED_PLAN_ONLY');
 assert.equal(plan.signalDate,'2026-11-11');
 assert.equal(plan.networkRequests,0);
 assert.equal(plan.filesWritten,0);
 assert.equal(plan.nextCohortLocked,false);
 assert.equal(x.writeCount,0);
});
test('new cohort locks exactly once before Nov12 open; source hash and immutable baseline reverify',()=>{
 const x=make();
 const r=runMa75NextSignalLocal(['--lock-new-cohort'],x.v);
 assert.equal(r.status,'NEW_MA75_SIGNAL_DATE_LOCKED_SHADOW_ONLY');
 assert.equal(r.allBreakouts,2);
 assert.equal(r.risingBreakouts,1);
 assert.equal(r.nonRisingBreakouts,1);
 assert.equal(r.filesWritten,1);
 assert.equal(x.writeCount,1);
 const verified=runMa75NextSignalLocal(['--verify-only'],x.v);
 assert.equal(verified.status,'NEW_MA75_SIGNAL_LOCK_INTEGRITY_MATCH');
 assert.equal(verified.originalsHashed,76);
 assert.equal(verified.originalBreakouts,2);
 assert.equal(verified.filesWritten,0);
 assert.throws(()=>runMa75NextSignalLocal(['--lock-new-cohort'],x.v),
  /MA75_NEXT_SIGNAL_LOCAL_NEW_SIGNAL_COHORT_ALREADY_LOCKED/);
 const stillPending=runMa75NextSignalLocal(['--review'],x.v);
 assert.equal(stillPending.horizons.session1.groups.allBreakouts.pending,2);
 assert.equal(stillPending.horizons.session5.groups.allBreakouts.pending,2);
 assert.equal(stillPending.filesWritten,0);
 assert.equal(stillPending.networkRequests,0);
 assert.equal(x.writeCount,1);
});
test('cannot retroactively lock after Nov12 opens or re-select after source changes',()=>{
 const after=make('2026-11-12T00:01:00Z');
 assert.throws(()=>runMa75NextSignalLocal(['--lock-new-cohort'],after.v),
  /MA75_NEXT_SIGNAL_LOCAL_NOT_IN_SIGNAL_CLOSE_TO_NEXT_OPEN_WINDOW/);
 assert.equal(after.writeCount,0);
 const locked=make();
 runMa75NextSignalLocal(['--lock-new-cohort'],locked.v);
 const altered={...locked.v,
  read:path=>{
   if(String(path).endsWith('ma75-2026-11-10-jquants-daily.json'))
    return Buffer.from('Adversarial data replaced later');
   return locked.v.read(path);
  }
 };
 assert.throws(()=>runMa75NextSignalLocal(['--review'],altered),
  /MA75_NEXT_SIGNAL_LOCAL_NEW_SIGNAL_LOCK_ORIGINAL_SOURCE_FINGERPRINT_CHANGED/);
});
test('invalid arguments never automatically download, schedule, or overwrite existing pages',()=>{
 const x=make();
 assert.throws(()=>runMa75NextSignalLocal(['--freeze'],x.v),
  /MA75_NEXT_SIGNAL_LOCAL_ONLY_PLAN_LOCK_VERIFY_OR_REVIEW_ALLOWED/);
 assert.equal(x.writeCount,0);
 const code=readFileSync(new URL(
  '../scripts/research/ma75-next-signal-local.mjs',import.meta.url),'utf8');
 const active=code.split('\n').filter(x=>!x.trim().startsWith('*')&&!x.trim().startsWith('//')).join('\n');
 assert.doesNotMatch(active,/\bfetch\s*\(|process\.env\.JQUANTS_API_KEY|createClient|notificationSend|tradeOrder/);
 assert.match(code,/flag:'wx'/);
});
