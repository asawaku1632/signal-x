import test from "node:test";
import assert from "node:assert/strict";
import {diagnoseOpeningChartPayload as diagnose} from "../app/lib/research/morningCandlePayloadDiagnosis.mjs";
const good={chart:{result:[{timestamp:[1,2],indicators:{quote:[{open:[1,2],high:[2,3],low:[1,2],close:[2,3],volume:[10,20]}]}}]}};
test("metadata checker distinguishes missing chart payload sections",()=>{
 assert.equal(diagnose(null).kind,"INVALID_JSON_SHAPE");
 assert.equal(diagnose({},429).kind,"HTTP_ERROR");
 assert.equal(diagnose({chart:{error:{code:"X"}}}).kind,"CHART_API_ERROR");
 assert.equal(diagnose({chart:{result:[]}}).kind,"MISSING_CHART_RESULT");
 assert.equal(diagnose({chart:{result:[{}]}}).kind,"MISSING_TIMESTAMP_ARRAY");
 assert.equal(diagnose({chart:{result:[{timestamp:[]}]}}).kind,"MISSING_QUOTE_OBJECT");
});
test("malformed and empty arrays remain diagnostically distinct",()=>{
 const base=good.chart.result[0];
 assert.equal(diagnose({chart:{result:[{...base,timestamp:[1]}]}}).kind,"ARRAY_LENGTH_MISMATCH");
 assert.equal(diagnose({chart:{result:[{...base,indicators:{quote:[{...base.indicators.quote[0],volume:null}]}}]}}).kind,"MISSING_QUOTE_FIELDS");
 assert.equal(diagnose({chart:{result:[{timestamp:[],indicators:{quote:[{open:[],high:[],low:[],close:[],volume:[]}]}}]}}).kind,"EMPTY_TIMESTAMPS");
});
test("well shaped bars are not claimed to be independently verified",()=>{
 const r=diagnose(good);
 assert.equal(r.kind,"STRUCTURALLY_PRESENT");
 assert.equal(r.barCount,2);
 assert.equal(r.hasFiveMinuteData,true);
 assert.match(r.note,/neither valid 09:00/);
});
