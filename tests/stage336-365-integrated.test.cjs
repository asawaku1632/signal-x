const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(p,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>imports[k],Date,Number,Set,Intl});return m.exports}
const guard=load('app/lib/learning/swingAuditResumeGuard.ts'),cal=load('app/lib/technicalObservation/tseMarketCalendar.ts');
const audit=load('app/lib/learning/swingFiveDayCalendarAudit.ts',{'@/app/lib/technicalObservation/tseMarketCalendar':cal});
let eligible=3,digest='a'.repeat(32);
const rows=[{trade_date:'2026-10-09',code:'590A',return_5d:'2',outcome_5d_date:'2026-10-19'},{trade_date:'2026-10-09',code:'641A',return_5d:'2',outcome_5d_date:'2026-10-20'},{trade_date:'2026-10-08',code:'642A',return_5d:'3',outcome_5d_date:'2026-10-16'}];
const db={connect:async()=>({query:async(sql,p=[])=>{if(/^(BEGIN|COMMIT|ROLLBACK)/.test(sql))return {rows:[]};if(sql.includes('COUNT(*) FILTER'))return {rows:[{eligible,digest}]};return {rows:rows.filter(x=>!p[1]||x.trade_date<p[1]||(x.trade_date===p[1]&&x.code>p[2])).slice(0,p[3])}},release(){}})};
const scan=load('app/lib/learning/swingIntegratedResumeScan.ts',{'@/app/lib/postgres':{default:db},'@/app/lib/learning/swingFiveDayCalendarAudit':audit,'@/app/lib/learning/swingAuditResumeGuard':guard,'@/app/lib/learning/swingUniverseAudit':{UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'}}).inspectResumeAndScan;
const cp=()=>({auditId:'audit1',ruleVersion:'ai_power_only_v1',fingerprint:'a'.repeat(32),eligible:3,inspected:0,cursorDate:null,cursorCode:null,completed:false});
const cases=[
 ['336 full scan',async()=>assert.equal((await scan(cp(),2,3)).scanned,3)],
 ['337 issue captured',async()=>assert.ok((await scan(cp(),2,3)).issues.some(x=>x.code==='641A'))],
 ['338 partial',async()=>assert.equal((await scan(cp(),1,1)).remaining,2)],
 ['339 first cursor',async()=>assert.equal((await scan(cp(),1,1)).cursorCode,'590A')],
 ['340 no duplicate',async()=>assert.equal((await scan(cp(),2,3)).issues.filter(x=>x.code==='641A').length,1)],
 ['341 resumed',async()=>assert.equal((await scan({...cp(),inspected:1,cursorDate:'2026-10-09',cursorCode:'590A'},1,3)).scanned,2)],
 ['342 resumed completion',async()=>assert.equal((await scan({...cp(),inspected:1,cursorDate:'2026-10-09',cursorCode:'590A'},2,3)).completed,true)],
 ['343 fingerprint drift',async()=>{digest='b'.repeat(32);assert.equal((await scan(cp())).action,'STOP');digest='a'.repeat(32)}],
 ['344 count drift',async()=>{eligible=4;assert.equal((await scan(cp())).action,'STOP');eligible=3}],
 ['345 rule drift',async()=>assert.equal((await scan({...cp(),ruleVersion:'old'})).action,'STOP')],
 ['346 missing cursor',async()=>assert.equal((await scan({...cp(),inspected:1})).action,'STOP')],
 ['347 completed',async()=>assert.equal((await scan({...cp(),completed:true})).action,'STOP')],
 ['348 bad fingerprint',async()=>assert.equal((await scan({...cp(),fingerprint:'bad'})).action,'STOP')],
 ['349 count overflow',async()=>assert.equal((await scan({...cp(),inspected:4})).action,'STOP')],
 ['350 invalid ID',async()=>assert.equal((await scan({...cp(),auditId:'bad/path'})).action,'STOP')],
 ['351 zero page',async()=>await assert.rejects(scan(cp(),0,1),/INVALID_BOUNDS/)],
 ['352 large page',async()=>await assert.rejects(scan(cp(),201,1),/INVALID_BOUNDS/)],
 ['353 zero pages',async()=>await assert.rejects(scan(cp(),1,0),/INVALID_BOUNDS/)],
 ['354 excessive pages',async()=>await assert.rejects(scan(cp(),1,51),/INVALID_BOUNDS/)],
 ['355 no production',async()=>assert.equal((await scan(cp())).productionApplied,false)],
 ['356 no notifications',async()=>assert.equal((await scan(cp())).notificationEnabled,false)],
 ['357 no approval',async()=>assert.equal((await scan(cp())).adoptionApproved,false)],
 ['358 incomplete',async()=>assert.equal((await scan(cp(),1,2)).completed,false)],
 ['359 remaining',async()=>assert.equal((await scan(cp(),1,2)).remaining,1)],
 ['360 cursor date',async()=>assert.equal((await scan(cp(),1,2)).cursorDate,'2026-10-09')],
 ['361 mismatch reason',async()=>assert.ok((await scan(cp(),2,2)).issues.some(x=>x.reason==='FIVE_DAY_TARGET_MISMATCH'))],
 ['362 fixed rule',async()=>assert.match(fs.readFileSync('app/lib/learning/swingIntegratedResumeScan.ts','utf8'),/UNIVERSE_SWING_RULE_VERSION/)],
 ['363 readonly transaction',async()=>assert.match(fs.readFileSync('app/lib/learning/swingIntegratedResumeScan.ts','utf8'),/REPEATABLE READ READ ONLY/)],
 ['364 guard before scan',async()=>{const s=fs.readFileSync('app/lib/learning/swingIntegratedResumeScan.ts','utf8');assert.ok(s.includes('if(guard.action'));assert.ok(s.includes('for(let page'));}],
 ['365 no mutation',async()=>assert.doesNotMatch(fs.readFileSync('app/lib/learning/swingIntegratedResumeScan.ts','utf8'),/INSERT INTO|UPDATE public|DELETE FROM/)]
];for(const [name,fn] of cases)test(name,fn);
