import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBbJquantsComparisons as audit } from "../app/lib/research/dailyForwardBbJquantsBatchAudit.mjs";
const base={code:"9432",observation_date:"2026-08-21",evaluated_trade_date:"2026-08-28",
 horizon:5,horizon_unit:"TRADING_DAY",provider:"YAHOO_CHART",
 entry_price:100,future_close:105,return_percent:5};
const dates=["2026-08-24","2026-08-25","2026-08-26","2026-08-27","2026-08-28"];
const bars=dates.map((Date,i)=>({Code:"9432",Date,C:101+i}));
test("batch audit separates matching, differing and unavailable records",()=>{
 const out=audit([base,{...base,future_close:106,return_percent:6},
 {...base,code:"8591"}],{"9432":bars});
 assert.equal(out.total,3);
 assert.equal(out.matched,1);
 assert.equal(out.differed,1);
 assert.equal(out.blocked,1);
 assert.equal(out.reasons.FIVE_TRADING_DAYS_NOT_ESTABLISHED,1);
 assert.equal(out.productionWrites,false);
 assert.equal(out.productionApproval,false);
});
test("missing inputs fail closed",()=>{
 assert.equal(audit(null,{}).status,"BLOCKED");
 assert.equal(audit([],null).status,"BLOCKED");
});
