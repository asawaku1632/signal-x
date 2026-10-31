import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMa75FrozenUniverse,manifestFromMa75FrozenUniverse} from '../app/lib/research/ma75FrozenUniverse.mjs';
import {verifyMa75ForwardManifest} from '../app/lib/research/ma75ForwardProtocol.mjs';
const path=new URL('../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const freeze=()=>JSON.parse(readFileSync(path,'utf8'));
test('committed 953-code historical observed cohort is valid and prospectively frozen',()=>{
 const f=freeze(),r=validateMa75FrozenUniverse(f);
 assert.equal(r.codes,953);
 assert.equal(r.structuralValidationPassed,true);
 assert.equal(r.broadMarketCoverageVerified,false);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(f.firstEligibleSignalDate,'2026-11-02');
 assert.ok(f.codes.includes('9984'));
});
test('frozen sample converts into hash-verified BUT blocked research manifest',()=>{
 const f=freeze(),m=manifestFromMa75FrozenUniverse(f);
 assert.equal(verifyMa75ForwardManifest(m),true);
 assert.equal(m.codes.length,953);
 assert.equal(m.sourceStatus,'BLOCKED');
 assert.equal(m.eligibleForProduction,false);
 assert.equal(m.source.usageRights,'UNVERIFIED');
 assert.equal(m.signal.retestSessions,10);
});
test('duplicate codes, unsorted codes or forged size cannot change selected population',()=>{
 for(const mutate of [
  x=>{x.codes[0]=x.codes[1];},
  x=>{[x.codes[0],x.codes[1]]=[x.codes[1],x.codes[0]];},
  x=>{x.populationSize=1;},
  x=>{x.codes[0]='foo';},
 ]){
  const f=freeze();mutate(f);
  assert.throws(()=>validateMa75FrozenUniverse(f),TypeError);
 }
});
test('future-dated or self-certified data may not turn on a forward recommendation',()=>{
 for(const mutate of [
  x=>{x.frozenAt='2026-11-03T01:00:00Z';},
  x=>{x.sourceChecks.providerRights='VERIFIED';},
  x=>{x.sourceChecks.liquidityCoverage='VERIFIED';},
  x=>{x.automaticCollectionEnabled=true;},
  x=>{x.notificationEligible=true;},
  x=>{x.independentlyValidatedForwardReturns=1;},
 ]){
  const f=freeze();mutate(f);
  assert.throws(()=>manifestFromMa75FrozenUniverse(f),TypeError);
 }
});
test('an unrecognized archived population policy cannot be substituted for current freeze',()=>{
 const f=freeze();f.selectionSQL='SELECT profitable stocks known in advance';
 assert.throws(()=>validateMa75FrozenUniverse(f),TypeError);
});
