/**
 * RESEARCH-ONLY, READ-ONLY Play App Signing SHA-256 -> Digital Asset Links
 * comparison. Never edits assetlinks.json or deploys anything.
 *
 * Do NOT use an upload-key, local APK, or local keystore fingerprint as proof
 * of the certificate Google Play uses to sign distributed app builds.
 * Supply the Play App Signing SHA-256 copied from Play Console.
 *
 * This checks the checked-in source only. It cannot attest the deployed origin,
 * actual Play certificate, signed APK, or Android browser relationship result.
 */
import {readFile} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const PACKAGE="com.signalx.app";
const ORIGIN="https://signal-x-ppjg.vercel.app";
const HANDLE="delegate_permission/common.handle_all_urls";
const ORIGIN_REL="delegate_permission/common.use_as_origin";

export function normalizePlaySigningSha256(value) {
  if(typeof value!=="string") return null;
  const compact=value.trim().replace(/:/g,"").toUpperCase();
  if(!/^[A-F0-9]{64}$/.test(compact)) return null;
  return compact.match(/.{2}/g).join(":");
}

/**
 * A Play Console fingerprint is external evidence supplied by an operator.
 * This function checks local DAL matching and proposes a no-write change ONLY
 * when the exact certificate is already present as a URL handler association.
 */
export function assessPlaySigningDal(source,playConsoleSha256,{
  packageId=PACKAGE,origin=ORIGIN
}={}) {
  if(packageId!==PACKAGE||origin!==ORIGIN) return {kind:"invalid_app_scope"};
  const expected=normalizePlaySigningSha256(playConsoleSha256);
  if(!expected) return {kind:"missing_or_invalid_play_signing_fingerprint"};
  if(!Array.isArray(source)) return {kind:"invalid_assetlinks_document"};

  const matches=[];
  for(let index=0;index<source.length;index++) {
    const stmt=source[index];
    if(!stmt || typeof stmt!=="object" || Array.isArray(stmt)) continue;
    const target=stmt.target;
    if(!target || target.namespace!=="android_app" ||
       target.package_name!==packageId || !Array.isArray(stmt.relation) ||
       !Array.isArray(target.sha256_cert_fingerprints)) continue;
    if(!stmt.relation.every(x=>typeof x==="string") ||
       !target.sha256_cert_fingerprints.every(x=>normalizePlaySigningSha256(x))) {
      return {kind:"invalid_assetlinks_document"};
    }
    if(target.sha256_cert_fingerprints.some(x=>normalizePlaySigningSha256(x)===expected)){
      matches.push(index);
    }
  }
  // A verified-looking upload key must NEVER trigger an automatic override:
  // only exact equality to the provided Play-distribution certificate is useful.
  if(!matches.length)
    return {kind:"certificate_mismatch",checkedInPackageId:packageId};
  const verifiedHandle=matches.find(i=>source[i].relation.includes(HANDLE));
  if(verifiedHandle===undefined)
    return {kind:"missing_handle_all_urls_for_play_certificate"};

  const alreadyConfigured=matches.some(i=>
    source[i].relation.includes(HANDLE) && source[i].relation.includes(ORIGIN_REL));
  if(alreadyConfigured)
    return {kind:"source_relations_present",matchedPlaySigningFingerprint:expected,
      deploymentVerified:false,appDeviceVerified:false};

  const proposal=structuredClone(source);
  const current=proposal[verifiedHandle].relation;
  proposal[verifiedHandle].relation=[...current,ORIGIN_REL];
  return {
    kind:"proposed_change_only",
    matchedPlaySigningFingerprint:expected,
    proposedAssetLinks:proposal,
    deploymentVerified:false,
    appDeviceVerified:false
  };
}

export async function assessRepoPlaySigningDal(fingerprint) {
  const [twa,dal]=await Promise.all([
    readFile(resolve(root,"android-twa/twa-manifest.json"),"utf8").then(JSON.parse),
    readFile(resolve(root,"public/.well-known/assetlinks.json"),"utf8").then(JSON.parse)
  ]);
  if(twa.packageId!==PACKAGE || "https://"+twa.host!==ORIGIN)
    return {kind:"invalid_app_scope"};
  return assessPlaySigningDal(dal,fingerprint);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  // Accept a public certificate fingerprint from the operator's environment,
  // NOT an unvalidated auto-discovery from the local keystore.
  const result=await assessRepoPlaySigningDal(process.env.SIGNALX_PLAY_APP_SIGNING_SHA256);
  const safe={
    kind:result.kind,
    matchedPlaySigningFingerprint:result.matchedPlaySigningFingerprint??null,
    deploymentVerified:false,
    appDeviceVerified:false,
    // Deliberately do not print or write a production config file.
    proposalAvailable:result.kind==="proposed_change_only"
  };
  console.log(JSON.stringify(safe,null,2));
  if(result.kind!=="proposed_change_only" && result.kind!=="source_relations_present")
    process.exitCode=1;
}
