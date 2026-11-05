#!/usr/bin/env node
/** Prints the pinned future research plan; no J-Quants network, file writes or keys. */
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyFourPatternReplicationPlan}
 from '../../app/lib/research/fourPatternReplicationPlan.mjs';

export function runFourPatternReplicationPlan(argv=[]){
 if(!Array.isArray(argv)||argv.length!==0)
  return {status:'BLOCKED_NO_RUNTIME_PLAN_OVERRIDES_ALLOWED',
   productionReady:false,notificationEligible:false};
 return verifyFourPatternReplicationPlan();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=runFourPatternReplicationPlan(process.argv.slice(2));
 console.log(JSON.stringify(result,null,2));
 if(result.status!=='PREDECLARED_HOLDOUT_PLAN_ONLY')process.exitCode=1;
}
