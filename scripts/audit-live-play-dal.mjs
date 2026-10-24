/**
 * READ-ONLY public HTTPS origin audit for Google Play / TWA postMessage.
 * Does not deploy, modify files, use credentials or bypass Vercel protection.
 * A positive result confirms only the fetched JSON at this point in time,
 * NEVER actual Google Play signing or browser relationship validation.
 */
export const LIVE_DAL_URL="https://signal-x-ppjg.vercel.app/.well-known/assetlinks.json";
export const SIGNALX_PACKAGE="com.signalx.app";
// Public Google Play Console Digital Asset Links fingerprint (NOT upload key).
export const PLAY_APP_SIGNING_SHA256="C0:DF:8C:E9:18:EA:73:FA:A1:25:5A:0D:E4:7E:14:55:F8:8D:2B:8E:59:3A:56:4B:E0:34:B6:AE:56:4B:2E:D4";
const HANDLE="delegate_permission/common.handle_all_urls";
const POST="delegate_permission/common.use_as_origin";
const RECORDS_LIMIT=32;

export function inspectServedDal(content) {
  if(!Array.isArray(content) || content.length>RECORDS_LIMIT)
    return {kind:"invalid_json_structure"};
  const matching=content.filter(entry=>
    entry && !Array.isArray(entry) && typeof entry==="object" &&
    entry.target?.namespace==="android_app" &&
    entry.target?.package_name===SIGNALX_PACKAGE &&
    Array.isArray(entry.relation) &&
    Array.isArray(entry.target.sha256_cert_fingerprints) &&
    entry.target.sha256_cert_fingerprints.includes(PLAY_APP_SIGNING_SHA256)
  );
  if(!matching.length)return {kind:"signing_certificate_or_package_mismatch"};
  const hasHandle=matching.some(entry=>entry.relation.includes(HANDLE));
  if(!hasHandle)return {kind:"missing_url_association"};
  const hasPost=matching.some(entry=>entry.relation.includes(POST));
  return hasPost?{kind:"dal_relations_served_device_unverified"}:
    {kind:"missing_use_as_origin"};
}

export async function auditLivePlayDal(httpGet=fetch) {
  let response;
  try {
    response=await httpGet(LIVE_DAL_URL,{
      method:"GET",
      redirect:"manual",
      headers:{Accept:"application/json"},
      signal:AbortSignal.timeout(8000),
    });
  } catch {return {kind:"network_unavailable"};}
  if(!response || typeof response.status!=="number")
    return {kind:"network_unavailable"};
  if(response.status===401 || response.status===403)
    return {kind:"not_publicly_accessible",httpStatus:response.status};
  if(response.status!==200)
    return {kind:"unexpected_http_status",httpStatus:response.status};
  const contentType=response.headers?.get("content-type")??"";
  if(!/\bapplication\/json\b/i.test(contentType))
    return {kind:"unexpected_content_type"};
  let raw;
  try {raw=await response.text();}
  catch {return {kind:"invalid_json_structure"};}
  if(typeof raw!=="string" || raw.length>32768)
    return {kind:"invalid_json_structure"};
  try {return inspectServedDal(JSON.parse(raw));}
  catch {return {kind:"invalid_json_structure"};}
}

if(process.argv[1] && import.meta.url===new URL("file://"+process.argv[1]).href) {
  const result=await auditLivePlayDal();
  console.log(JSON.stringify({
    publicUrl:LIVE_DAL_URL,
    ...result,
    productionAppChanged:false,
    actualAndroidDeviceVerified:false,
  },null,2));
  // Observation-only; a missing DAL relation is expected BEFORE release.
  // CI must not confuse this diagnostic with a successful live checkout.
}
