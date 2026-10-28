const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{Pool}=require('pg');
const u=new URL(process.env.SIGNALX_E2E_DATABASE_URL||'');for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci'}))assert.equal(u[k],v);
const pool=new Pool({connectionString:u.href,ssl:false});
function load(p,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{assert.ok(k in imports,k);return imports[k]},Date,Number,Map,Set,Math});return m.exports}
const calendar=load('app/lib/technicalObservation/tseMarketCalendar.ts'),audit=load('app/lib/learning/swingFiveDayCalendarAudit.ts',{'@/app/lib/technicalObservation/tseMarketCalendar':calendar});
const read=load('app/lib/learning/storedShadowPairEligibility.ts',{'@/app/lib/postgres':{default:pool},'@/app/lib/learning/swingUniverseAudit':{UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'},'@/app/lib/learning/swingFiveDayCalendarAudit':audit}).readStoredShadowPairEligibility;
const checks=[],add=(n,fn)=>checks.push([n,fn]);
add('906 empty sample',async()=>assert.equal((await read()).inspected,0));
add('907 no inferred pairs',async()=>assert.equal((await read()).eligiblePairs,0));
add('908 no independent attestation',async()=>assert.equal((await read()).independentPairVerified,false));
add('909 not exhaustive',async()=>assert.equal((await read()).exhaustive,false));
add('910 owner-only caller contract',async()=>assert.equal((await read()).ownerReviewOnly,true));
add('911 no production',async()=>assert.equal((await read()).productionApplied,false));
add('912 no notification',async()=>assert.equal((await read()).notificationEnabled,false));
add('913 limit zero rejected',async()=>assert.rejects(read(0),/INVALID_STORED_PAIR_LIMIT/));
add('914 limit over 100 rejected',async()=>assert.rejects(read(101),/INVALID_STORED_PAIR_LIMIT/));
add('915 limit fractional rejected',async()=>assert.rejects(read(1.5),/INVALID_STORED_PAIR_LIMIT/));
add('916 limit negative rejected',async()=>assert.rejects(read(-1),/INVALID_STORED_PAIR_LIMIT/));
add('917 limit 100 accepted',async()=>assert.equal((await read(100)).limit,100));
add('918 limit 1 accepted',async()=>assert.equal((await read(1)).limit,1));
add('919 filter only intended research rule',async()=>assert.equal((await read()).inspected,3));
add('920 upper bound sample 1',async()=>assert.equal((await read(1)).inspected,1));
add('921 all blocked for missing paired proof',async()=>assert.equal((await read()).blocked,3));
add('922 all pairs remain ineligible',async()=>assert.ok((await read()).observations.every(x=>x.pairEligible===false)));
add('923 result date included',async()=>assert.ok((await read()).observations.every(x=>x.tradeDate==='2026-10-09')));
add('924 alphanumeric securities included',async()=>assert.ok((await read()).observations.some(x=>x.code==='590A')));
add('925 completed outcome present',async()=>assert.equal((await read()).observations.find(x=>x.code==='590A').outcomePresent,true));
add('926 completed outcome numeric',async()=>assert.equal((await read()).observations.find(x=>x.code==='590A').fiveDayReturn,2));
add('927 missing outcome flagged',async()=>assert.ok((await read()).observations.find(x=>x.code==='642A').reasons.includes('OUTCOME_NOT_COMPLETE')));
add('928 missing outcome no numeric return',async()=>assert.equal((await read()).observations.find(x=>x.code==='642A').fiveDayReturn,null));
add('929 mismatch calendar detected',async()=>assert.equal((await read()).calendarIssues,1));
add('930 mismatch reason exposed',async()=>assert.ok((await read()).observations.find(x=>x.code==='641A').reasons.some(r=>r.startsWith('CALENDAR_'))));
add('931 baseline/shadow absence explicit',async()=>assert.ok((await read()).observations.every(x=>x.reasons.includes('NO_INDEPENDENT_BASELINE_SHADOW_PAIR'))));
add('932 regime absence explicit',async()=>assert.ok((await read()).observations.every(x=>x.reasons.includes('NO_INDEPENDENT_REGIME_PROVENANCE'))));
add('933 no invented data provenance',async()=>assert.equal((await read()).independentPairVerified,false));
add('934 bounded returned rows',async()=>assert.ok((await read(2)).observations.length<=2));
add('935 read-only SQL',async()=>assert.doesNotMatch(fs.readFileSync('app/lib/learning/storedShadowPairEligibility.ts','utf8'),/INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE|ALTER TABLE/));
test('stages906-935: real isolated PostgreSQL stored observation bridge',async()=>{try{
 await pool.query('CREATE TABLE public.swing_universe_observations(trade_date date,code text,rule_version text,return_5d numeric,outcome_5d_date date)');
 for(const [name,fn] of checks.slice(0,13)){await fn();console.log('PASS '+name)}
 await pool.query("INSERT INTO public.swing_universe_observations VALUES ('2026-10-09','590A','ai_power_only_v1',2,'2026-10-19'),('2026-10-09','641A','ai_power_only_v1',2,'2026-10-20'),('2026-10-09','642A','ai_power_only_v1',NULL,NULL),('2026-10-09','9999','unrelated',2,'2026-10-19')");
 for(const [name,fn] of checks.slice(13)){await fn();console.log('PASS '+name)}
 assert.equal(checks.length,30);
 }finally{await pool.end()}
});
