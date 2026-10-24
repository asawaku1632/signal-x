import test from "node:test";
import assert from "node:assert/strict";
import {
  issueAuthenticatedPlayCheckoutResearch as issue,
} from "../app/lib/billing/playCheckoutSessionGate.ts";

const origin="https://signal-x-ppjg.vercel.app";
const alice="123e4567-e89b-42d3-a456-426614174000";
const bob="123e4567-e89b-42d3-a456-426614174001";
const now=new Date("2026-10-18T01:00:00Z");
const config={
  enabled:true,
  expectedOrigin:origin,
  ticket:{
    packageName:"com.signalx.app",
    allowedProductId:"premium_month",
    ticketDigestKey:"isolated-checkout-ticket-hmac-key-1234567890",
    accountBindingKey:"isolated-checkout-account-hmac-key-12345678",
  }
};
function validReq(body="{}",headerOverrides={},url=origin+"/api/checkout"){
  return new Request(url,{
    method:"POST",
    headers:{
      host:"signal-x-ppjg.vercel.app",
      origin,
      "content-type":"application/json",
      "sec-fetch-site":"same-origin",
      "x-signalx-request":"play-checkout-issue-v1",
      ...headerOverrides
    },
    body
  });
}
function db(){
  const calls=[];
  return {calls,async query(sql,values){
    calls.push({sql,values});
    return {rowCount:1,rows:[{id:"server-db-record"}]};
  }};
}
const session=(id)=>async()=>({user:{id}});
test("authenticated NextAuth UUID, never browser identity, controls ticket owner",async()=>{
  const database=db();
  const res=await issue(validReq(),config,database,session(alice),now);
  assert.equal(res.kind,"issued");
  assert.equal(database.calls.length,1);
  assert.equal(database.calls[0].values[5],alice);
  assert.ok(!database.calls[0].sql.includes(bob));
  assert.equal(Object.hasOwn(res,"userId"),false);
  assert.match(res.ticket,/^[A-Za-z0-9_-]{43}$/);
  assert.match(res.integrityRequestHash,/^[A-Za-z0-9_-]{43}$/);
});
test("browser cannot choose another user ID, product, price or redirect",async()=>{
  const database=db();
  for(const body of [
    JSON.stringify({userId:bob}),
    JSON.stringify({productId:"other"}),
    JSON.stringify({amount:0}),
    JSON.stringify({redirect:"https://attacker.example"}),
    "[]","null","not JSON"
  ]) {
    const r=await issue(validReq(body),config,database,session(alice),now);
    assert.equal(r.kind,"request_rejected");
  }
  assert.equal(database.calls.length,0);
});
test("Play review and logged-out sessions without internal UUID fail",async()=>{
  const database=db();
  for(const getSession of [
    async()=>null,
    async()=>({user:{email:"review@example.test"}}),
    async()=>({user:{id:"not-a-uuid"}}),
    async()=>{throw Error("broken provider")}
  ]){
    assert.equal((await issue(validReq(),config,database,getSession,now)).kind,"unauthenticated");
  }
  assert.equal(database.calls.length,0);
});
test("disabled flag rejects request before session or DB access",async()=>{
  const database=db();
  let sessions=0;
  assert.equal((await issue(validReq(),{...config,enabled:false},database,async()=>{
    sessions++;return {user:{id:alice}};
  },now)).kind,"disabled");
  assert.equal(sessions,0);
  assert.equal(database.calls.length,0);
});
test("origin, host, query, missing fetch-metadata, auth header or CSRF marker fail",async()=>{
  const database=db();
  const rejects=[
    validReq("{}",{origin:"https://attacker.example"}),
    validReq("{}",{host:"attacker.example"}),
    validReq("{}",{"sec-fetch-site":"cross-site"}),
    validReq("{}",{"sec-fetch-site":""}),
    validReq("{}",{"x-signalx-request":"not-approved"}),
    validReq("{}",{"authorization":"Bearer client"}),
    validReq("{}",{},origin+"/api/checkout?token=do-not-accept"),
    validReq("{}",{"content-type":"text/plain"})
  ];
  for(const req of rejects){
    assert.equal((await issue(req,config,database,session(alice),now)).kind,"request_rejected");
  }
  assert.equal(database.calls.length,0);
});
test("non-POST and oversized request bodies are blocked",async()=>{
  const database=db();
  const get=new Request(origin+"/api/checkout",{method:"GET",headers:{host:"signal-x-ppjg.vercel.app"}});
  assert.equal((await issue(get,config,database,session(alice),now)).kind,"request_rejected");
  assert.equal((await issue(validReq(" ".repeat(300)),config,database,session(alice),now)).kind,"request_rejected");
  assert.equal(database.calls.length,0);
});
test("wrong expected origin or malformed session resolver fails closed",async()=>{
  const database=db();
  assert.equal((await issue(validReq(),{...config,expectedOrigin:"https://attacker.example"},database,session(alice),now)).kind,"request_rejected");
  assert.equal(database.calls.length,0);
});
test("DB-disabled account and unavailable storage never issue tickets",async()=>{
  const unavailable={async query(){throw Error("temporary pg down")}};
  const disabled={async query(){return {rowCount:0,rows:[]}}};
  assert.equal((await issue(validReq(),config,disabled,session(alice),now)).kind,"disabled_user");
  assert.equal((await issue(validReq(),config,unavailable,session(alice),now)).kind,"unavailable");
});
