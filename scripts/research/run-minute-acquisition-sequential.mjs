#!/usr/bin/env node
/** Explicit sequential historical batches; default dry-run. No production writes. */
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);
const execute=args.includes('--execute');
const get=k=>args.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
const code=get('code')??'3762',from=get('from'),to=get('to');
const dir=get('dir')??'minute-research-reports';
const allowed=new Set(['--execute','--code','--from','--to','--dir']);
function run(script,params){
 const r=spawnSync(process.execPath,[script,...params],{encoding:'utf8',timeout:900000,maxBuffer:8*1024*1024,windowsHide:true,env:process.env});
 if(r.error||r.status!==0)throw new Error(script+': '+String(r.stderr||r.error||'nonzero exit').slice(0,600));
 return r.stdout;
}
try{
 if(args.some(a=>!Array.from(allowed).some(k=>a===k||a.startsWith(k+'=')))||
 !/^[0-9]{3}[0-9A-Z]$/.test(code)||!/^2026-\d{2}-\d{2}$/.test(from??'')||
 !/^2026-\d{2}-\d{2}$/.test(to??'')||from>to||
 !/^[a-zA-Z0-9_.-]+$/.test(dir)||dir==='.'||dir==='..')
 throw new Error('USAGE: --code=3762 --from=2026-07-01 --to=2026-10-30 [--execute]');
 const base=['--code='+code,'--from='+from,'--to='+to,'--dir='+dir];
 const plan=JSON.parse(run('scripts/research/plan-minute-acquisition.mjs',[...base,'--batch-size=5']));
 if(plan.quarantinedExistingDays.length)throw new Error('STOP_UNVERIFIED_EXISTING_DATES: '+plan.quarantinedExistingDays.join(','));
 if(plan.batchesPlanned>16)throw new Error('STOP_TOO_MANY_BATCHES');
 console.log(JSON.stringify({mode:execute?'EXPLICIT_SEQUENTIAL_EXECUTION':'DRY_RUN_ONLY',code,from,to,
  missingDays:plan.missingDays,batchesPlanned:plan.batchesPlanned,
  dates:plan.batches.map(b=>b.dates),perBatchMaxRequests:40,
  calendar:plan.calendar,productionWrites:false,notifications:false},null,2));
 if(!execute)process.exit(0);
 if(process.env.JQUANTS_RESEARCH_PROBE_ENABLED!=='true'||!process.env.JQUANTS_API_KEY)
 throw new Error('SECURE_ENV_NOT_READY');
 for(const batch of plan.batches){
  const dates=batch.dates.join(',');
  console.log('START_BATCH '+batch.batch+' '+dates);
  const out=run('scripts/research/jquants-minute-bounded-batch.mjs',
   ['--code='+code,'--dates='+dates,'--dir='+dir,'--execute']);
  console.log(out);
  const audit=JSON.parse(run('scripts/research/audit-minute-coverage.mjs',base));
  if(audit.quarantined.length)throw new Error('STOP_AUDIT_QUARANTINE: '+JSON.stringify(audit.quarantined));
  const verified=new Set(audit.records.map(r=>r.date));
  if(batch.dates.some(d=>!verified.has(d)))throw new Error('STOP_AUDIT_MISSING_BATCH: '+dates);
  console.log('BATCH_AUDIT_OK '+batch.batch+' reconciled='+audit.reconciledDays+
   ' post905MetricEligible='+audit.post905MetricEligibleDays);
 }
 console.log('ALL_BATCHES_COMPLETED_OFFLINE_RECONCILED_ONLY');
}catch(e){console.error('SEQUENTIAL_ACQUISITION_ABORT '+e.message);process.exitCode=1;}
