const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('app/lib/learning/integratedReviewAuditSummary.ts','utf8');
const m={exports:{}};new vm.Script(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText).runInNewContext({module:m,exports:m.exports,Number,Set});const audit=m.exports.summarizeIntegratedAudit;
const base=()=>({recorded:120,evaluated:100,historyCount:1,historyTruncated:false,status:'BLOCKED',reasons:['INDEPENDENT_PROVENANCE_AND_HISTORY_COMPLETENESS_NOT_ATTESTED'],entries:[{digest:'a'.repeat(64),valid:true,issues:[]}]});
const cases=[
 ['206 invalid counts',x=>{x.evaluated=999},'INVALID_RESEARCH_COUNTS'],
 ['207 missing history',x=>{x.historyCount=0;x.entries=[]},'NO_EVIDENCE_ROWS'],
 ['208 history mismatch',x=>{x.historyCount=2},'INVALID_HISTORY_COUNT'],
 ['209 truncated history',x=>{x.historyTruncated=true},'HISTORY_INCOMPLETE'],
 ['210 invalid evidence',x=>{x.entries[0].valid=false},'INVALID_EVIDENCE_ROWS'],
 ['211 bad digest',x=>{x.entries[0].digest='not-a-digest'},'INVALID_DIGEST'],
 ['212 prior row issues',x=>{x.entries[0].issues=['EXPIRED']},'EVIDENCE_ROW_ISSUES'],
 ['213 unexpected approval',x=>{x.status='APPROVED'},'UNEXPECTED_APPROVAL_STATUS'],
 ['214 missing attestation warning',x=>{x.reasons=[]},'ATTESTATION_WARNING_MISSING'],
 ['215 conflicting history',x=>{x.entries.push({digest:'b'.repeat(64),valid:true,issues:[]});x.historyCount=2},'MULTIPLE_EVIDENCE_VERSIONS_REQUIRE_REVIEW']
];
for(const [name,change,expected] of cases)test(name,()=>{const x=base();change(x);const result=audit(x);assert.ok(result.issues.includes(expected));assert.equal(result.adoptionApproved,false);assert.equal(result.productionApplied,false);assert.equal(result.notificationEnabled,false);});
test('integration remains restricted and read-only',()=>{const route=fs.readFileSync('app/api/admin/integrated-research-review/route.ts','utf8');assert.ok(route.indexOf('if(!owner.isOwner)')<route.indexOf('getIntegratedResearchReview()'));const page=fs.readFileSync('app/admin/research-review/page.tsx','utf8');assert.ok(page.includes('integrated.audit'));assert.doesNotMatch(source,/INSERT INTO|UPDATE public|DELETE FROM|pool\.query/);});
