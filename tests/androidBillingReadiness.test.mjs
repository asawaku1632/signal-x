import test from "node:test";
import assert from "node:assert/strict";
import {auditAndroidPlayBillingReadiness} from "../scripts/audit-android-play-billing.mjs";

test("Android package and web origin are consistent with current app",async()=>{
 const r=await auditAndroidPlayBillingReadiness();
 assert.equal(r.packageId,"com.signalx.app");
 assert.equal(r.host,"signal-x-ppjg.vercel.app");
 assert.equal(r.checks.packageIdMatchesGradle,true);
 assert.equal(r.checks.packageIdMatchesAndroidManifest,true);
 assert.equal(r.checks.hostMatchesGradle,true);
 assert.equal(r.checks.testsUseActualPackageId,true);
 assert.equal(r.checks.webAppIsTwa,true);
 assert.equal(r.checks.webManifestDefinesPwa,true);
});
test("billing cannot be presented as ready before native and web integration",async()=>{
 const r=await auditAndroidPlayBillingReadiness();
 assert.equal(r.status,"not_ready");
 assert.equal(r.checks.manifestEnablesPlayBilling,false);
 assert.equal(r.checks.nativeBillingBridgePresent,false);
 assert.equal(r.checks.nativeBillingDependencyPresent,false);
 assert.ok(r.blockers.some(s=>s.includes("obfuscated account binding")));
});
