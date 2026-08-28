import { randomBytes } from "node:crypto";
import { Classification, RunnerV2Error } from "./state-machine.mjs";
export const TARGET_ROLE="signalx_entitlements_runtime";
export const DIRECT_CONFIG=Object.freeze({host:"db.paygtakajhvatwejygda.supabase.co",port:5432,database:"postgres",username:TARGET_ROLE});
export const POOLER_CONFIG=Object.freeze({host:"aws-1-ap-northeast-1.pooler.supabase.com",port:6543,database:"postgres",username:`${TARGET_ROLE}.paygtakajhvatwejygda`});
export const VERCEL_TARGET=Object.freeze({project:"signal-x-ppjg",projectId:"prj_tePDzABsiHBpzxsM3f6MgY1POI7j",environment:"production",variable:"SIGNALX_ENTITLEMENTS_DATABASE_URL",type:"Sensitive"});
export const IDENTITY_SQL=Object.freeze(["BEGIN READ ONLY;","SELECT current_user, session_user, current_database();","ROLLBACK;"]);
const EXPECTED=Object.freeze({currentUser:TARGET_ROLE,sessionUser:TARGET_ROLE,currentDatabase:"postgres"});
export function createProductionSecretBuffer(){const entropy=randomBytes(32),encoded=Buffer.from(entropy.toString("base64url"),"ascii");entropy.fill(0);return encoded;}
const classify=(error,prefix,phase)=>{
  if(error?.safeCode&&Classification[error.safeCode])return Classification[error.safeCode];
  if(phase==="rollback")return Classification[`${prefix}_ROLLBACK_FAILED`];
  if(error?.code==="28P01")return Classification[`${prefix}_AUTH_FAILED`];
  if(error?.code==="ETIMEDOUT"||error?.name==="TimeoutError")return Classification[`${prefix}_TIMEOUT`];
  if(["CERT_HAS_EXPIRED","DEPTH_ZERO_SELF_SIGNED_CERT","UNABLE_TO_VERIFY_LEAF_SIGNATURE","ERR_TLS_CERT_ALTNAME_INVALID"].includes(error?.code))return Classification[`${prefix}_TLS_FAILED`];
  if(["ECONNREFUSED","ECONNRESET","ENETUNREACH","EHOSTUNREACH","ENOTFOUND","EAI_AGAIN"].includes(error?.code))return Classification[`${prefix}_NETWORK_FAILED`];
  return Classification.UNKNOWN_SAFE_FAILURE;
};
export function createProductionAdapters({rotationDriver,directDriver,poolerDriver,vercelDriver,preflight=async()=>true}){
  let rotated=false;
  const connection=(driver,config,prefix)=>({
    auth:async(secret)=>{try{await driver.authenticate({...config,password:secret});return{ok:true,classification:Classification[`${prefix}_SUCCESS`]};}catch(error){return{ok:false,classification:classify(error,prefix)};}},
    identity:async(secret)=>{let session,rollback=false,phase="open";try{session=await driver.open({...config,password:secret});phase="begin";await session.execute(IDENTITY_SQL[0]);phase="identity";const identity=await session.execute(IDENTITY_SQL[1]);phase="rollback";await session.execute(IDENTITY_SQL[2]);rollback=true;const ok=identity?.currentUser===EXPECTED.currentUser&&identity?.sessionUser===EXPECTED.sessionUser&&identity?.currentDatabase===EXPECTED.currentDatabase;return{ok,rollback,classification:ok?Classification[`${prefix}_SUCCESS`]:Classification[`${prefix}_IDENTITY_MISMATCH`]};}catch(error){return{ok:false,rollback,classification:classify(error,prefix,phase)};}finally{try{await session?.close?.();}catch{}}}
  });
  const direct=connection(directDriver,DIRECT_CONFIG,"DIRECT"),pooler=connection(poolerDriver,POOLER_CONFIG,"POOLER");
  return Object.freeze({preflight,rotate:async(secret)=>{if(rotated)throw new RunnerV2Error("DUPLICATE_ROTATION_ATTEMPT");rotated=true;return rotationDriver.rotateRolePassword({role:TARGET_ROLE,password:secret});},directAuth:direct.auth,directIdentity:direct.identity,poolerAuth:pooler.auth,poolerIdentity:pooler.identity,vercelRegister:(secret)=>vercelDriver.registerSensitiveFromStdin({target:VERCEL_TARGET,stdin:secret}),verifyEnvMetadata:()=>vercelDriver.verifyMetadata({target:VERCEL_TARGET}),cleanup:async()=>{}});
}
