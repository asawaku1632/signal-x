import test from "node:test";
import assert from "node:assert/strict";
import {auditLivePlayDal,inspectServedDal,LIVE_DAL_URL,
  PLAY_APP_SIGNING_SHA256,SIGNALX_PACKAGE} from "../scripts/audit-live-play-dal.mjs";

const UPLOAD_SHA="17:66:A9:A1:58:B0:FF:9A:1E:A0:AA:FE:22:12:0A:E9:60:DD:BF:4F:81:B4:0B:A4:A2:D9:26:93:E3:53:9D:79";
const handle="delegate_permission/common.handle_all_urls";
const origin="delegate_permission/common.use_as_origin";
function document(sha=PLAY_APP_SIGNING_SHA256,relations=[handle]){
 return [{relation:relations,target:{namespace:"android_app",
   package_name:SIGNALX_PACKAGE,sha256_cert_fingerprints:[sha]}}];
}
function response(data,status=200,contentType="application/json"){
 return {status,headers:{get:k=>k==="content-type"?contentType:null},
   async text(){return typeof data==="string"?data:JSON.stringify(data);}};
}
test("same Google Play app certificate and both relations only proves served JSON",()=>{
 assert.deepEqual(inspectServedDal(document(PLAY_APP_SIGNING_SHA256,[handle,origin])),
   {kind:"dal_relations_served_device_unverified"});
});
test("currently required origin relation missing reports not yet ready",()=>{
 assert.deepEqual(inspectServedDal(document()),{kind:"missing_use_as_origin"});
});
test("upload signing key, other package and missing URL association do not pass",()=>{
 assert.equal(inspectServedDal(document(UPLOAD_SHA)).kind,
   "signing_certificate_or_package_mismatch");
 const other=document();other[0].target.package_name="com.another.app";
 assert.equal(inspectServedDal(other).kind,
   "signing_certificate_or_package_mismatch");
 assert.equal(inspectServedDal(document(PLAY_APP_SIGNING_SHA256,[origin])).kind,
   "missing_url_association");
});
test("requires exactly public, HTTPS, JSON response and never follows redirects",async()=>{
 let calls=0;
 const result=await auditLivePlayDal(async(url,init)=>{
   calls++;assert.equal(url,LIVE_DAL_URL);
   assert.equal(init.method,"GET");
   assert.equal(init.redirect,"manual");
   assert.equal(init.headers.Accept,"application/json");
   return response(document());
 });
 assert.deepEqual(result,{kind:"missing_use_as_origin"});
 assert.equal(calls,1);
 for(const [status,wanted] of [[401,"not_publicly_accessible"],[403,"not_publicly_accessible"],
   [302,"unexpected_http_status"],[500,"unexpected_http_status"]]){
   const denied=await auditLivePlayDal(async()=>response(document(),status));
   assert.equal(denied.kind,wanted);
 }
 assert.equal((await auditLivePlayDal(async()=>response("<html>login</html>",200,"text/html"))).kind,
   "unexpected_content_type");
});
test("malformed JSON, oversized documents, DNS errors and data errors fail closed",async()=>{
 assert.equal((await auditLivePlayDal(async()=>{throw Error("DNS unavailable")})).kind,
   "network_unavailable");
 assert.equal((await auditLivePlayDal(async()=>response("{invalid"))).kind,
   "invalid_json_structure");
 assert.equal((await auditLivePlayDal(async()=>response("["+"0,".repeat(20000)+"]"))).kind,
   "invalid_json_structure");
 assert.equal(inspectServedDal({}).kind,"invalid_json_structure");
 assert.equal(inspectServedDal(Array(33).fill({})).kind,"invalid_json_structure");
 assert.equal((await auditLivePlayDal(async()=>({status:200,headers:{get:()=>"application/json"},
   text:async()=>{throw Error("stream error")}}))).kind,"invalid_json_structure");
});
