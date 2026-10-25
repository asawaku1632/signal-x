import test from "node:test";
import assert from "node:assert/strict";
import {replayDiagnosticEvents,summarizeReplayResults} from "../../app/lib/research/dualSurgeRawReplay.mjs";
const dates=Array.from({length:8},(_,i)=>"2026-10-"+String(i+1).padStart(2,"0"));
const bars=dates.map((Date,i)=>({Code:"37620",Date,O:100,H:i===5?111:101,L:99,C:i===5?110:100,Vo:1000,AdjFactor:1}));
const matured=[{code:"3762",cohort:"PRE_SURGE_V1",startDate:dates[0],status:"MATURED",returnPct:10}];
const pending=[{code:"3762",cohort:"PRE_SURGE_V1",startDate:dates[6],status:"PENDING",returnPct:null}];
test("replay matches matured return from caller supplied bars",()=>{const r=replayDiagnosticEvents({referenceEvents:matured,providerRowsByCode:{"3762":bars},asOfDate:dates[7]});assert.equal(r.allMatched,true);assert.equal(r.results[0].calculatedReturnPct,10)});
test("replay flags mismatched return",()=>{const r=replayDiagnosticEvents({referenceEvents:[{...matured[0],returnPct:9}],providerRowsByCode:{"3762":bars},asOfDate:dates[7]});assert.equal(r.allMatched,false)});
test("replay treats unmatured horizon as pending",()=>assert.equal(replayDiagnosticEvents({referenceEvents:pending,providerRowsByCode:{"3762":bars},asOfDate:dates[7]}).allMatched,true));
test("replay flags missing source stock",()=>assert.equal(replayDiagnosticEvents({referenceEvents:matured,providerRowsByCode:{},asOfDate:dates[7]}).results[0].status,"MISSING_PROVIDER_ROWS"));
test("replay flags missing signal date",()=>assert.equal(replayDiagnosticEvents({referenceEvents:matured,providerRowsByCode:{"3762":bars.slice(1)},asOfDate:dates[7]}).results[0].status,"MISSING_SIGNAL_SESSION"));
test("replay rejects duplicate event identities",()=>assert.throws(()=>replayDiagnosticEvents({referenceEvents:[...matured,...matured],providerRowsByCode:{"3762":bars},asOfDate:dates[7]}),/DUPLICATE_EVENT_IDENTITY/));
test("replay excludes rows after as-of date",()=>assert.equal(replayDiagnosticEvents({referenceEvents:matured,providerRowsByCode:{"3762":bars},asOfDate:dates[3]}).allMatched,false));
test("replay is always read only and not production approved",()=>{const r=replayDiagnosticEvents({referenceEvents:matured,providerRowsByCode:{"3762":bars},asOfDate:dates[7]});assert.equal(r.providerRequests,0);assert.equal(r.productionApproved,false)});

test("replay rejects impossible as-of date",()=>assert.throws(()=>replayDiagnosticEvents({referenceEvents:matured,providerRowsByCode:{"3762":bars},asOfDate:"2026-02-30"}),/INVALID_REPLAY_INPUT/));

test("replay does not count an empty reference set as successful verification",()=>{
 const r=replayDiagnosticEvents({referenceEvents:[],providerRowsByCode:{},asOfDate:dates[7]});
 assert.equal(r.eventCount,0);
 assert.equal(r.checked,0);
 assert.equal(r.allMatched,false);
 assert.equal(r.productionApproved,false);
});

test("replay excludes corporate-action-adjusted sessions instead of counting a match",()=>{
 const adjusted=bars.map((b,i)=>i===2?{...b,AdjFactor:0.5}:b);
 const r=replayDiagnosticEvents({referenceEvents:matured,providerRowsByCode:{"3762":adjusted},asOfDate:dates[7]});
 assert.equal(r.results[0].status,"EXCLUDED_CORPORATE_OR_UNKNOWN_ADJUSTMENT");
 assert.equal(r.results[0].matches,false);
 assert.equal(r.allMatched,false);
});
test("replay rejects invalid source OHLCV rather than silently dropping the bar",()=>{
 const invalid=bars.map((b,i)=>i===1?{...b,H:90}:b);
 assert.throws(()=>replayDiagnosticEvents({referenceEvents:matured,providerRowsByCode:{"3762":invalid},asOfDate:dates[7]}),/INVALID_PROVIDER_OHLCV/);
});
test("replay refuses to verify a signal after the as-of cutoff",()=>{
 const r=replayDiagnosticEvents({referenceEvents:pending,providerRowsByCode:{"3762":bars},asOfDate:dates[3]});
 assert.equal(r.results[0].status,"OUTSIDE_AS_OF_DATE");
 assert.equal(r.allMatched,false);
});
test("replay rejects duplicated provider session dates",()=>{
 assert.throws(()=>replayDiagnosticEvents({referenceEvents:matured,providerRowsByCode:{"3762":[...bars,bars[0]]},asOfDate:dates[7]}),/DUPLICATE_PROVIDER_DATE/);
});

test("replay summary separates positive, negative, flat, pending and missing without counting pending as success",()=>{
 const results=[
  {status:"MATURED",calculatedReturnPct:4,matches:true},
  {status:"MATURED",calculatedReturnPct:-3,matches:false},
  {status:"MATURED",calculatedReturnPct:0,matches:true},
  {status:"PENDING",matches:true},
  {status:"EXCLUDED_CORPORATE_OR_UNKNOWN_ADJUSTMENT",matches:false},
  {status:"MISSING_PROVIDER_ROWS",matches:false}
 ];
 assert.deepEqual(summarizeReplayResults(results),{
  total:6,maturedPositive:1,maturedNegative:1,maturedFlat:1,
  pending:1,excluded:1,missing:1,mismatched:1,matched:3,unverified:3
 });
});
test("replay summary rejects unknown statuses and invalid matured returns",()=>{
 assert.throws(()=>summarizeReplayResults([{status:"SUCCESS",matches:true}]),/UNKNOWN_REPLAY_STATUS/);
 assert.throws(()=>summarizeReplayResults([{status:"MATURED",matches:true,calculatedReturnPct:null}]),/INVALID_MATURED_RETURN/);
});
test("empty replay summary reports zero observations, not a verified win",()=>{
 const r=replayDiagnosticEvents({referenceEvents:[],providerRowsByCode:{},asOfDate:dates[7]});
 assert.equal(r.summary.total,0);
 assert.equal(r.summary.maturedPositive,0);
 assert.equal(r.allMatched,false);
});
