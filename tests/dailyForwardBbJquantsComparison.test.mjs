import test from "node:test";
import assert from "node:assert/strict";
import { compareBbOutcomeWithJquantsBars as compare } from "../app/lib/research/dailyForwardBbJquantsComparison.mjs";
const observation={code:"9432",observation_date:"2026-08-21",
 evaluated_trade_date:"2026-08-28",horizon:5,horizon_unit:"TRADING_DAY",
 provider:"YAHOO_CHART",entry_price:100,future_close:105,return_percent:5};
const dates=["2026-08-24","2026-08-25","2026-08-26","2026-08-27","2026-08-28"];
const bars=dates.map((Date,i)=>({Code:"9432",Date,C:101+i}));
test("matching five official daily closes never authorizes price or license",()=>{
 const r=compare(observation,bars);
 assert.equal(r.status,"REFERENCE_CLOSE_MATCHES");
 assert.equal(r.priceBasisVerified,false);
 assert.equal(r.productionWrites,false);
});
test("reference close discrepancy remains visible",()=>{
 assert.equal(compare(observation,bars.map((b,i)=>i===4?{...b,C:106}:b)).status,"REFERENCE_CLOSE_DIFFERS");
});
test("missing day, duplicate date and invalid basis fail closed",()=>{
 assert.equal(compare(observation,bars.slice(1)).reason,"FIVE_TRADING_DAYS_NOT_ESTABLISHED");
 assert.equal(compare(observation,[...bars,bars[0]]).reason,"DUPLICATE_REFERENCE_DATE");
 assert.equal(compare({...observation,horizon:3},bars).status,"BLOCKED");
});
test("stored Yahoo return arithmetic is checked independently",()=>{
 assert.equal(compare({...observation,return_percent:12},bars).reason,"STORED_RETURN_INCONSISTENT");
});
