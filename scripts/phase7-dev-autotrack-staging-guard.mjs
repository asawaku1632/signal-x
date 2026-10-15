// SIGNALX STEP327B: read-only GitHub Actions source integrity guard.
// No database client, fetch, secrets, or write methods. --save is deliberately unsupported.
import {createHash} from "node:crypto";
import {readFileSync,lstatSync} from "node:fs";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const SHA256=[
 ["app/lib/technicalObservation/bollingerShadowDevSecurity.ts","9ac98cf17bbda5e5d617c462ea3e50d9684ff217cb73f7aa1701c5be153f217a"],
 ["scripts/run-bollinger-shadow-dev.mjs","2616208435da6bda1c7761a4baba9c7096a6e52bf4b3fcbd5e7748e8f42e734a"]
];
const GIT_BLOBS=[
 ["app/lib/technicalObservation/bollingerObservationResultRunner.ts","39f19d2ce2b7862a06669a9962d137487ea8d315"],
 ["app/lib/technicalObservation/bollingerObservationResultPersistence.ts","4fb74ffe787f040b9dade625747e159fbce5dd7c"],
 ["app/lib/technicalObservation/bollingerObservationResultEvaluator.ts","3811360a505c880f158e114ab38c5eeba62467bf"],
 ["app/lib/technicalObservation/bollingerObservationResultTypes.ts","ce2b714bd31195d57b669f3f359e14775b821544"],
 ["app/lib/technicalObservation/bollingerShadowAutomation.ts","e177ab5b84bdda51956ae5400aa1615a9b8826bf"],
 ["app/lib/technicalObservation/bollingerShadowQueries.ts","d3ce6ea521228ddf02d7dfd6c64d9a6a7a74e9aa"],
 ["app/lib/technicalObservation/bollingerShadowLeaseFence.ts","28b43a2c1ed10959f769e7a9d2ec5ecf235d40c3"],
 ["app/lib/technicalObservation/bollingerObservationRunner.ts","d440df8fc37816f4357fa70f44c97024cbb3288c"],
 ["app/lib/technicalObservation/bollingerObservationPersistence.ts","0c899b98c0610e8c6bdb04c4c6db58083a12e732"],
 ["app/lib/technicalObservation/tseMarketCalendar.ts","70365a12a26c53f3c0d68c0739884a5489a209bb"]
];
function ensure(ok,code){if(!ok)throw Error("STEP327B_"+code);}
function file(name){ensure(!name.startsWith("/")&&!name.includes(".."),"PATH_REJECTED");const p=join(ROOT,name);const stat=lstatSync(p);ensure(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<300000,"FILE_REJECTED");return readFileSync(p);}
function hash(algorithm,b){return createHash(algorithm).update(b).digest("hex");}
function blob(b){return hash("sha1",Buffer.concat([Buffer.from("blob "+b.length+"\0"),b]));}
function preflight(){
 for(const [path,digest] of SHA256)ensure(hash("sha256",file(path))===digest,"SECURITY_PATCH_DRIFT");
 for(const [path,digest] of GIT_BLOBS)ensure(blob(file(path))===digest,"RESULT_PATCH_DRIFT");
 const yaml=file(".github/workflows/bb-shadow-dev-autotrack-staging.yml").toString("utf8");
 ensure(yaml.includes("10 7 * * 1-5"),"SCHEDULE_DRIFT");
 ensure(yaml.includes("vars.SIGNALX_PHASE7_DEV_AUTOTRACK_ENABLED == 'true'"),"KILL_SWITCH_MISSING");
 ensure(yaml.includes("contents: read")&&yaml.includes("signalx-dev-shadow"),"ISOLATION_MISSING");
 ensure(!/DATABASE_URL|secrets\.|--save\b|rejectUnauthorized\s*:\s*false|pull_request:|push:/i.test(yaml),"UNSAFE_WORKFLOW");
 console.log("STEP327B_SOURCE_SECURITY_PINS: VERIFIED 12/12");
 console.log("STEP327B_SCHEDULE_POLICY: STAGED_DISABLED_BY_DEFAULT");
 console.log("STEP327B_AUTO_SAVE: NOT_IMPLEMENTED");
 console.log("STEP327B_DEV_PROD_DB: UNTOUCHED");
 console.log("STEP327B_EXIT_CODE=0");
}
if(process.argv.length!==3||process.argv[2]!=="--repository-preflight"){console.log("STEP327B_MODE_NOT_ALLOWED");process.exitCode=1;}
else{try{preflight();}catch(e){console.log("STEP327B_SAFE_STOP:",/^STEP327B_/.test(e?.message)?e.message:"STEP327B_PREFLIGHT_FAILED");process.exitCode=1;}}
