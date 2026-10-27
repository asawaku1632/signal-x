const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const quality=fs.readFileSync('app/lib/learning/researchQualitySummary.ts','utf8');
const js=ts.transpileModule(quality,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
new vm.Script(js).runInNewContext({module,exports:module.exports,Date,Intl,Number,Math});
const summarize=module.exports.summarizeResearchQuality;
test('146 alpha code accepted by both UI and authenticated report API',()=>{
 const api=fs.readFileSync('app/api/swing-universe-audit/route.ts','utf8');
 const page=fs.readFileSync('app/simulation/universe-check/page.tsx','utf8');
 for(const src of [api,page]){
  assert.ok(src.includes('/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/'));
  assert.equal(src.includes('/^[0-9]{4}$/'),false);
 }
 assert.ok(api.includes('getServerSession'));
 assert.ok(api.includes('private, no-store'));
});
test('147 and 148 confirmed vs unconfirmed, no false coverage',()=>{
 const report={total:5,latestDate:'2026-10-27',groups:[
  {count:3,outcomes:[{days:1,checked:3},{days:5,checked:2}]},
  {count:2,outcomes:[{days:1,checked:2},{days:5,checked:1}]}]};
 const x=summarize(report,new Date('2026-10-28T00:00:00Z'));
 assert.equal(x.horizons.find(x=>x.days===5).checked,3);
 assert.equal(x.horizons.find(x=>x.days===5).pending,2);
 assert.equal(x.horizons.find(x=>x.days===5).completionPct,60);
 assert.equal(x.horizons.find(x=>x.days===3).pending,5);
 assert.equal(x.horizons.find(x=>x.days===3).completionPct,0);
 assert.equal(x.freshnessLabel,'直近3暦日以内');
});
test('149 stale/missing/invalid summary fails conservatively',()=>{
 const empty=summarize({total:0,latestDate:null,groups:[]},new Date('2026-10-28T00:00:00Z'));
 assert.equal(empty.freshnessLabel,'鮮度不明');
 assert.equal(empty.horizons[0].completionPct,null);
 const stale=summarize({total:1,latestDate:'2026-09-01',groups:[{count:1,outcomes:[{days:1,checked:2}]}]},new Date('2026-10-28T00:00:00Z'));
 assert.equal(stale.freshnessLabel,'10暦日超（要確認）');
 assert.equal(stale.horizons[0].checked,0);
});
test('150 quality UI remains a read-only presentation',()=>{
 const src=fs.readFileSync('app/lib/learning/researchQualitySummary.ts','utf8');
 assert.doesNotMatch(src,/pool\.query|fetch\(|INSERT INTO|UPDATE public|DELETE FROM/);
 const page=fs.readFileSync('app/simulation/universe-check/page.tsx','utf8');
 assert.ok(page.includes('研究データ品質（閲覧専用）'));
 assert.ok(page.includes('summarizeResearchQuality'));
});
