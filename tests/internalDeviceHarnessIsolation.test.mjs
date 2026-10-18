import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=async name=>readFile(new URL("../"+name,import.meta.url),"utf8");
const root="android-twa/research/internal-device-harness/";

test("internal device harness cannot overwrite Play-installed com.signalx.app",async()=>{
 const gradle=await read(root+"build.gradle");
 const manifest=await read(root+"src/main/AndroidManifest.xml");
 assert.match(gradle,/applicationId 'com\.signalx\.bridgeprobe'/);
 assert.doesNotMatch(gradle,/applicationId 'com\.signalx\.app'/);
 assert.doesNotMatch(gradle,/signingConfig\s+/);
 assert.match(manifest,/android:label="SIGNALX Bridge Probe"/);
 assert.match(manifest,/android:allowBackup="false"/);
});
test("probe includes Chrome Custom Tabs only; it cannot execute or collect payment",async()=>{
 const gradle=await read(root+"build.gradle");
 const source=await read(root+"src/main/java/com/signalx/bridgeprobe/InternalBridgeProbeActivity.java");
 assert.match(gradle,/implementation 'androidx\.browser:browser:1\.9\.0'/);
 assert.doesNotMatch(gradle,/billingclient|play-services|integrity/i);
 assert.doesNotMatch(source,/launchBillingFlow\s*\(/);
 assert.doesNotMatch(source,/https:\/\/.*api\//);
 assert.match(source,/new TrustedWebActivityIntentBuilder\(SIGNALX\)/);
 assert.match(source,/newSession\(observed\)/);
 assert.match(source,/attachAfterWarmup\(session\)/);
 assert.match(source,/\.build\(session\)\.launchTrustedWebActivity/);
});
test("probe refuses ticket even if received; no secrets appear in diagnostics",async()=>{
 const src=await read(root+"src/main/java/com/signalx/bridgeprobe/InternalBridgeProbeActivity.java");
 assert.match(src,/opaqueTicket, expiresAt\) -> \{/);
 assert.match(src,/bridge\.close\(\)/);
 assert.doesNotMatch(src,/Log\.d\(|Log\.e\(|System\.out\.print/);
 assert.doesNotMatch(src,/report\(.*opaqueTicket/);
 assert.match(src,/com\.android\.chrome/);
 assert.match(src,/CHROME_MIN_MAJOR = 115/);
});
test("published TWA remains separate, with no PostMessageService or BillingClient",async()=>{
 const manifest=await read("android-twa/app/src/main/AndroidManifest.xml");
 const gradle=await read("android-twa/app/build.gradle");
 assert.doesNotMatch(manifest,/androidx\.browser\.customtabs\.PostMessageService/);
 assert.doesNotMatch(gradle,/com\.android\.billingclient:billing/);
 const probeManifest=await read(root+"src/main/AndroidManifest.xml");
 assert.match(probeManifest,/androidx\.browser\.customtabs\.PostMessageService/);
});

test("negative-only probe aborts on unexpected accepted DAL relationship BEFORE native callback",async()=>{
 const source=await read(root+"src/main/java/com/signalx/bridgeprobe/InternalBridgeProbeActivity.java");
 const validation=source.slice(source.indexOf("public void onRelationshipValidationResult("));
 const gate=validation.indexOf("if (accepted) {");
 const close=validation.indexOf("bridge.close();",gate);
 const returnAfterClose=validation.indexOf("return;",close);
 const forwarded=validation.indexOf("secure.onRelationshipValidationResult(",gate);
 assert.ok(gate>=0 && close>gate && returnAfterClose>close && forwarded>returnAfterClose,
   "Must reject any accepted relationship before forwarding to bridge");
 assert.match(validation,/secure\.onRelationshipValidationResult\(relation,origin,false,extras\)/);
 assert.doesNotMatch(source,/report\(.*opaqueTicket/);
});
