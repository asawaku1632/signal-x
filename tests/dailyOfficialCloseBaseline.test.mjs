import test from "node:test";
import assert from "node:assert/strict";
import { evaluateOfficialCloseBaseline } from "../app/lib/research/dailyOfficialCloseBaseline.mjs";

const sessions=Array.from({length:21},(_,i)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10));
const signal={id:"p1",code:"1234",date:sessions[0],score:80};
const price=(i,close,extras={})=>({code:"1234",date:sessions[i],close,priceBasisVerified:true,corporateActionUnresolved:false,...extras});

test("verified independent close-to-close horizons",()=>{
  const r=evaluateOfficialCloseBaseline({signals:[signal],dailyCloses:[price(0,100),price(5,110),price(10,90),price(20,100)],verifiedSessions:sessions});
  assert.deepEqual(r.rows.map(x=>x.status),["VERIFIED","VERIFIED","VERIFIED"]);
  assert.deepEqual(r.rows.map(x=>x.returnPct),[10,-10,0]);
  assert.equal(r.basis,"VERIFIED_CLOSE_TO_FUTURE_CLOSE");
});
test("missing or duplicate base day cannot produce performance",()=>{
  const missing=evaluateOfficialCloseBaseline({signals:[signal],dailyCloses:[price(5,110)],verifiedSessions:sessions});
  assert.ok(missing.rows.every(x=>x.status!=="VERIFIED"));
  const duplicate=evaluateOfficialCloseBaseline({signals:[signal],dailyCloses:[price(0,100),price(0,101),price(5,110)],verifiedSessions:sessions});
  assert.ok(duplicate.rows.every(x=>x.status!=="VERIFIED"));
});
test("unresolved corporate actions block baseline",()=>{
  const r=evaluateOfficialCloseBaseline({signals:[signal],dailyCloses:[price(0,100,{corporateActionUnresolved:true}),price(5,110)],verifiedSessions:sessions});
  assert.equal(r.rows[0].returnPct,null);
});
