import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assessPlaySigningDal} from "../scripts/verify-play-signing-dal.mjs";

// Public fingerprints explicitly supplied from SIGNALX's Play Console.
// These are NOT private signing keys. Never accept the upload certificate
// in place of the Google Play *App signing key* for a distributed app.
const PLAY_APP_SIGNING_SHA256=
 "C0:DF:8C:E9:18:EA:73:FA:A1:25:5A:0D:E4:7E:14:55:F8:8D:2B:8E:59:3A:56:4B:E0:34:B6:AE:56:4B:2E:D4";
const UPLOAD_KEY_SHA256=
 "17:66:A9:A1:58:B0:FF:9A:1E:A0:AA:FE:22:12:0A:E9:60:DD:BF:4F:81:B4:0B:A4:A2:D9:26:93:E3:53:9D:79";
const load=async path=>JSON.parse(await readFile(new URL("../"+path,import.meta.url),"utf8"));
const sourcePath="public/.well-known/assetlinks.json";
const proposedPath="android-twa/research/postmessage-assetlinks.proposal.json";

test("Google Play Console distribution certificate exactly matches SIGNALX source DAL",async()=>{
 const source=await load(sourcePath);
 const statement=source.find(x=>x.target?.package_name==="com.signalx.app");
 assert.ok(statement);
 assert.deepEqual(statement.target.sha256_cert_fingerprints,[PLAY_APP_SIGNING_SHA256]);
 assert.deepEqual(statement.relation,[
  "delegate_permission/common.handle_all_urls",
  "delegate_permission/common.use_as_origin"
 ]);
 assert.equal(assessPlaySigningDal(source,PLAY_APP_SIGNING_SHA256).kind,"source_relations_present");
});

test("upload signing certificate must NEVER be substituted for Play signing certificate",async()=>{
 const source=await load(sourcePath);
 const wrong=assessPlaySigningDal(source,UPLOAD_KEY_SHA256);
 assert.equal(wrong.kind,"certificate_mismatch");
 assert.equal(wrong.proposedAssetLinks,undefined);
 assert.notEqual(PLAY_APP_SIGNING_SHA256,UPLOAD_KEY_SHA256);
});

test("research DAL proposal matches published source without modifying package or certificate",async()=>{
 const source=await load(sourcePath);
 const proposal=await load(proposedPath);
 const expected=JSON.parse(JSON.stringify(source));
 assert.deepEqual(proposal,expected);
 assert.equal(assessPlaySigningDal(proposal,PLAY_APP_SIGNING_SHA256).kind,"source_relations_present");
 // Checked-in source must now contain the relation after DAL-only PR #162.
 // The source comparison alone cannot certify an installed Android device.
 assert.deepEqual(source[0].relation,[
  "delegate_permission/common.handle_all_urls",
  "delegate_permission/common.use_as_origin"
 ]);
});
