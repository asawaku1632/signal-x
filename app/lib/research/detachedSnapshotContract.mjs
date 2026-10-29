/** Detached research-only snapshot contract. No database or networking. */
import {createHash} from "node:crypto";
const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const instant=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
const positive=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
export function createDetachedResearchSnapshot({date,code,score,price,capturedAt,sourceId,sourceVersion}){
 if(!validDate(date)||!/^(?:\d{4}|\d{3}[A-Z])$/.test(code??"")||
   typeof score!=="number"||!Number.isFinite(score)||!positive(price)||!instant(capturedAt)||
   Date.parse(capturedAt)>=Date.parse(date+"T09:05:00+09:00")||
   typeof sourceId!=="string"||!sourceId.trim()||typeof sourceVersion!=="string"||!sourceVersion.trim())
   throw Error("INVALID_SNAPSHOT_CONTRACT");
 const payload={schema:"DETACHED_RESEARCH_SNAPSHOT_V1",date,code,score,price,capturedAt,sourceId,sourceVersion};
 const digest=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
 return Object.freeze({...payload,digest,independentlyAuthenticated:false,usableForTrading:false});
}
export function inspectDetachedSnapshot(snapshot){
 if(!snapshot||snapshot.schema!=="DETACHED_RESEARCH_SNAPSHOT_V1"||typeof snapshot.digest!=="string")return {structurallyIntact:false,externallyAuthenticated:false};
 try{
  const rebuilt=createDetachedResearchSnapshot(snapshot);
  return {structurallyIntact:rebuilt.digest===snapshot.digest,externallyAuthenticated:false};
 }catch{return {structurallyIntact:false,externallyAuthenticated:false};}
}
