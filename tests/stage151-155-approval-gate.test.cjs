const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const source=fs.readFileSync('app/lib/learning/researchApprovalGate.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={exports:{}};
new vm.Script(code).runInNewContext({module:sandbox,exports:sandbox.exports,Date,Number});
const {assessResearchEvidence,auditReview}=sandbox.exports;
function good(){return {researchId:'HAP_V1',ruleVersion:'hypothesis-v1',recorded:150,evaluated:120,distinctTradeDays:30,completedMonths:3,avgReturn5d:1.2,medianReturn5d:0.7,positiveRate5d:.56,marketRegimes:[{name:'BULL',evaluated:55,avgReturn5d:1.5},{name:'BEAR',evaluated:65,avgReturn5d:.5}],sourceVerified:true,licenseVerified:true,independentTimestampsVerified:true,holdoutVerified:true};}
const digest='a'.repeat(64);
const review={researchId:'HAP_V1',evidenceDigest:digest,reviewer:'research-admin',decision:'APPROVED_FOR_REVIEW',reviewedAt:'2026-10-28T00:00:00Z',rationale:'Review evidence only; no production rollout.'};
test('151 incomplete sample and holdout cannot be nominated',()=>{const e=good();e.evaluated=25;e.holdoutVerified=false;const r=assessResearchEvidence(e);assert.equal(r.eligibleForHumanReview,false);assert.ok(r.reasons.includes('INSUFFICIENT_OBSERVATION_WINDOW'));assert.ok(r.reasons.includes('MISSING_INDEPENDENT_HOLDOUT'));});
test('152 source, license, timestamps and regimes must be verified',()=>{const e=good();e.licenseVerified=false;e.marketRegimes=[{name:'BULL',evaluated:5,avgReturn5d:1}];const r=assessResearchEvidence(e);assert.ok(r.reasons.includes('UNVERIFIED_SOURCE_LICENSE_OR_TIME'));assert.ok(r.reasons.includes('INSUFFICIENT_REGIME_EVIDENCE'));});
test('153 nominal result only opens human review, never activates anything',()=>{const r=assessResearchEvidence(good());assert.equal(r.eligibleForHumanReview,true);assert.equal(r.status,'REVIEW_CANDIDATE');assert.equal(r.automaticActivation,false);});
test('154 absent, stale or conflicting approval fails closed',()=>{assert.equal(auditReview(good(),digest,null).readyForSeparateReleaseReview,false);assert.ok(auditReview(good(),digest,{...review,evidenceDigest:'b'.repeat(64)}).issues.includes('REVIEW_EVIDENCE_MISMATCH'));assert.equal(auditReview(good(),digest,{...review,decision:'REJECTED'}).readyForSeparateReleaseReview,false);});
test('155 approved review remains non-production and non-notifying',()=>{const r=auditReview(good(),digest,review);assert.equal(r.readyForSeparateReleaseReview,true);assert.equal(r.productionApplied,false);assert.equal(r.notificationEnabled,false);assert.equal(r.tradingLogicChanged,false);assert.doesNotMatch(source,/pool\.query|fetch\(|INSERT INTO|UPDATE public|DELETE FROM|LINE_CHANNEL_ACCESS_TOKEN/);});
