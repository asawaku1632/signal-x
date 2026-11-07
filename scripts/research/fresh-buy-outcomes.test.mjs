import assert from "node:assert/strict";
import {evaluateBuyOutcome,buyFamily,BUY_FAMILIES} from "../../app/lib/freshBuyOutcomes.mjs";
const event={code:"6678",trade_date:"2026-11-06",bar_time:Date.parse("2026-11-06T15:00:00+09:00")/1000,detected_at:"2026-11-06T15:05:01+09:00",reference_price:100};
const dates=["2026-11-09","2026-11-10","2026-11-11","2026-11-12","2026-11-13"];
const rows=dates.map(Date=>({Date,Code:"66780",O:101,H:104,L:100,C:103,Vo:1000,AdjFactor:1}));
const now=Date.parse("2026-11-13T17:30:00+09:00");let passed=0;
const check=ok=>{assert.ok(ok);passed++;};
for(const horizon of [1,3,5]){
 const p={horizon,target_date:dates[horizon-1],required_dates:dates.slice(0,horizon)};
 check(evaluateBuyOutcome(event,p,rows,now).status==="COMPLETE");
 check(Math.abs(evaluateBuyOutcome(event,p,rows,now).return_pct-3)<1e-9);
}
const p={horizon:3,target_date:dates[2],required_dates:dates.slice(0,3)};
check(evaluateBuyOutcome(event,p,rows,0).status==="PENDING");
check(evaluateBuyOutcome(event,p,rows.slice(1),now).status==="DATA_MISSING");
check(evaluateBuyOutcome(event,p,[...rows,rows[0]],now).status==="DATA_MISSING");
check(evaluateBuyOutcome(event,p,rows.map((r,i)=>i===1?{...r,AdjFactor:.5}:r),now).status==="CORPORATE_ACTION_REVIEW");
check(evaluateBuyOutcome(event,p,rows.map((r,i)=>i===2?{...r,C:null}:r),now).status==="DATA_MISSING");
check(evaluateBuyOutcome({...event,detected_at:"2026-11-09T09:00:00+09:00"},p,rows,now).status==="INVALID_EVENT");
check(evaluateBuyOutcome(event,p,rows.map(r=>({...r,Code:"12340"})),now).status==="DATA_MISSING");
check(BUY_FAMILIES.length===8&&buyFamily("STRUCTURE_pattern031")==="TRIANGLE"&&buyFamily("STRUCTURE_pattern033")==="TRIANGLE");
console.log({passed});
