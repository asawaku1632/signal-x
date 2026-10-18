/**
 * Static, read-only checkout bridge prerequisite audit; no network requests.
 * Presence of a SHA256 certificate fingerprint in source does NOT prove it
 * matches the Play app signing certificate installed by Google.
 */
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
export async function auditTwaPostMessageDal(){
  const [assets,twa]=await Promise.all([
    readFile(resolve(root,"public/.well-known/assetlinks.json"),"utf8").then(JSON.parse),
    readFile(resolve(root,"android-twa/twa-manifest.json"),"utf8").then(JSON.parse)
  ]);
  const packageId=twa.packageId,origin="https://"+twa.host;
  const statements=Array.isArray(assets)?assets.filter(x=>
    x?.target?.namespace==="android_app" &&
    x?.target?.package_name===packageId):[];
  const fingerprint=/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/i;
  const validSha=statements.some(x=>
    Array.isArray(x.target.sha256_cert_fingerprints) &&
    x.target.sha256_cert_fingerprints.some(s=>typeof s==="string" && fingerprint.test(s)));
  const useAsOrigin=statements.some(x=>
    Array.isArray(x.relation) &&
    x.relation.includes("delegate_permission/common.use_as_origin") &&
    Array.isArray(x.target.sha256_cert_fingerprints) &&
    x.target.sha256_cert_fingerprints.some(s=>typeof s==="string" && fingerprint.test(s)));
  return {
    appId:packageId,origin,
    staticAssetLinksHasValidShaFormat:validSha,
    staticAssetLinksAllowsTwaPostMessage:useAsOrigin,
    // This audit cannot verify website deployment or Google Play's signing SHA.
    playSigningCertificateMatched:"not_verified",
    deployedAssetLinksMatched:"not_verified",
    readyForLiveNativeCheckout:false
  };
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await auditTwaPostMessageDal();
  console.log(JSON.stringify(result,null,2));
  // Not-ready is intentional; this informational audit must not enable billing.
  if(result.appId!=="com.signalx.app" ||
     result.origin!=="https://signal-x-ppjg.vercel.app")process.exitCode=1;
}
