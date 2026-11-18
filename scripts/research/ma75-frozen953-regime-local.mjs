#!/usr/bin/env node
/**
 * Owner-local, ZERO NETWORK/WRITES. Reads existing J-Quants originals
 * in research-private. Fixed 953 app-observed codes are a market PROXY,
 * not the actual TOPIX or all exchange-listed securities.
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runMa75Frozen135Local} from './ma75-135-horizons-local.mjs';
import {runMa75NextSignalLocal} from './ma75-next-signal-local.mjs';
import {readMa75PrivateSavedDate,validateMa75SavedDailyForReplay}
 from './ma75-jquants-bulk-retrospective.mjs';
import {validateMa75FrozenUniverse}
 from '../../app/lib/research/ma75FrozenUniverse.mjs';
import {evaluateFrozen953RegimeComparison,summarizeFrozen953Regimes}
 from '../../app/lib/research/ma75Frozen953MarketRegime.mjs';
const OLD_SHA='1ba1aee5ac05b2c0fd114d3cabe5463bde4409b203544722cf03c04fc0a6612b';
const NEW_SHA='84bed698421ead22ebbce3fac0cb0aab08505332541acd1316957bb4151f3cab';
const studyDays=[
 {signalDate:'2026-11-02',
  asOfDates:['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-02'],
  outcomeDates:['2026-11-04','2026-11-05','2026-11-06','2026-11-09','2026-11-10'],
  expectedLockSha:OLD_SHA,expectedCount:27,expectedRising:22},
 {signalDate:'2026-11-11',
  asOfDates:['2026-11-04','2026-11-05','2026-11-06','2026-11-09','2026-11-10','2026-11-11'],
  outcomeDates:['2026-11-12','2026-11-13','2026-11-16','2026-11-17','2026-11-18'],
  expectedLockSha:NEW_SHA,expectedCount:25,expectedRising:16}
];
function sourceFile(date){
 return 'research-private/'+(date<='2026-10-30'?date:
  'ma75-forward-'+date)+'-jquants-daily.json';
}
export function runMa75FrozenRegimeLocal(args=[]){
 if(args.length)throw new TypeError('MA75_REGIME_NO_ARGUMENTS');
 const frozen=JSON.parse(readFileSync(
  new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url),'utf8'));
 validateMa75FrozenUniverse(frozen);
 if(frozen.populationSize!==953)throw new TypeError('MA75_REGIME_FROZEN_UNIVERSE_CHANGED');
 const byDate={};
 for(const d of new Set(studyDays.flatMap(x=>[...x.asOfDates,...x.outcomeDates]))){
  const source=readMa75PrivateSavedDate(sourceFile(d));
  if(!source)throw new TypeError('MA75_REGIME_OWNER_LOCAL_SOURCE_MISSING_'+d);
  byDate[d]=validateMa75SavedDailyForReplay(frozen,d,source);
 }
 const old=runMa75Frozen135Local();
 const second=runMa75NextSignalLocal(['--review']);
 const cohorts=[old,second];
 const evaluations=studyDays.map((s,i)=>evaluateFrozen953RegimeComparison({
  ...s,projectedByDate:Object.fromEntries([...s.asOfDates,...s.outcomeDates]
   .map(d=>[d,byDate[d]])),frozenCodes:frozen.codes,cohort:cohorts[i]
 }));
 return {version:'ma75_frozen_953_regime_two_date_shadow_v1',
  status:'SHADOW_NOT_APPROVED',
  proxyNotTopix:true,regimeRuleDeclaredAfterTheseTwoOutcomes:true,
  samples:evaluations,comparison:summarizeFrozen953Regimes(evaluations),
  separateSignalDates:2,marketRegimeEvidenceIndependentlyVerified:false,
  candidateResultsNotLiveFill:true,eligibleForTrading:false,
  eligibleForNotifications:false,eligibleForProduction:false,
  filesWritten:0,networkRequests:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{process.stdout.write(JSON.stringify(
  runMa75FrozenRegimeLocal(process.argv.slice(2)),null,2)+'\n')}
 catch(e){process.stderr.write((e?.message||'MA75_REGIME_READONLY_BLOCKED')+'\n');process.exitCode=1}
}
