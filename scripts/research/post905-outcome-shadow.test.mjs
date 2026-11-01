import test from 'node:test';
import assert from 'node:assert/strict';
import {measurePost905Outcomes} from '../../app/lib/research/post905OutcomeShadow.mjs';
const row=(time,O,H,L,C)=>({Date:'2026-10-30',Code:'13320',Time:time,O,H,L,C});
test('9:05 minute excluded from as-of input but included in future outcome',()=>{
 const x=measurePost905Outcomes([
  row('09:00',100,101,99,100),row('09:04',100,100,100,100),
  row('09:05',100,101,99,100),row('09:10',100,102,98,101)
 ],{code:'1332',date:'2026-10-30'});
 assert.equal(x.asOf905ReferenceClose,100);
 assert.equal(x.pre905BarCount,2);
 assert.equal(x.post905MorningBarCount,2);
 assert.equal(x.upsideFromReferencePercent,2);
 assert.equal(x.downsideFromReferencePercent,-2);
 assert.equal(x.firstPost905OnePctHighAt,'09:05');
 assert.equal(x.firstPost905TwoPctHighAt,'09:10');
 assert.equal(x.referenceIsExecutable,false);
 assert.equal(x.eligibleForProduction,false);
});
test('no future bar does not invent profit',()=>{
 const x=measurePost905Outcomes([row('09:04',100,100,100,100)],{code:'1332',date:'2026-10-30'});
 assert.equal(x.upsideFromReferencePercent,null);
 assert.equal(x.firstPost905OnePctHighAt,null);
});
test('wrong symbol and duplicate minute fail closed',()=>{
 const scope={code:'1332',date:'2026-10-30'};
 assert.throws(()=>measurePost905Outcomes([row('09:04',100,100,100,100),row('09:04',100,100,100,100)],scope));
 assert.throws(()=>measurePost905Outcomes([{...row('09:04',100,100,100,100),Code:'13010'}],scope));
});

test('missing pre905 slots are explicitly unknown and never production eligible',()=>{
 const x=measurePost905Outcomes([
  row('09:00',100,100,100,100),row('09:02',100,100,100,100),
  row('09:04',100,100,100,100),row('09:05',100,101,100,100)
 ],{code:'1332',date:'2026-10-30'});
 assert.deepEqual(x.observedPre905Minutes,['09:00','09:02','09:04']);
 assert.deepEqual(x.missingPre905Minutes,['09:01','09:03']);
 assert.equal(x.missingPre905MinuteCause,'UNKNOWN_NO_TRADE_OR_DATA_GAP');
 assert.equal(x.eligibleForProduction,false);
});
