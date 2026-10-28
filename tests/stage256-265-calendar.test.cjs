const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(path,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{assert.ok(imports[k],k);return imports[k]},Date,Number,Set,Intl});return m.exports;}
const calendar=load('app/lib/technicalObservation/tseMarketCalendar.ts');
const audit=load('app/lib/learning/swingFiveDayCalendarAudit.ts',{'@/app/lib/technicalObservation/tseMarketCalendar':calendar}).auditFiveDayTradingCalendar;
const row=(date='2026-10-09',outcome='2026-10-19',ret='2.5')=>({trade_date:date,code:'590A',outcome_5d_date:outcome,return_5d:ret});
const cases=[
 ['256 five sessions after Oct 9 skip holiday',row(),null],
 ['257 weekend outcome rejected',row('2026-10-09','2026-10-17'),'OUTCOME_NOT_TSE_SESSION'],
 ['258 Oct 12 JPX holiday rejected',row('2026-10-09','2026-10-12'),'OUTCOME_NOT_TSE_SESSION'],
 ['259 wrong business day rejected',row('2026-10-09','2026-10-20'),'FIVE_DAY_TARGET_MISMATCH'],
 ['260 nontrading signal rejected',row('2026-10-12','2026-10-19'),'SIGNAL_NOT_TSE_SESSION'],
 ['261 unavailable older year rejected',row('2025-10-09','2025-10-16'),'MARKET_CALENDAR_UNAVAILABLE'],
 ['262 valid return without target date rejected',row('2026-10-09',null,'2.5'),'RETURN_MISSING_OUTCOME_DATE'],
 ['263 target date without return rejected',row('2026-10-09','2026-10-19',null),'DATE_MISSING_RETURN'],
 ['264 invalid returned numeric value rejected',row('2026-10-09','2026-10-19','not-a-number'),'INVALID_RETURN'],
 ['265 code/date format invalid rejected',row('garbled','2026-10-19'),'INVALID_ROW_FORMAT']
];
for(const [name,input,issue] of cases)test(name,()=>{const result=audit([input]);assert.equal(result.inspected,1);assert.equal(result.issues.length,issue?1:0);if(issue)assert.equal(result.issues[0].reason,issue);assert.equal(result.exhaustive,false);assert.equal(result.notificationEnabled,false);});
test('sample cap cannot be bypassed and empty sample is not proof',()=>{assert.throws(()=>audit([row(),row()],1),/AUDIT_SAMPLE_LIMIT_EXCEEDED/);assert.equal(audit([]).exhaustive,false);});
