import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
 normalizePlaySigningSha256 as normalize,
 assessPlaySigningDal as assess,
 assessRepoPlaySigningDal,
} from "../scripts/verify-play-signing-dal.mjs";

const dal=JSON.parse(await readFile(
 new URL("../public/.well-known/assetlinks.json",import.meta.url),"utf8"));
const existingFingerprint=dal.find(x=>x.target?.package_name==="com.signalx.app")
 ?.target?.sha256_cert_fingerprints?.[0];
const NOT_PLAY_CERT="AA:".repeat(31)+"AA";
const beforeRelease=JSON.parse(JSON.stringify(dal));
beforeRelease[0].relation=["delegate_permission/common.handle_all_urls"];

test("SHA-256 can be normalized, but malformed input and upload-key guesses fail",()=>{
  assert.match(normalize(existingFingerprint),/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  assert.equal(normalize(existingFingerprint.toLowerCase()),normalize(existingFingerprint));
  assert.equal(normalize(existingFingerprint.replace(/:/g,"")),normalize(existingFingerprint));
  assert.equal(normalize("sha256=bad"),null);
  assert.equal(normalize(""),null);
  assert.equal(normalize(undefined),null);
});

test("without the actual externally supplied Play signing SHA the guard denies changes",()=>{
 assert.equal(assess(dal,undefined).kind,"missing_or_invalid_play_signing_fingerprint");
 assert.equal(assess(dal,"bad value").kind,"missing_or_invalid_play_signing_fingerprint");
 assert.equal(assess(dal,NOT_PLAY_CERT).kind,"certificate_mismatch");
 assert.equal(assess(dal,NOT_PLAY_CERT).proposedAssetLinks,undefined);
});

test("a pre-release-only handle_all_urls fixture safely proposes just origin association",()=>{
 const result=assess(beforeRelease,existingFingerprint);
 assert.equal(result.kind,"proposed_change_only");
 assert.equal(result.deploymentVerified,false);
 assert.equal(result.appDeviceVerified,false);
 const proposal=result.proposedAssetLinks;
 assert.deepEqual(proposal,dal);
 assert.deepEqual(beforeRelease[0].relation,["delegate_permission/common.handle_all_urls"]);
});
test("current checked-in source contains both relations and never duplicates the origin",()=>{
 const res=assess(dal,existingFingerprint);
 assert.equal(res.kind,"source_relations_present");
 assert.equal(res.proposedAssetLinks,undefined);
 assert.equal(res.deploymentVerified,false);
 assert.equal(res.appDeviceVerified,false);
 assert.deepEqual(dal[0].relation,[
  "delegate_permission/common.handle_all_urls",
  "delegate_permission/common.use_as_origin"
 ]);
});
test("Play SHA must match the same app; unrelated statements remain untouched",()=>{
 const other={
   relation:["delegate_permission/common.use_as_origin"],
   target:{namespace:"android_app",package_name:"other.app",
    sha256_cert_fingerprints:[NOT_PLAY_CERT]}
 };
 assert.equal(assess([other],NOT_PLAY_CERT).kind,"certificate_mismatch");
 const mixed=JSON.parse(JSON.stringify([other,...beforeRelease]));
 const result=assess(mixed,existingFingerprint);
 assert.equal(result.kind,"proposed_change_only");
 assert.deepEqual(result.proposedAssetLinks[0],other);
 assert.deepEqual(result.proposedAssetLinks[1],dal[0]);
});
test("cannot enable messaging unless the Play signing SHA also handles URLs",()=>{
 const onlyOrigin=[{
  relation:["delegate_permission/common.use_as_origin"],
  target:dal[0].target
 }];
 assert.equal(assess(onlyOrigin,existingFingerprint).kind,
  "missing_handle_all_urls_for_play_certificate");
});
test("actual Android app ID and fixed origin cannot be silently changed",()=>{
 assert.equal(assess(dal,existingFingerprint,{packageId:"com.attacker.app"}).kind,"invalid_app_scope");
 assert.equal(assess(dal,existingFingerprint,{origin:"https://evil.example"}).kind,"invalid_app_scope");
 assert.equal(assess({},existingFingerprint).kind,"invalid_assetlinks_document");
});
test("repository audit never claims Play store or remote website verification",async()=>{
 const result=await assessRepoPlaySigningDal(existingFingerprint);
 assert.equal(result.kind,"source_relations_present");
 assert.equal(result.deploymentVerified,false);
 assert.equal(result.appDeviceVerified,false);
});
