import test from "node:test";
import assert from "node:assert/strict";
import { runGatedJQuantsForwardResearch } from "../app/lib/research/gatedJquantsForwardResearch.mjs";
const sessions=Array.from({length:21},(_,i)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10));
const signals=[{id:"p1",code:"7203",date:sessions[0],score:80}];
const data=[0,5,10,20].map((i)=>({Code:"7203",Date:sessions[i],AdjC:i===0?100:110}));
const input=(overrides={})=>({signals,jquantsPayload:{data},verifiedSessions:sessions,expectedCodes:["7203"],...overrides});

test("default unverified payload blocks all performance",()=>{
  const r=runGatedJQuantsForwardResearch(input());
  assert.equal(r.status,"BLOCKED_DATA_QUALITY");
  assert.deepEqual(r.rows,[]);
  assert.deepEqual(r.summary,[]);
});
test("explicitly certified synthetic daily bars can calculate forward baseline",()=>{
  const r=runGatedJQuantsForwardResearch(input({certifiedComparable:true}));
  assert.equal(r.status,"EVALUATED");
  assert.deepEqual(r.rows.map(x=>x.returnPct),[10,10,10]);
  assert.ok(r.rows.every(x=>x.status==="VERIFIED"));
});
test("duplicate or malformed adjusted close blocks entire batch",()=>{
  const dup=runGatedJQuantsForwardResearch(input({certifiedComparable:true,jquantsPayload:{data:[...data,data[0]]}}));
  assert.equal(dup.status,"BLOCKED_DATA_QUALITY");
  const missing=runGatedJQuantsForwardResearch(input({certifiedComparable:true,jquantsPayload:{data:[...data.slice(0,2),{Code:"7203",Date:sessions[10],C:110},data[3]]}}));
  assert.equal(missing.status,"BLOCKED_DATA_QUALITY");
});
