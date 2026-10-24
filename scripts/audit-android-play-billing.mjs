/**
 * Read-only, reproducible Android TWA Play Billing readiness audit.
 * Does not contact Play Console, read secrets, build an APK, or enable billing.
 */
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>readFile(resolve(root,p),"utf8");

export async function auditAndroidPlayBillingReadiness(){
  const [manifestText,gradle,androidManifest,launcher,webManifest,identityTest]=await Promise.all([
    read("android-twa/twa-manifest.json"),
    read("android-twa/app/build.gradle"),
    read("android-twa/app/src/main/AndroidManifest.xml"),
    read("android-twa/app/src/main/java/com/signalx/app/LauncherActivity.java"),
    read("app/manifest.ts"),
    read("tests/playInitialPurchaseApproval.test.mjs")
  ]);
  const twa=JSON.parse(manifestText);
  const packageId=twa.packageId;
  const gradlePackage=/applicationId\s+["']([^"']+)["']/.exec(gradle)?.[1];
  const manifestPackage=/\bpackage=["']([^"']+)["']/.exec(androidManifest)?.[1];
  const host=twa.host;
  const gradleHost=/hostName:\s*["']([^"']+)["']/.exec(gradle)?.[1];

  const checks={
    packageIdMatchesGradle:!!packageId && packageId===gradlePackage,
    packageIdMatchesAndroidManifest:!!packageId && packageId===manifestPackage,
    hostMatchesGradle:!!host && host===gradleHost,
    testsUseActualPackageId:identityTest.includes('packageName: "'+packageId+'"'),
    webAppIsTwa:!!twa.generatorApp?.includes("bubblewrap") && launcher.includes("com.google.androidbrowserhelper.trusted.LauncherActivity"),
    webManifestDefinesPwa:webManifest.includes('display: "standalone"'),
    manifestEnablesPlayBilling:twa.features?.playBilling?.enabled===true,
    manifestEnablesBillingAlphaDependencies:twa.alphaDependencies?.enabled===true,
    nativeBillingBridgePresent:androidManifest.includes("com.google.androidbrowserhelper.playbilling.provider.PaymentService"),
    nativeBillingDependencyPresent:/playbilling|billingclient|com\.android\.billingclient/i.test(gradle)
  };
  const blockers=[];
  if(!checks.packageIdMatchesGradle||!checks.packageIdMatchesAndroidManifest||!checks.hostMatchesGradle||!checks.testsUseActualPackageId)
    blockers.push("Android package, host, or test fixture mismatch");
  if(!checks.manifestEnablesPlayBilling) blockers.push("Bubblewrap Play Billing feature not enabled");
  if(!checks.manifestEnablesBillingAlphaDependencies) blockers.push("Bubblewrap billing dependency flag not enabled");
  if(!checks.nativeBillingBridgePresent||!checks.nativeBillingDependencyPresent)
    blockers.push("Native Play Billing bridge/dependency absent");
  blockers.push("Web Digital Goods / Payment Request purchase UI not verified in this static audit");
  blockers.push("Play Console subscriptions, merchant account, test tracks, license testers and release status require manual verification");
  blockers.push("Server OAuth credential, acknowledgment, RTDN and end-to-end test purchase not verified");
  blockers.push("First-purchase obfuscated account binding needs an actual supported client transport");
  return {status:blockers.length?"not_ready":"ready",packageId,host,checks,blockers};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=await auditAndroidPlayBillingReadiness();
  console.log(JSON.stringify(report,null,2));
  // Informational audit: missing features are deliberate and NOT CI errors.
  // CI fails only on identity drift, not because billing isn't deployed.
  if(!report.checks.packageIdMatchesGradle ||
    !report.checks.packageIdMatchesAndroidManifest ||
    !report.checks.hostMatchesGradle ||
    !report.checks.testsUseActualPackageId) process.exitCode=1;
}
