/** Isolated daily-100 partition processor. Dependency-injected and OFF by default.
 * This module does not import production DB, price vendors, cron, or notifications.
 * Caller must acquire a durable partition claim and verify dev DB identity first.
 */
import { DAILY_100_MAX_CONCURRENCY, DAILY_100_SOURCE_TIMEOUT_MS } from "./bollingerDaily100Plan";

export type Daily100Check = {code:string; state:"OK"|"SOURCE_FAILED"; note:string|null};
export type Daily100Result = {
  partitionId:number; requested:number; observed:number; failed:number;
  status:"COMPLETE"|"PARTIAL"|"FAILED"; checks:Daily100Check[];
};
export async function processDaily100Partition(args:{
  partitionId:number;
  codes:readonly string[];
  claimed:boolean;
  fetchCompletedDaily:(code:string,signal:AbortSignal)=>Promise<unknown>;
  validateCompletedDaily:(code:string,source:unknown)=>boolean;
  persistChecks:(result:Daily100Result)=>Promise<void>;
  timeoutMs?:number;
}):Promise<Daily100Result>{
  if(!args.claimed)throw Error("DAILY100_UNCLAIMED");
  if(!Number.isInteger(args.partitionId)||args.partitionId<0||args.partitionId>4||
     args.codes.length!==20||new Set(args.codes).size!==20||
     args.codes.some(code=>!/^\d{4}$/.test(code)))throw Error("DAILY100_INVALID_PARTITION");
  const timeout=args.timeoutMs??DAILY_100_SOURCE_TIMEOUT_MS;
  if(!Number.isInteger(timeout)||timeout<1||timeout>DAILY_100_SOURCE_TIMEOUT_MS)
    throw Error("DAILY100_TIMEOUT_INVALID");
  const checks:Daily100Check[]=new Array(args.codes.length);
  let cursor=0;\n  let stopped=false;
  async function worker(){
    while(cursor<args.codes.length && !stopped){
      const index=cursor++,code=args.codes[index];
      let timer:ReturnType<typeof setTimeout>|undefined;\n      const controller=new AbortController();
      try{
        const source=await Promise.race([
          Promise.resolve().then(()=>args.fetchCompletedDaily(code,controller.signal)),
          new Promise<never>((_,reject)=>{timer=setTimeout(()=>{stopped=true;controller.abort();reject(Error("SOURCE_TIMEOUT"));},timeout);})
        ]);
        if(!args.validateCompletedDaily(code,source))throw Error("SOURCE_NOT_COMPLETED");
        checks[index]={code,state:"OK",note:null};
      }catch(e){
        checks[index]={code,state:"SOURCE_FAILED",
          note:e instanceof Error?e.message.slice(0,100):"UNKNOWN"};
      }finally{if(timer)clearTimeout(timer);}
    }
  }
  await Promise.all(Array.from({length:Math.min(DAILY_100_MAX_CONCURRENCY,args.codes.length)},()=>worker()));
  // Any unstarted codes after a timeout are explicitly recorded as failed.\n  for(let i=0;i<checks.length;i++)if(!checks[i])checks[i]={code:args.codes[i],state:"SOURCE_FAILED",note:"STOPPED_AFTER_TIMEOUT"};\n  const observed=checks.filter(c=>c.state==="OK").length,failed=checks.length-observed;
  const result:Daily100Result={partitionId:args.partitionId,requested:checks.length,observed,failed,
    status:failed===0?"COMPLETE":observed===0?"FAILED":"PARTIAL",checks};
  // Persist failure must propagate. Never claim success when audit persistence fails.
  await args.persistChecks(result);
  return result;
}
