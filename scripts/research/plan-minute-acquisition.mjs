#!/usr/bin/env node
/**
 * Offline-only bounded acquisition plan. Japanese exchange holidays are explicit
 * for 2026; this is a fixed research calendar, not a provider trading calendar.
 * Does NOT call the API, launch the batch, or change production state.
 */
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const args=process.argv.slice(2);
const get=n=>args.find(x=>x.startsWith('--'+n+'='))?.slice(n.length+3);
const code=get('code')??'3762',from=get('from'),to=get('to');
const dir=get('dir')??'minute-research-reports';
const batchSize=Number(get('batch-size')??'5');
const holidays=new Set([
 '2026-01-01','2026-01-02','2026-01-12','2026-02-11','2026-02-23',
 '2026-03-20','2026-04-29','2026-05-04','2026-05-05','2026-05-06',
 '2026-07-20','2026-08-11','2026-09-21','2026-09-22','2026-09-23',
 '2026-10-12','2026-11-03','2026-11-23','2026-12-31'
]);
const valid=d=>/^20\d{2}-\d{2}-\d{2}$/.test(d??'')&&
 !Number.isNaN(Date.parse(d+'T00:00:00Z'))&&
 new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
try{
 if(!/^[0-9]{3}[0-9A-Z]$/.test(code)||!valid(from)||!valid(to)||
  from>to||from<'2026-01-01'||to>'2026-12-31'||
  !Number.isInteger(batchSize)||batchSize<1||batchSize>5||
  !/^[a-zA-Z0-9_.-]+$/.test(dir)||dir==='.'||dir==='..'||
  args.some(a=>!/^--(code|from|to|dir|batch-size)=/.test(a)))
  throw new Error('USAGE: --code=3762 --from=2026-07-01 --to=2026-10-30 [--batch-size=5]');
 const dayCount=Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);
 const expected=[];
 for(let i=0;i<=dayCount;i++){
  const d=new Date(Date.parse(from+'T00:00:00Z')+i*86400000);
  const date=d.toISOString().slice(0,10);
  if(d.getUTCDay()!==0&&d.getUTCDay()!==6&&!holidays.has(date))expected.push(date);
 }
 const files=new Set(readdirSync(resolve(dir)));
 const verified=[],unverified=[];
 for(const date of expected){
  const name='research-'+code+'-'+date+'.json';
  if(!files.has(name))continue;
  try{
   const r=JSON.parse(readFileSync(resolve(dir,name),'utf8'));
   if(r.code===code&&r.date===date&&
    r.status==='HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH'&&
    r.dailyReconciliationMatched===true&&
    r.metricsReleasedForHistoricalResearch===true&&
    r.eligibleForProduction===false&&r.eligibleForNotifications===false&&
    r.post905?.code===code&&r.post905?.date===date&&
    Number.isFinite(r.post905?.upsideFromReferencePercent)&&
    Number.isFinite(r.post905?.downsideFromReferencePercent))verified.push(date);
   else unverified.push(date);
  }catch{unverified.push(date);}
 }
 const verifiedSet=new Set(verified),unverifiedSet=new Set(unverified);
 const missing=expected.filter(d=>!verifiedSet.has(d)&&!unverifiedSet.has(d));
 const batches=[];
 for(let i=0;i<missing.length;i+=batchSize)batches.push(missing.slice(i,i+batchSize));
 console.log(JSON.stringify({
  status:'OFFLINE_EXCHANGE_DAY_ACQUISITION_PLAN_ONLY',calendar:'2026_TSE_FIXED_HOLIDAY_LIST_NOT_INDEPENDENTLY_VERIFIED',
  code,from,to,expectedTradingDayCandidates:expected.length,
  reconciledExistingDays:verified.length,quarantinedExistingDays:unverified,
  missingDays:missing.length,batchesPlanned:batches.length,
  batches:batches.map((dates,i)=>({batch:i+1,dates,
   dryRunCommand:'node .\\scripts\\research\\jquants-minute-bounded-batch.mjs --code='+code+' --dates='+dates.join(',')})),
  warning:'Fixed holiday list must be independently cross-checked against official exchange calendar before API execution. No execute commands generated.',
  networkRequests:0,productionWrites:false,notifications:false,
  ma75Verified:false,eligibleForProduction:false,eligibleForNotifications:false
 },null,2));
}catch(e){console.error('PLAN_FAILED: '+e.message);process.exitCode=1;}
