import test from "node:test";
import assert from "node:assert/strict";
import {auditProspectiveScoreLedger as run} from "../app/lib/research/prospectiveScoreLedger.mjs";
const base={date:"2026-11-02",code:"1234",priorScore:90,price:100,nextPrice:103,
 featureSnapshotVerified:true,featureAvailableAt:"2026-10-30T15:00:00+09:00",
 outcomeSourceVerified:true,outcomeTradeDate:"2026-11-04",outcomeAvailableAt:"2026-11-04T17:00:00+09:00"};
test("post-freeze matured input remains shadow",()=>{const x=run([base]);assert.equal(x.eligibleRows,1);assert.equal(x.signalEnabled,false);assert.equal(x.readyForTrading,false);});
test("freeze excludes same-date",()=>assert.equal(run([{...base,date:"2026-10-29"}]).excluded.preFreeze,1));
test("freeze excludes historical",()=>assert.equal(run([{...base,date:"2026-10-28"}]).excluded.preFreeze,1));
test("excludes same-day feature",()=>assert.equal(run([{...base,featureAvailableAt:"2026-11-02T08:00:00+09:00"}]).excluded.featureNotAsOf,1));
test("excludes missing feature evidence",()=>assert.equal(run([{...base,featureSnapshotVerified:false}]).excluded.featureNotAsOf,1));
test("excludes missing later price",()=>assert.equal(run([{...base,nextPrice:null}]).excluded.incompletePair,1));
test("excludes missing outcome attestation",()=>assert.equal(run([{...base,outcomeSourceVerified:false}]).excluded.outcomeUnconfirmed,1));
test("excludes nonlater outcome date",()=>assert.equal(run([{...base,outcomeTradeDate:base.date}]).excluded.outcomeUnconfirmed,1));
test("excludes outcome available on evaluation day",()=>assert.equal(run([{...base,outcomeAvailableAt:"2026-11-02T15:00:00+09:00"}]).excluded.outcomeUnconfirmed,1));
test("rejects invalid timestamp",()=>assert.equal(run([{...base,outcomeAvailableAt:"yesterday"}]).excluded.outcomeUnconfirmed,1));
test("deduplicates code and day",()=>assert.equal(run([base,base]).excluded.duplicate,1));
test("supports alphanumeric code",()=>assert.equal(run([{...base,code:"590A"}]).eligibleRows,1));
test("score threshold exactly 85 high",()=>assert.equal(run([{...base,priorScore:85}]).daily[0].highCount,1));
test("below 85 low",()=>assert.equal(run([{...base,priorScore:84}]).daily[0].lowCount,1));
test("both sides needed for comparison",()=>assert.equal(run([base]).comparableDays,0));
test("ten per group establishes one comparable day",()=>{const rows=[...Array.from({length:10},(_,i)=>({...base,code:String(1000+i)})),...Array.from({length:10},(_,i)=>({...base,code:String(2000+i),priorScore:50,nextPrice:101}))];const x=run(rows);assert.equal(x.comparableDays,1);assert.equal(x.averageGapPp,2);});
test("cannot authenticate caller",()=>assert.equal(run([base]).independentlyAuthenticatedByFunction,false));
test("empty safe",()=>assert.equal(run([]).status,"INSUFFICIENT_COMPARABLE_DATES"));
test("nonarray rejected",()=>assert.throws(()=>run({}),/INVALID_PROSPECTIVE_LEDGER/));
test("calendar invalid rejected",()=>assert.equal(run([{...base,date:"2026-11-31"}]).excluded.invalid,1));
