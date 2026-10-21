/** Explicit, dependency-injected dev-only source-audit orchestration.
 * No scheduler, vendor, DB connection, or production imports in this module.
 * This is source availability auditing, NOT Bollinger signal/outcome persistence.
 */
import {processDaily100Partition,type Daily100Result} from "./bollingerDaily100PartitionProcessor";
import type {Daily100ClaimResult} from "./bollingerDaily100Claim";
export async function runDaily100DevSourceAudit(args:{
  tradeDate:string;
  partitionId:number;
  claim:()=>Promise<Daily100ClaimResult>;
  fetchCompletedDaily:(code:string)=>Promise<unknown>;
  validateCompletedDaily:(code:string,source:unknown)=>boolean;
  persistChecks:(result:Daily100Result)=>Promise<void>;
}):Promise<{state:"SKIPPED";reason:string}|{state:"AUDITED";result:Daily100Result}>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(args.tradeDate)||
    !Number.isInteger(args.partitionId)||args.partitionId<0||args.partitionId>4)
    throw Error("DAILY100_AUDIT_REQUEST_INVALID");
  const claimed=await args.claim();
  if(claimed.state!=="CLAIMED")return {state:"SKIPPED",reason:claimed.state};
  const result=await processDaily100Partition({
    partitionId:args.partitionId,codes:claimed.codes,claimed:true,
    fetchCompletedDaily:args.fetchCompletedDaily,
    validateCompletedDaily:args.validateCompletedDaily,
    persistChecks:args.persistChecks
  });
  return {state:"AUDITED",result};
}
