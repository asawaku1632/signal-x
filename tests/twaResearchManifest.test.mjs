import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=async path=>readFile(new URL("../"+path,import.meta.url),"utf8");
test("isolated Android library includes exported TWA PostMessageService",async()=>{
 const xml=await read("android-twa/research/androidx-compile/src/main/AndroidManifest.xml");
 assert.match(xml,/<application>/);
 assert.match(xml,/<service\s+android:name="androidx\.browser\.customtabs\.PostMessageService"\s+android:exported="true"/);
});
test("published Bubblewrap app manifest stays completely unaffected",async()=>{
 const xml=await read("android-twa/app/src/main/AndroidManifest.xml");
 assert.doesNotMatch(xml,/androidx\.browser\.customtabs\.PostMessageService/);
 assert.match(xml,/android:name="LauncherActivity"/);
 assert.match(xml,/android:name="\.DelegationService"/);
});
test("manifest rehearsal does not add live app Play Billing dependency",async()=>{
 const gradle=await read("android-twa/app/build.gradle");
 assert.doesNotMatch(gradle,/com\.android\.billingclient:billing:/);
 const research=await read("android-twa/research/androidx-compile/build.gradle");
 assert.match(research,/com\.android\.billingclient:billing:9\.1\.0/);
 assert.match(research,/androidx\.browser:browser:1\.9\.0/);
});
