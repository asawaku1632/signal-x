import { Classification, RunnerV2Error } from "./state-machine.mjs";
import { spawn } from "node:child_process";
import { DIRECT_CONFIG, IDENTITY_SQL, POOLER_CONFIG, TARGET_ROLE, VERCEL_TARGET } from "./production-adapters.mjs";

export const CONNECTION_TIMEOUT_MS = 10_000;
export const MAX_CAPTURE_BYTES = 64 * 1024;
const SQL = new Set(IDENTITY_SQL);
const safeFailure = (classification) => Object.freeze({ ok:false, classification });

function assertEndpoint(config, expected) {
  for (const key of ["host","port","database","username"]) if (config[key] !== expected[key]) throw new RunnerV2Error("ENDPOINT_IDENTITY_REJECTED");
}
function passwordString(buffer) { if (!Buffer.isBuffer(buffer) || !buffer.length) throw new RunnerV2Error("INVALID_SECRET_BUFFER"); return buffer.toString("ascii"); }

export function createPgIdentityDriver({ endpoint, clientFactory }) {
  if (endpoint !== DIRECT_CONFIG && endpoint !== POOLER_CONFIG) throw new RunnerV2Error("UNKNOWN_ENDPOINT_TYPE");
  let attempts=0,activeClient;
  const makeClient=(config,secret)=>{assertEndpoint(config,endpoint);return clientFactory({host:endpoint.host,port:endpoint.port,database:endpoint.database,user:endpoint.username,password:passwordString(secret),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:CONNECTION_TIMEOUT_MS,query_timeout:CONNECTION_TIMEOUT_MS,statement_timeout:CONNECTION_TIMEOUT_MS});};
  return Object.freeze({
    authenticate:async(config)=>{if(attempts++>0)throw new RunnerV2Error("DUPLICATE_CONNECTION_ATTEMPT");const client=makeClient(config,config.password);try{await client.connect();activeClient=client;}catch(error){try{await client.end();}catch{}throw error;}},
    open:async(config)=>{assertEndpoint(config,endpoint);if(!activeClient)throw new RunnerV2Error("AUTHENTICATED_SESSION_REQUIRED");const client=activeClient;activeClient=undefined;return Object.freeze({execute:async(sql)=>{if(!SQL.has(sql))throw new RunnerV2Error("SQL_NOT_ALLOWLISTED");const result=await client.query(sql);if(sql===IDENTITY_SQL[1]){const row=result?.rows?.[0];return{currentUser:row?.current_user,sessionUser:row?.session_user,currentDatabase:row?.current_database};}},close:()=>client.end()});},
  });
}

export function createRotationDriver({ privilegedClientFactory }) {
  let attempts=0;
  return Object.freeze({rotateRolePassword:async({role,password})=>{
    if(role!==TARGET_ROLE||role==="postgres")return safeFailure(Classification.ROTATION_FAILED);
    if(attempts++>0)throw new RunnerV2Error("DUPLICATE_ROTATION_ATTEMPT");
    const client=privilegedClientFactory({targetRole:role}); let text;
    try { await client.connect(); const escaped=passwordString(password).replaceAll("'","''"); text=`ALTER ROLE signalx_entitlements_runtime PASSWORD '${escaped}'`; await client.query(text); return true; }
    catch { return safeFailure(Classification.ROTATION_FAILED); }
    finally { text=undefined; try{await client.end();}catch{} }
  }});
}

