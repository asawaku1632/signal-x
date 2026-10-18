import test from "node:test";
import assert from "node:assert/strict";
import {auditTwaPostMessageDal} from "../scripts/audit-twa-postmessage-dal.mjs";

test("checked-in Android package and origin remain SIGNALX",async()=>{
 const a=await auditTwaPostMessageDal();
 assert.equal(a.appId,"com.signalx.app");
 assert.equal(a.origin,"https://signal-x-ppjg.vercel.app");
 assert.equal(a.staticAssetLinksHasValidShaFormat,true);
});
test("existing handle_all_urls DAL is NOT the required postMessage use_as_origin relation",async()=>{
 const a=await auditTwaPostMessageDal();
 assert.equal(a.staticAssetLinksAllowsTwaPostMessage,false);
 assert.equal(a.readyForLiveNativeCheckout,false);
});
test("repo alone cannot certify actual Play signing SHA or live website deployment",async()=>{
 const a=await auditTwaPostMessageDal();
 assert.equal(a.playSigningCertificateMatched,"not_verified");
 assert.equal(a.deployedAssetLinksMatched,"not_verified");
});
