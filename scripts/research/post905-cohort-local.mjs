#!/usr/bin/env node
/**
 * Offline research-only cohort aggregation. No network, database, or alerts.
 * Inputs are JSON reports emitted by the reconciled minute pilot.
 * Output contains only aggregates and code/date exclusions, never raw bars.
 */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {summarizePost905Cohort} from '../../app/lib/research/post905CohortShadow.mjs';

export function parseArgs(argv){
 const input=[],args={input};
 for(const token of argv){
  if(token.startsWith('--input=')){input.push(token.slice(8));continue}
  if(token.startsWith('--input-dir=')){if(args.inputDir)throw new TypeError('DUPLICATE_INPUT_DIR');args.inputDir=token.slice(12);continue}
  if(token.startsWith('--output=')){if(args.output)throw new TypeError('DUPLICATE_OUTPUT');args.output=token.slice(9);continue}
  throw new TypeError('USE_--input=report.json_--output=summary.json');
 }
 if((input.length<1&&!args.inputDir)||input.length>100||!args.output||input.some(x=>!x||x===args.output))
  throw new TypeError('REQUIRE_1_TO_100_INPUTS_AND_DISTINCT_OUTPUT');
 if(new Set(input.map(x=>resolve(x))).size!==input.length||
    input.some(x=>resolve(x)===resolve(args.output)))
  throw new TypeError('DUPLICATE_OR_OVERLAPPING_PATHS');
 return args;
}
export function resolveCohortInputs(args,listing=readdirSync){
 const fromDir=args.inputDir?listing(args.inputDir,{withFileTypes:true})
  .filter(entry=>entry.isFile()&&/^[0-9]{3}[0-9A-Z]_20\\d{2}-\\d{2}-\\d{2}\\.json$/.test(entry.name))
  .map(entry=>join(args.inputDir,entry.name)).sort():[];
 const paths=[...args.input,...fromDir];
 if(paths.length<1||paths.length>100||new Set(paths.map(resolve)).size!==paths.length||
    paths.some(p=>resolve(p)===resolve(args.output)))
  throw new TypeError('INVALID_COHORT_FILE_COUNT_OR_PATH');
 return paths;
}
export function buildCohortFromFiles(paths,reader=readFileSync){
 const reports=paths.map(path=>{
  const data=reader(path,'utf8');
  if(data.length>100000)throw new TypeError('OVERSIZE_REPORT');
  const r=JSON.parse(data);
  if(!r||typeof r!=='object'||Array.isArray(r))throw new TypeError('INVALID_REPORT');
  return r;
 });
 return summarizePost905Cohort(reports);
}
export function main(argv=process.argv.slice(2)){
 const args=parseArgs(argv);
 const summary=buildCohortFromFiles(resolveCohortInputs(args));
 // Exclusive create: never silently overwrite previous research output.
 writeFileSync(args.output,JSON.stringify(summary,null,2)+'\n',{flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify({status:'LOCAL_RESEARCH_SUMMARY_CREATED',
  output:args.output,submitted:summary.submitted,accepted:summary.accepted,
  excluded:summary.excluded.length,eligibleForProduction:false})+'\n');
 return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main()}catch(e){
  process.stderr.write('COHORT_FAILED: '+(e?.code==='EEXIST'?'OUTPUT_EXISTS':String(e?.message??'INVALID_INPUT').slice(0,100))+'\n');
  process.exitCode=1;
 }
}