function encodeUriComponentBuffer(input) {
  const safe=/[A-Za-z0-9_.~-]/;const pieces=[];
  for(const byte of input){const char=String.fromCharCode(byte);pieces.push(safe.test(char)?char:`%${byte.toString(16).toUpperCase().padStart(2,"0")}`);}
  return Buffer.from(pieces.join(""),"ascii");
}
export function createVercelCliDriver({ processExecutor }) {
  let attempts=0;
  return Object.freeze({
    registerSensitiveFromStdin:async({target,stdin})=>{
      if(JSON.stringify(target)!==JSON.stringify(VERCEL_TARGET))return safeFailure(Classification.VERCEL_PROJECT_MISMATCH);
      if(attempts++>0)throw new RunnerV2Error("DUPLICATE_VERCEL_REGISTRATION");
      const encoded=encodeUriComponentBuffer(stdin);const prefix=Buffer.from(`postgresql://${POOLER_CONFIG.username}:`),suffix=Buffer.from(`@${POOLER_CONFIG.host}:${POOLER_CONFIG.port}/${POOLER_CONFIG.database}?sslmode=require`);const uri=Buffer.concat([prefix,encoded,suffix]);encoded.fill(0);
      const args=["env","add",VERCEL_TARGET.variable,VERCEL_TARGET.environment,"--sensitive","--yes","--project",VERCEL_TARGET.project,"--project-id",VERCEL_TARGET.projectId];
      let result;try {result=await processExecutor({file:"vercel",args,stdin:uri,timeoutMs:CONNECTION_TIMEOUT_MS,capture:true});if(result?.exitCode===0)return true;if(result?.safeCode&&Classification[result.safeCode])return safeFailure(Classification[result.safeCode]);return safeFailure(Classification.VERCEL_REGISTRATION_FAILED);}catch{return safeFailure(Classification.UNKNOWN_SAFE_FAILURE);}finally{result?.stdout?.fill?.(0);result?.stderr?.fill?.(0);uri.fill(0);prefix.fill(0);suffix.fill(0);}
    },
    verifyMetadata:async({target})=>{if(JSON.stringify(target)!==JSON.stringify(VERCEL_TARGET))return false;let result;try{result=await processExecutor({file:"vercel",args:["env","inspect",VERCEL_TARGET.variable,VERCEL_TARGET.environment,"--json","--project",VERCEL_TARGET.project,"--project-id",VERCEL_TARGET.projectId],stdin:Buffer.alloc(0),timeoutMs:CONNECTION_TIMEOUT_MS,capture:true});if(result?.exitCode!==0)return false;const metadata=result.metadata??JSON.parse(result.stdout.toString("utf8"));return metadata?.name===VERCEL_TARGET.variable&&metadata?.environment===VERCEL_TARGET.environment&&metadata?.type==="Sensitive"&&metadata?.projectId===VERCEL_TARGET.projectId;}catch{return false;}finally{result?.stdout?.fill?.(0);result?.stderr?.fill?.(0);}},
  });
}

export function createSafeProcessExecutor({ spawnImpl = spawn } = {}) {
  return ({ file, args, stdin, timeoutMs }) => new Promise((resolve) => {
    if (file !== "vercel" || !Array.isArray(args) || args.some(value => typeof value !== "string")) return resolve({exitCode:-1,safeCode:"UNKNOWN_SAFE_FAILURE"});
    const child=spawnImpl(file,args,{stdio:["pipe","pipe","pipe"],shell:false,windowsHide:true,env:{PATH:process.env.PATH}});const stdout=[],stderr=[];let outBytes=0,errBytes=0,finished=false;
    const collect=(target,kind)=>(chunk)=>{const buffer=Buffer.from(chunk),remaining=MAX_CAPTURE_BYTES-(kind==="out"?outBytes:errBytes);if(remaining>0)target.push(buffer.subarray(0,remaining));if(kind==="out")outBytes+=buffer.length;else errBytes+=buffer.length;};
    child.stdout.on("data",collect(stdout,"out"));child.stderr.on("data",collect(stderr,"err"));
    const timer=setTimeout(()=>{if(!finished)child.kill();},timeoutMs);
    const done=(exitCode,safeCode)=>{if(finished)return;finished=true;clearTimeout(timer);resolve({exitCode,safeCode,stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr)});};
    child.once("error",error=>done(-1,error?.code==="ETIMEDOUT"?"VERCEL_REGISTRATION_FAILED":"UNKNOWN_SAFE_FAILURE"));child.once("close",code=>done(code??-1));child.stdin.end(stdin);
  });
}
