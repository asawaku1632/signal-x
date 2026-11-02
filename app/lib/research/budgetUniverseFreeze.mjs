/** Immutable, complete-as-of nightly budget-universe cohort (research-only).
 * Does not fetch quotes, IR, tomorrow's prices or any outcome data.
 */
import {createHash} from "node:crypto";
export const BUDGET_UNIVERSE_POLICY="BUDGET_UNIVERSE_NIGHT_FREEZE_V1";
export const BUDGETS=Object.freeze([100000,300000,350000,500000]);
export const MAX_DAILY_ROWS=1500;
const validDate=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
  Number.isFinite(Date.parse(s+"T00:00:00Z"))&&
  new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const number=x=>x===null||x===undefined||x===""?null:
  Number.isFinite(Number(x))?Number(x):null;
const ms=s=>typeof s==="string"&&/(Z|[+-]\d{2}:\d{2})$/.test(s)?Date.parse(s):NaN;
export function freezeBudgetUniverse({
  sourceDate,tradeDate,frozenAt,rows,expectedUniverseCount,
}){
  if(!validDate(sourceDate)||!validDate(tradeDate)||tradeDate<=sourceDate||
     !Number.isInteger(expectedUniverseCount)||expectedUniverseCount<100)
    throw Error("INVALID_FREEZE_INPUT");
  const freeze=ms(frozenAt);
  if(!Number.isFinite(freeze)||
     freeze<Date.parse(sourceDate+"T18:10:00+09:00")||
     freeze>=Date.parse(sourceDate+"T19:00:00+09:00")||
     freeze>=Date.parse(tradeDate+"T09:00:00+09:00"))
    throw Error("OUTSIDE_FROZEN_NIGHT_WINDOW");
  if(!Array.isArray(rows)||rows.length>MAX_DAILY_ROWS)
    throw Error("SCAN_UNIVERSE_INCOMPLETE_OR_CAPPED");
  const unique=new Map(),invalid=[];
  for(const r of rows){
    const code=String(r?.code??""),score=number(r?.score),price=number(r?.price);
    const date=r?.snapshotDate??r?.date;
    const saved=ms(r?.savedAt??r?.createdAt);
    if(!/^[0-9]{4}$/.test(code)||!String(r?.name??"").trim()||
       score===null||score<0||score>100||price===null||price<=0||
       date!==sourceDate||!Number.isFinite(saved)||saved>freeze){
      invalid.push(code||"INVALID");
      continue;
    }
    if(unique.has(code))throw Error("DUPLICATE_DAY_CODE");
    unique.set(code,{code,name:String(r.name).trim(),score,referencePrice:price,
      snapshotDate:sourceDate,sourceSavedAt:new Date(saved).toISOString()});
  }
  const coverage=unique.size/expectedUniverseCount;
  if(coverage<0.8)throw Error("DAILY_UNIVERSE_COVERAGE_TOO_LOW");
  const eligible=[...unique.values()].filter(x=>x.score>=85)
    .sort((a,b)=>b.score-a.score||a.code.localeCompare(b.code));
  const cohort=eligible.map(row=>({
    ...row,referenceCostYen:Number((row.referencePrice*100).toFixed(2)),
    affordableBudgets:BUDGETS.filter(b=>row.referencePrice*100<=b),
    evidence:"PRE_FROZEN_AI_ONLY",shares:100,
  }));
  const budgets=BUDGETS.map(b=>({
    budgetYen:b,
    codes:cohort.filter(c=>c.affordableBudgets.includes(b)).map(c=>c.code),
  }));
  const payload={policy:BUDGET_UNIVERSE_POLICY,sourceDate,tradeDate,frozenAt,
    expectedUniverseCount,observedUniverseCount:unique.size,
    coverage:Number((coverage*100).toFixed(2)),
    invalidRowCount:invalid.length,cohort,budgets,
    interpretation:"REFERENCE_ONLY_NOT_VERIFIED_FILL",
  };
  return {...payload,sha256:createHash("sha256")
    .update(JSON.stringify(payload)).digest("hex")};
}
