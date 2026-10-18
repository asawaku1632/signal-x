import test from "node:test";
import assert from "node:assert/strict";
import {
  issuePlayCheckoutTicketResearch as issue,
  redeemPlayCheckoutTicketResearch as redeem,
} from "../app/lib/billing/playCheckoutTicketResearch.ts";

const userId="123e4567-e89b-42d3-a456-426614174000";
const now=new Date("2026-10-18T02:00:00Z");
const config={
  allowedProductId:"premium_month",
  packageName:"com.signalx.app",
  ticketDigestKey:"ci-checkout-ticket-key-a1b2c3d4e5f6g7h8i9j0",
  accountBindingKey:"ci-checkout-account-key-a1b2c3d4e5f6g7h8i9j0",
  allowedPlaySigningCertificateDigests:["test-signing-cert-digest-01"]
};
function fakeDatabase(){
  const tickets=new Map(), used=[];
  return {tickets,used,
    async query(sql,params){
      if(sql.includes("INSERT INTO public.signalx_play_checkout_tickets")){
        tickets.set(params[0],{user_id:params[5],product_id:params[2],package_name:params[1],
          issued_at:new Date(params[3]),expires_at:new Date(params[4]),consumed_at:null});
        return {rowCount:1,rows:[{id:"new"}]};
      }
      const row=tickets.get(params[0]);
      if(sql.includes("SELECT user_id,product_id"))return {rowCount:row?1:0,rows:row?[row]:[]};
      if(sql.includes("UPDATE public.signalx_play_checkout_tickets")){
        used.push(params[0]);
        if(!row||row.consumed_at || new Date(row.expires_at)<=new Date(params[1]) ||
          new Date(row.issued_at)>new Date(params[1]))return {rowCount:0,rows:[]};
        row.consumed_at=new Date(params[1]);
        return {rowCount:1,rows:[{user_id:row.user_id}]};
      }
      throw Error("Unexpected SQL");
    }
  };
}
const trusted=(hash,at=now, overrides={})=>async()=>({
 requestDetails:{
   requestPackageName:config.packageName,
   requestHash:hash,timestampMillis:String(at.getTime()),
   ...overrides.requestDetails
 },
 appIntegrity:{
   appRecognitionVerdict:"PLAY_RECOGNIZED",packageName:config.packageName,
   certificateSha256Digest:config.allowedPlaySigningCertificateDigests,
   ...overrides.appIntegrity
 }
});

test("issue returns only one short-lived raw ticket, stores keyed digest",async()=>{
 const db=fakeDatabase(), issued=await issue(userId,config,db,now);
 assert.equal(issued.kind,"issued");
 assert.match(issued.ticket,/^[A-Za-z0-9_-]{43}$/);
 assert.ok(![...db.tickets.keys()].includes(issued.ticket));
 assert.equal(db.tickets.size,1);
 assert.equal(issued.expiresAt,"2026-10-18T02:02:00.000Z");
 assert.match(issued.integrityRequestHash,/^[A-Za-z0-9_-]{43}$/);
});
test("valid trusted attestation redeems exactly once",async()=>{
 const db=fakeDatabase(), issued=await issue(userId,config,db,now);
 const req={ticket:issued.ticket,opaqueIntegrityToken:"server-verifiable-integrity-token"};
 const decoded=trusted(issued.integrityRequestHash);
 const result=await redeem(req,config,db,decoded,now);
 assert.equal(result.kind,"redeemed");
 assert.equal(result.productId,"premium_month");
 assert.match(result.obfuscatedAccountId,/^[a-f0-9]{64}$/);
 assert.equal((await redeem(req,config,db,decoded,now)).kind,"not_available");
 assert.equal(db.used.length,1);
});
test("missing attestation is blocked without consuming ticket",async()=>{
 const db=fakeDatabase(), issued=await issue(userId,config,db,now);
 const req={ticket:issued.ticket,opaqueIntegrityToken:"fake"};
 const fail=await redeem(req,config,db,async()=>null,now);
 assert.equal(fail.kind,"untrusted_android");
 assert.equal(db.used.length,0);
 assert.equal((await redeem(req,config,db,trusted(issued.integrityRequestHash),now)).kind,"redeemed");
});
test("wrong request hash, package, certificate or app verdict is blocked",async()=>{
 const cases=[
   trusted("not-matching"),
   trusted("",now,{requestDetails:{requestPackageName:"com.other.app"}}),
   trusted("",now,{appIntegrity:{certificateSha256Digest:["wrong-signature"]}}),
   trusted("",now,{appIntegrity:{appRecognitionVerdict:"UNRECOGNIZED_VERSION"}})
 ];
 for (let i=0;i<cases.length;i++){
   const db=fakeDatabase(), issued=await issue(userId,config,db,now);
   const decoder=i===0?cases[i]:trusted(issued.integrityRequestHash,now,
     i===1?{requestDetails:{requestPackageName:"com.other.app"}}:
     i===2?{appIntegrity:{certificateSha256Digest:["wrong-signature"]}}:
     {appIntegrity:{appRecognitionVerdict:"UNRECOGNIZED_VERSION"}});
   assert.equal((await redeem({ticket:issued.ticket,opaqueIntegrityToken:"test"},config,db,decoder,now)).kind,"untrusted_android");
   assert.equal(db.used.length,0);
 }
});
test("expired checkout cannot consume even with a valid proof",async()=>{
 const db=fakeDatabase(), issued=await issue(userId,config,db,now);
 const late=new Date(now.getTime()+120_000);
 assert.equal((await redeem({ticket:issued.ticket,opaqueIntegrityToken:"test"},config,db,trusted(issued.integrityRequestHash,late),late)).kind,"not_available");
});
test("stale attestation is blocked while checkout ticket is still alive",async()=>{
 const db=fakeDatabase(),issued=await issue(userId,config,db,now);
 const old=new Date(now.getTime()-121_000);
 assert.equal((await redeem({ticket:issued.ticket,opaqueIntegrityToken:"test"},config,db,trusted(issued.integrityRequestHash,old),now)).kind,"untrusted_android");
});
test("invalid products/users and missing signing certificate allowlist fail closed",async()=>{
 const db=fakeDatabase();
 assert.equal((await issue("not-a-uuid",config,db,now)).kind,"invalid_input");
 assert.equal((await issue(userId,{...config,packageName:"fake.app"},db,now)).kind,"invalid_input");
 const issued=await issue(userId,config,db,now);
 assert.equal((await redeem({ticket:issued.ticket,opaqueIntegrityToken:"test"},{
   ...config,allowedPlaySigningCertificateDigests:[]
 },db,trusted(issued.integrityRequestHash),now)).kind,"invalid_input");
 assert.equal(db.used.length,0);
});
