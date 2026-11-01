#!/usr/bin/env node
/**
 * Opt-in bounded historical pilot runner. Runs the existing audited single-day
 * CLI as a child process; no credentials are printed or persisted by this file.
 * Defaults to planning only. No scheduling, production writes or notifications.
 */
import {existsSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);
const get=name=>args.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const execute=args.includes('--execute');
const code=get('code')??'3762';
const dates=(get('dates')??'').split(',').filter(Boolean);
const dir=get('dir')??'minute-research-reports';
const maxPages=Number(get('max-pages')??'4');
const allowed=new Set(['--execute','--code','--dates','--dir','--max-pages']);
try{
 if(args.some(a=>!Array.from(allowed).some(k=>a===k||a.startsWith(k+'=')))||
  !/^[0-9]{3}[0-9A-Z]$/.test(code)||
  dates.length<1||dates.length>5||new Set(dates).size!==dates.length||
  dates.some(d=>!/^20\d{2}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||
    new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d)||
  !Number.isInteger(maxPages)||maxPages<1||maxPages>4||
  !/^[a-zA-Z0-9_.-]+$/.test(dir)||dir==='.'||dir==='..')
   throw new Error('Usage: --code=3762 --dates=YYYY-MM-DD[,YYYY-MM-DD] --dir=minute-research-reports --max-pages=4 [--execute]; max 5 unique dates');
 const root=resolve(dir);
 const jobs=dates.map(date=>({date,file:join(root,'research-'+code+'-'+date+'.json')}));
 console.log(JSON.stringify({mode:execute?'EXPLICIT_BOUNDED_EXECUTION':'DRY_RUN_NO_API',
  code,dates,perDateMaxRequests:maxPages*2,totalMaxRequests:dates.length*maxPages*2,
  existingFilesSkipped:jobs.filter(j=>existsSync(j.file)).map(j=>j.date),
  newFilesPlanned:jobs.filter(j=>!existsSync(j.file)).map(j=>j.date),
  productionWrites:false,notifications:false},null,2));
 if(!execute)process.exit(0);
 if(process.env.JQUANTS_RESEARCH_PROBE_ENABLED!=='true'||!process.env.JQUANTS_API_KEY)
  throw new Error('SECURE_ENV_NOT_READY');
 mkdirSync(root,{recursive:true});
 for(const job of jobs){
  if(existsSync(job.file)){console.log('SKIP_EXISTING '+job.date);continue;}
  const command=[
   'scripts/research/jquants-minute-pilot.mjs','--code='+code,
   '--date='+job.date,'--max-pages='+maxPages,'--compare-daily',
   '--execute','--output='+job.file.replaceAll('\\','/')
  ];
  const result=spawnSync(process.execPath,command,{
   cwd:resolve('.'),env:process.env,encoding:'utf8',timeout:90000,
   maxBuffer:1024*1024,windowsHide:true
  });
  if(result.error||result.status!==0){
   console.error('STOP_FAILED_DATE '+job.date+' '+String(result.stderr??'').slice(0,200));
   process.exitCode=1;break;
  }
  console.log('SAVED_RECONCILED '+job.date);
 }
}catch(error){console.error('BATCH_ABORT '+error.message);process.exitCode=1;}
