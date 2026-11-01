#!/usr/bin/env node
/** Offline forward evaluation. No broker, DB, network, orders or alerts. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const DAY=/^20\d{2}-\d{2}-\d{2}$/;
const CODE=/^[0-9]{3}[0-9A-Z]$/;
const ISO=/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
function dateOK(d){if(typeof d!=='string'||!DAY.test(d))return false;const ms=Date.parse(d+'T00:00:00Z');return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===d;}
function instant(t){return typeof t==='string'&&ISO.test(t)&&Number.isFinite(Date.parse(t))?Date.parse(t):null;}
const finitePositive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const round=n=>Math.round(n*10000)/10000;
export function evaluateForward(rows,{cutoffDate,feeBps=0,slippageBps=0,minTrain=20,minTest=20}={}){
 if(!Array.isArray(rows)||rows.length===0||rows.length>100000)throw Error('INVALID_ROWS');
 if(!dateOK(cutoffDate)||!Number.isInteger(minTrain)||minTrain<1||!Number.isInteger(minTest)||minTest<1||
 !Number.isFinite(feeBps)||feeBps<0||feeBps>1000||!Number.isFinite(slippageBps)||slippageBps<0||slippageBps>1000)throw Error('INVALID_CONFIG');
 const seen=new Set(),accepted=[],rejected={};
 for(const r of rows){
  if(!r||typeof r!=='object'||Array.isArray(r))throw Error('INVALID_ROW');
  const key=r.code+'|'+r.date+'|'+r.strategy;
  if(seen.has(key))throw Error('DUPLICATE_SCOPE');
  seen.add(key);
  let reason;
  const date=dateOK(r.date),bar=instant(r.lastInputBarEndAt),received=instant(r.receivedAt),decision=instant(r.decisionAt),entry=instant(r.entryAt),exit=instant(r.exitAt);
  const nine=date?instant(r.date+'T09:05:00+09:00'):null;
  if(!CODE.test(r.code??'')||!date||typeof r.strategy!=='string'||!/^[a-zA-Z0-9_-]{1,48}$/.test(r.strategy))reason='INVALID_SCOPE';
  else if(r.independentCapture!==true||r.sourceVerified!==true||r.lookaheadFreeVerified!==true)reason='UNVERIFIED_ASOF_EVIDENCE';
  else if([bar,received,decision,entry,exit].some(x=>x===null)||!(bar<=received&&received<=decision&&decision<=nine&&nine<=entry&&entry<exit))reason='INVALID_TIMELINE';
  else if(!finitePositive(r.entryPrice)||!finitePositive(r.exitPrice)||r.fillVerified!==true)reason='UNVERIFIED_FILL';
  else if(!Number.isInteger(r.holdingTradingDays)||r.holdingTradingDays<1||r.holdingTradingDays>5||new Date(exit).toISOString().slice(0,10)<=r.date)reason='INVALID_HOLDING_PERIOD';
  else if(r.outcomeComplete!==true||r.outcomeKnownAtDecision===true)reason='OUTCOME_UNVERIFIED';
  if(reason){rejected[reason]=(rejected[reason]??0)+1;continue;}
  const gross=(r.exitPrice/r.entryPrice-1)*100;
  const net=gross-(2*feeBps+2*slippageBps)/100;
  accepted.push({code:r.code,date:r.date,strategy:r.strategy,net:round(net),gross:round(gross),split:r.date<=cutoffDate?'TRAIN':'TEST'});
 }
 const aggregate=items=>({n:items.length,uniqueDates:new Set(items.map(x=>x.date)).size,uniqueCodes:new Set(items.map(x=>x.code)).size,meanNetPercent:items.length?round(items.reduce((a,b)=>a+b.net,0)/items.length):null,positiveRatePercent:items.length?round(100*items.filter(x=>x.net>0).length/items.length):null});
 const train=aggregate(accepted.filter(x=>x.split==='TRAIN')),test=aggregate(accepted.filter(x=>x.split==='TEST'));
 const sufficientlySampled=train.n>=minTrain&&test.n>=minTest&&train.uniqueDates>=5&&test.uniqueDates>=5;
 return {version:'post905_forward_evaluation_v1',cutoffDate,feeBps,slippageBps,minTrain,minTest,submitted:rows.length,accepted:accepted.length,rejected,
  train,test,splitChronological:true,independentEvidenceRequired:true,
  sufficientlySampled,descriptiveOnly:true,verifiedTradingEdge:false,eligibleForNotifications:false,eligibleForProduction:false,
  limitations:['Evidence flags are assertions in supplied records, not independently authenticated by this offline tool','Prices and fills must come from independently verified execution evidence','A single fixed cutoff does not establish robust forward performance','Even positive net returns cannot authorize production automatically']};
}
export function main(argv=process.argv.slice(2)){
 const opts={};
 for(const a of argv){const i=a.indexOf('=');if(i<0)throw Error('INVALID_ARGUMENTS');const k=a.slice(0,i),v=a.slice(i+1);if(!['--input','--output','--cutoff-date','--fee-bps','--slippage-bps'].includes(k)||!v||k in opts)throw Error('INVALID_ARGUMENTS');opts[k]=v;}
 if(!opts['--input']||!opts['--output']||!opts['--cutoff-date']||resolve(opts['--input'])===resolve(opts['--output']))throw Error('INVALID_ARGUMENTS');
 const rows=JSON.parse(readFileSync(opts['--input'],'utf8'));
 const result=evaluateForward(rows,{cutoffDate:opts['--cutoff-date'],feeBps:Number(opts['--fee-bps']??0),slippageBps:Number(opts['--slippage-bps']??0)});
 writeFileSync(opts['--output'],JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 return {status:'OFFLINE_FORWARD_EVALUATION_CREATED',accepted:result.accepted,train:result.train.n,test:result.test.n,output:opts['--output'],eligibleForProduction:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(main()));}catch(e){console.error('FORWARD_EVALUATION_FAILED:',e?.code==='EEXIST'?'OUTPUT_EXISTS':e.message);process.exitCode=1;}}
