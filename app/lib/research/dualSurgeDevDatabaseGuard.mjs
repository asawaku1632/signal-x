// Offline guard only. Must be called before any dev-only DB operation.
// This function never opens a connection or writes data.
function projectRef(value){
 if(typeof value!=="string")return null;
 try{
  const url=new URL(value);
  if(url.protocol!=="https:"||url.username||url.password||url.port)return null;
  const match=/^([a-z0-9-]+)\.supabase\.co$/.exec(url.hostname);
  if(!match||url.pathname!=="/"&&url.pathname!=="")return null;
  return match[1];
 }catch{return null;}
}
export function assessDevDatabaseIsolation({
 devUrl,productionUrl,environment,expectedDevProjectRef,
 serviceRoleUsed=false,writeRequested=false,ownerVerified=false
}={}){
 const reasons=[];
 const dev=projectRef(devUrl),production=projectRef(productionUrl);
 if(!dev)reasons.push("DEV_DATABASE_IDENTITY_UNVERIFIED");
 if(!production)reasons.push("PRODUCTION_DATABASE_IDENTITY_UNVERIFIED");
 if(!expectedDevProjectRef||dev!==expectedDevProjectRef)reasons.push("EXPECTED_DEV_PROJECT_MISMATCH");
 if(dev&&production&&dev===production)reasons.push("DEV_EQUALS_PRODUCTION");
 if(environment!=="development"&&environment!=="test")reasons.push("NON_DEVELOPMENT_ENVIRONMENT");
 if(serviceRoleUsed===true)reasons.push("SERVICE_ROLE_NOT_PERMITTED");
 if(writeRequested===true)reasons.push("WRITE_NOT_PERMITTED");
 if(ownerVerified!==true)reasons.push("OWNER_NOT_VERIFIED");
 return {isolated:reasons.length===0,reasons,readOnly:true,productionApproved:false};
}
