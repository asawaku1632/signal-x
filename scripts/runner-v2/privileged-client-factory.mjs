import { RunnerV2Error } from "./state-machine.mjs";
import { TARGET_ROLE } from "./production-adapters.mjs";
import { CONNECTION_TIMEOUT_MS } from "./real-drivers.mjs";

function zero(value){if(Buffer.isBuffer(value))value.fill(0);}
export function createPrivilegedClientFactory({ credentialProvider, ClientClass }) {
  if(typeof credentialProvider!=="function")throw new TypeError("PRIVILEGED_CREDENTIAL_PROVIDER_REQUIRED");
  if(typeof ClientClass!=="function")throw new TypeError("PRIVILEGED_CLIENT_CLASS_REQUIRED");
  let factoryAttempts=0;
  return ({targetRole}={})=>{
    if(targetRole!==TARGET_ROLE||targetRole==="postgres")throw new RunnerV2Error("ROTATION_TARGET_REJECTED");
    if(factoryAttempts++>=1)throw new RunnerV2Error("DUPLICATE_PRIVILEGED_CONNECTION_ATTEMPT");
    let client,credential,connected=false;
    return Object.freeze({
      connect:async()=>{if(connected)throw new RunnerV2Error("DUPLICATE_PRIVILEGED_CONNECTION_ATTEMPT");credential=await credentialProvider({purpose:"ROTATE_SIGNALX_ENTITLEMENTS_RUNTIME",targetRole:TARGET_ROLE});if(!credential||!Buffer.isBuffer(credential.password)||!credential.password.length)throw new RunnerV2Error("INVALID_PRIVILEGED_CREDENTIAL");client=new ClientClass({host:credential.host,port:credential.port,database:credential.database,user:credential.username,password:credential.password.toString("utf8"),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:CONNECTION_TIMEOUT_MS,query_timeout:CONNECTION_TIMEOUT_MS,statement_timeout:CONNECTION_TIMEOUT_MS});await client.connect();connected=true;},
      query:(sql)=>{if(!connected)throw new RunnerV2Error("PRIVILEGED_CLIENT_NOT_CONNECTED");return client.query(sql);},
      end:async()=>{try{await client?.end?.();}finally{zero(credential?.password);credential=undefined;client=undefined;connected=false;}},
    });
  };
}
