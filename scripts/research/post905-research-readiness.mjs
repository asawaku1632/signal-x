#!/usr/bin/env node
/** Offline coverage and look-ahead audit; never certifies a trading edge. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadReports,stratify} from './post905-stratified-summary.mjs';
export function assessResearchReadiness(reports){
 const s=stratify(reports),accepted=s.overall.accepted;
 const byDate=s.byDate.map(g=>({date:g.value,accepted:g.accepted,excluded:g.excluded}));
 const byCode=s.byCode.map(g=>({code:g.value,accepted:g.accepted,excluded:g.excluded}));
 const asOfEvidence=reports.filter(r=>r?.post905?.actual905AvailabilityVerified===true).length;
 const missingTimestampEvidence=reports.filter(r=>!Array.isArray(r?.post905?.observedPre905Minutes)).length;
 const gaps=[];
 if(accepted===0)gaps.push('NO_ACCEPTED_REPORTS');
 if(s.overall.uniqueDates<2)gaps.push('FEWER_THAN_TWO_ACCEPTED_DATES');
 if(s.overall.uniqueCodes<2)gaps.push('FEWER_THAN_TWO_ACCEPTED_CODES');
 if(missingTimestampEvidence>0)gaps.push('SOME_REPORTS_LACK_PRE905_TIMESTAMP_EVIDENCE');
 // This flag is deliberately never promoted from historical report claims.
 gaps.push('NO_INDEPENDENT_AS_OF_0905_SIGNAL_REPLAY');
 gaps.push('NO_OUT_OF_SAMPLE_FORWARD_VALIDATION');
 gaps.push('NO_EXECUTION_COST_OR_FILL_MODEL');
 return {version:'post905_research_readiness_v1',submitted:s.overall.submitted,accepted,
  excluded:s.overall.excluded.length,acceptedDates:s.overall.uniqueDates,
  acceptedCodes:s.overall.uniqueCodes,byDate,byCode,
  reportsClaimingAsOfAvailability:asOfEvidence,
  reportsWithoutPre905TimestampEvidence:missingTimestampEvidence,
  gaps,descriptiveOnly:true,verifiedTradingEdge:false,
  eligibleForNotifications:false,eligibleForProduction:false};
}
export function main(argv=process.argv.slice(2)){
 if(argv.length!==2||!argv[0].startsWith('--input-dir=')||!argv[1].startsWith('--output='))
  throw new Error('USE_--input-dir=DIR_--output=FILE');
 const dir=argv[0].slice(12),out=argv[1].slice(9);
 if(!dir||!out||!out.endsWith('.json')||resolve(dir)===resolve(out))throw new Error('INVALID_PATH');
 const result=assessResearchReadiness(loadReports(dir));
 writeFileSync(out,JSON.stringify(result,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify({status:'OFFLINE_READINESS_REPORT_CREATED',output:out,
  accepted:result.accepted,acceptedDates:result.acceptedDates,gaps:result.gaps.length})+'\n');
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main()}catch(e){process.stderr.write('READINESS_FAILED: '+(e?.code==='EEXIST'?'OUTPUT_EXISTS':e.message)+'\n');process.exitCode=1}
}
