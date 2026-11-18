/**
 * Posthoc, read-only MA75 Nov11 path attribution. Not a new exit policy.
 * Each horizon uses the same modeled Nov12 OPEN entry; differences of net
 * returns are not standalone interim trading returns.
 */
const fail=s=>{throw new TypeError('MA75_PATH_AUDIT_'+s)};
const round=x=>Number(x.toFixed(4));
const mean=xs=>round(xs.reduce((a,b)=>a+b,0)/xs.length);
const horizons=[1,3,5];
const names=['session1','session3','session5'];
const patterns=['+++','++-','+-+','+--','-++','-+-','--+','---'];
const valid=x=>typeof x==='number'&&Number.isFinite(x);

function summarize(rows){
 const paths=Object.fromEntries(patterns.map(s=>[s,0]));
 for(const r of rows)paths[[r.ret1,r.ret3,r.ret5].map(x=>x>0?'+':'-').join('')]++;
 return {
  count:rows.length,
  meanNetPercent1:mean(rows.map(r=>r.ret1)),
  meanNetPercent3:mean(rows.map(r=>r.ret3)),
  meanNetPercent5:mean(rows.map(r=>r.ret5)),
  meanChange1to3Points:mean(rows.map(r=>r.change1to3)),
  meanChange3to5Points:mean(rows.map(r=>r.change3to5)),
  positiveCount1:rows.filter(r=>r.ret1>0).length,
  positiveCount3:rows.filter(r=>r.ret3>0).length,
  positiveCount5:rows.filter(r=>r.ret5>0).length,
  positive1ToNonpositive3:rows.filter(r=>r.ret1>0&&r.ret3<=0).length,
  positive3ToNonpositive5:rows.filter(r=>r.ret3>0&&r.ret5<=0).length,
  positive1ToNonpositive5:rows.filter(r=>r.ret1>0&&r.ret5<=0).length,
  positive1AndPositive5:rows.filter(r=>r.ret1>0&&r.ret5>0).length,
  nonpositive1ToPositive5:rows.filter(r=>r.ret1<=0&&r.ret5>0).length,
  paths,
  largest3to5Deteriorations:[...rows]
   .sort((a,b)=>a.change3to5-b.change3to5||a.code.localeCompare(b.code))
   .slice(0,5).map(({code,change3to5,ret3,ret5})=>
    ({code,change3to5,ret3,ret5}))
 };
}
export function auditMa75ProspectivePath(review,{expectedLockSha256,expectedSize}={}){
 if(review?.status!=='SHADOW_NOT_APPROVED'||
    review.signalDate!=='2026-11-11'||
    review.eligibleForTrading!==false||
    review.eligibleForProduction!==false||
    review.eligibleForNotifications!==false||
    !Array.isArray(review.perFrozenCodeHorizon))
  fail('INVALID_SHADOW_REVIEW');
 if(expectedLockSha256&&review.ownerLocalLockSha256!==expectedLockSha256)
  fail('FROZEN_LOCK_SHA_MISMATCH');
 const n=review.originalBreakouts;
 if(!Number.isInteger(n)||n<1||n>953||
    (expectedSize!==undefined&&n!==expectedSize)||
    review.originalRisingBreakouts+review.originalNonRisingBreakouts!==n)
  fail('FROZEN_GROUP_COUNTS_CHANGED');
 for(const name of names){
  const b=review.horizons?.[name],g=b?.groups?.allBreakouts;
  if(b?.allRequiredOriginalDaysPresent!==true||
     g?.frozenGroupCount!==n||g?.measured!==n||
     g?.pending!==0||g?.quarantined!==0)
   fail('INCOMPLETE_OR_QUARANTINED_'+name.toUpperCase());
 }
 const map=new Map();
 for(const row of review.perFrozenCodeHorizon){
  if(!/^\d{3}[\dA-Z]$/.test(row?.code??'')||
     !horizons.includes(row.horizonSessions)||
     !Number.isInteger(row.horizonSessions)||
     row.status!=='HYPOTHETICAL_OUTCOME_ONLY'||
     !valid(row.netReturnPercent)||
     typeof row.risingMA75!=='boolean'||
     typeof row.budgetEligible!=='boolean')
   fail('INVALID_PER_CODE_ROW');
  const byH=map.get(row.code)||new Map();
  if(byH.has(row.horizonSessions))fail('DUPLICATE_CODE_HORIZON');
  byH.set(row.horizonSessions,row);map.set(row.code,byH);
 }
 if(map.size!==n||review.perFrozenCodeHorizon.length!==3*n)
  fail('ORIGINAL_MEMBERSHIP_NOT_COMPLETE');
 const details=[];
 for(const [code,byH] of map){
  if(byH.size!==3||horizons.some(x=>!byH.has(x)))
   fail('MISSING_HORIZON');
  const a=byH.get(1),b=byH.get(3),c=byH.get(5);
  if(b.risingMA75!==a.risingMA75||c.risingMA75!==a.risingMA75||
     b.budgetEligible!==a.budgetEligible||
     c.budgetEligible!==a.budgetEligible)
   fail('MEMBERSHIP_DRIFT');
  details.push({code,risingMA75:a.risingMA75,
   budgetEligible:a.budgetEligible,
   ret1:a.netReturnPercent,ret3:b.netReturnPercent,
   ret5:c.netReturnPercent,
   change1to3:round(b.netReturnPercent-a.netReturnPercent),
   change3to5:round(c.netReturnPercent-b.netReturnPercent),
   change1to5:round(c.netReturnPercent-a.netReturnPercent),
   oneDayWinnerFiveDayNonpositive:a.netReturnPercent>0&&
     c.netReturnPercent<=0});
 }
 details.sort((a,b)=>a.code.localeCompare(b.code));
 const rise=details.filter(x=>x.risingMA75);
 const non=details.filter(x=>!x.risingMA75);
 if(rise.length!==review.originalRisingBreakouts||
    non.length!==review.originalNonRisingBreakouts)
  fail('RISING_MEMBERSHIP_MISMATCH');
 return {
  version:'ma75_nov11_posthoc_path_attribution_v1',
  status:'SHADOW_NOT_APPROVED',signalDate:review.signalDate,
  lockSha256:review.ownerLocalLockSha256,
  entrySession:'2026-11-12',
  horizonExitSessions:names.map(x=>review.horizons[x].exitSession),
  groups:{all:summarize(details),rising:summarize(rise),
   nonRising:summarize(non)},
  perCode:details,
  caveat:'Posthoc descriptive analysis, not a preregistered exit policy. Differences of cumulative net returns from one common modeled entry are not separately executable interval returns.',
  eligibleForTrading:false,eligibleForNotifications:false,
  eligibleForProduction:false,networkRequests:0,filesWritten:0
 };
}
