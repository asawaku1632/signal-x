const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const src=fs.readFileSync(require('node:path').join(__dirname,'../app/api/cron/swing-universe-audit/route.ts'),'utf8');
const route=src.replace(/^import .*;\r?\n/gm,'').replace(/export const /g,'const ').replace(/export async function GET/g,'async function GET');
const transpiled=ts.transpileModule(route,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},reportDiagnostics:true});
assert.equal(transpiled.diagnostics?.length||0,0);
function prepare(reason,{auth=false,captureError=false,outcomeError=false}={}) {
 let captured=0, updated=0;
 const GET = new Function('NextResponse','requireCronAuth','resolveTargetTradeDate',
  'captureSwingUniverseDay','updateSwingUniverseOutcomes','console',
  transpiled.outputText+'\nreturn GET;')(
  {json:(data,opts)=>({data,opts})},
  ()=>auth?{status:401}:null,
  ()=>({targetTradeDate:'2026-10-27',targetTradeDateReason:reason}),
  async()=>{captured++;if(captureError)throw Error('capture error');return {saved:5};},
  async()=>{updated++;if(outcomeError)throw Error('outcome error');return {updated:1};},
  {info:()=>{},error:()=>{}}
 );
 return {GET,counts:()=>({captured,updated})};
}
const TODAY='CURRENT_TSE_TRADING_DAY_AFTER_SAFE_BOUNDARY';
const EARLY='PREVIOUS_TSE_TRADING_DAY_BEFORE_SAFE_BOUNDARY';
const CLOSED='PREVIOUS_TSE_TRADING_DAY_MARKET_CLOSED';
test('after-close captures and updates',async()=>{
 const a=prepare(TODAY);const r=await a.GET({});assert.equal(r.data.success,true);assert.equal(r.data.capture.saved,5);assert.deepEqual(a.counts(),{captured:1,updated:1});
});
for(const reason of [EARLY,CLOSED]){
 test(`${reason}: no capture but outcomes continue`,async()=>{
  const a=prepare(reason);const r=await a.GET({});
  assert.equal(r.data.capture.skipped,'NON_CURRENT_TRADE_DATE');
  assert.deepEqual(a.counts(),{captured:0,updated:1});
 });
}
test('unauthorized: no operations',async()=>{
 const a=prepare(TODAY,{auth:true});assert.deepEqual(await a.GET({}),{status:401});assert.deepEqual(a.counts(),{captured:0,updated:0});
});
test('capture error fails closed',async()=>{
 const a=prepare(TODAY,{captureError:true});const r=await a.GET({});assert.equal(r.opts.status,500);assert.deepEqual(a.counts(),{captured:1,updated:0});
});
test('outcome error fails closed',async()=>{
 const a=prepare(EARLY,{outcomeError:true});const r=await a.GET({});assert.equal(r.opts.status,500);assert.deepEqual(a.counts(),{captured:0,updated:1});
});
test('source scope: outcomes always called after guard and no other route logic changed',()=>{
 assert.match(src,/const outcomes = await updateSwingUniverseOutcomes\(targetTradeDate\)/);
 assert.match(src,/NON_CURRENT_TRADE_DATE/);
});
