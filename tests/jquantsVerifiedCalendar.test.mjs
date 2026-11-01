import test from "node:test";
import assert from "node:assert/strict";
import { parseJQuantsTseCalendar as parse } from "../app/lib/research/jquantsVerifiedCalendar.mjs";
import { alignVerifiedSessionHorizons as align } from "../app/lib/research/verifiedSessionHorizons.mjs";

const data = [
  ["2026-09-18","1"],["2026-09-19","0"],["2026-09-20","0"],
  ["2026-09-21","3"],["2026-09-22","3"],["2026-09-23","3"],
  ["2026-09-24","1"],["2026-09-25","1"],["2026-09-26","0"],
  ["2026-09-27","0"],["2026-09-28","1"],["2026-09-29","1"],
  ["2026-09-30","1"],
].map(([Date,HolDiv])=>({Date,HolDiv}));
const fixture=()=>({data,from:"2026-09-18",to:"2026-09-30",sourceVerified:true,responseComplete:true});

test("OSE holiday trading remains excluded from TSE equity sessions",()=>{
  const r=parse(fixture());
  assert.equal(r.status,"RESEARCH_ONLY");
  assert.deepEqual(r.exchangeSessions,[
    "2026-09-18","2026-09-24","2026-09-25",
    "2026-09-28","2026-09-29","2026-09-30"]);
});
test("unverified provenance and pagination fail closed",()=>{
  assert.equal(parse({...fixture(),sourceVerified:false}).status,"BLOCKED");
  assert.equal(parse({...fixture(),responseComplete:false}).status,"BLOCKED");
});
test("missing a holiday row still invalidates calendar completeness",()=>{
  assert.equal(parse({...fixture(),data:data.filter(x=>x.Date!=="2026-09-22")}).reason,"INCOMPLETE_CALENDAR_RANGE");
});
test("duplicate, invalid and malformed rows fail closed",()=>{
  assert.equal(parse({...fixture(),data:[...data,data[0]]}).reason,"DUPLICATE_CALENDAR_DATE");
  assert.equal(parse({...fixture(),data:[...data,{Date:"2026-10-01",HolDiv:"9"}]}).reason,"INVALID_CALENDAR_ROW");
});
test("verified calendar feeds same-day stock and TOPIX alignment",()=>{
  const calendar=parse(fixture());
  const stock=new Map(calendar.exchangeSessions.map((d,i)=>[d,100+i*2]));
  const index=new Map(calendar.exchangeSessions.map((d,i)=>[d,2000+i*10]));
  const r=align({...calendar,signalDate:"2026-09-18",asOfDate:"2026-10-01",stockCloses:stock,indexCloses:index});
  assert.equal(r.horizons[5].date,"2026-09-30");
  assert.ok(Math.abs(r.horizons[5].excessReturn-7.5)<1e-9);
});
