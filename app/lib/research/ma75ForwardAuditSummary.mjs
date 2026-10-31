/**
 * SHADOW ONLY. Summarize a single prospective frozen-cohort replay/settlement.
 * Does not make trading recommendations. These statistics are hypothetical.
 * A clean report is never sufficient for a production promotion.
 */
import {verifyMa75ForwardManifest, MA75_PREDECLARED_VARIANTS} from './ma75ForwardProtocol.mjs';
export const MA75_FORWARD_SUMMARY_VERSION='ma75_forward_summary_v1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=x=>Number(x.toFixed(3));
const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
const median=xs=>{
  if(!xs.length)return null;
  const sorted=[...xs].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return round(sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2);
};
const variants=MA75_PREDECLARED_VARIANTS.filter(name=>name!=='WAIT_FOR_RETEST_OR_CASH');
const ID=c=>c.code+':'+c.tradeDate;
export function summarizeMa75ForwardAudit(manifest,replay,settlement,{revisionAudit=null}={}){
 if(!verifyMa75ForwardManifest(manifest)||replay?.manifestSha256!==manifest.manifestSha256||
   settlement?.manifestSha256!==manifest.manifestSha256||
   !Array.isArray(replay?.candidates)||!Array.isArray(settlement?.results))
   throw new TypeError('Manifest, replay, and settlement must be from the same frozen cohort');
 const issues=[];
 const candidates=new Map();
 for(const c of replay.candidates){
   const id=ID(c);
   if(candidates.has(id))issues.push({id,reason:'DUPLICATE_SIGNAL'});
   else candidates.set(id,c);
   if(!manifest.codes.includes(c.code)||!c.variantMatches?.BREAKOUT_ALL)
     issues.push({id,reason:'INVALID_FROZEN_COHORT_OR_VARIANT'});
 }
 const settlementById=new Map();
 for(const r of settlement.results){
   if(settlementById.has(r?.id))issues.push({id:r.id,reason:'DUPLICATE_OUTCOME'});
   else settlementById.set(r?.id,r);
   if(!candidates.has(r?.id))issues.push({id:r.id,reason:'OUTCOME_NOT_IN_REPLAY'});
 }
 for(const id of candidates.keys())if(!settlementById.has(id))
   issues.push({id,reason:'MISSING_OUTCOME_ROW'});
 for(const r of settlement.results){
   if(r?.status==='COMPLETED'){
     if(!r.details||r.details.id!==r.id||!finite(r.details.return5Percent)||
       !finite(r.details.maxAdverse5Percent))
       issues.push({id:r.id,reason:'INVALID_COMPLETED_DETAILS'});
   }else if(typeof r?.status!=='string'||
        !(r.status.startsWith('PENDING_')||r.status.startsWith('QUARANTINED_'))||
        r.details!==null)
     issues.push({id:r?.id,reason:'INVALID_NONCOMPLETED_DETAILS'});
 }
 const counts={
   total:settlement.results.length,
   completed:settlement.results.filter(x=>x.status==='COMPLETED').length,
   pending:settlement.results.filter(x=>x.status.startsWith('PENDING_')).length,
   quarantined:settlement.results.filter(x=>x.status.startsWith('QUARANTINED_')).length,
 };
 if(settlement.totalCandidates!==counts.total||settlement.completed!==counts.completed||
   settlement.pending!==counts.pending||settlement.quarantined!==counts.quarantined)
   issues.push({id:'TOTAL',reason:'COUNTER_MISMATCH'});
 if(revisionAudit){
   if(revisionAudit.manifestSha256!==manifest.manifestSha256||revisionAudit.validTransition!==true)
     issues.push({id:'REVISION',reason:'REVISION_AUDIT_FAILED'});
 }
 const groups=variants.map(variant=>{
   const cohort=[...candidates.values()].filter(c=>c.variantMatches?.[variant]===true);
   const pairs=cohort.map(c=>settlementById.get(ID(c))).filter(Boolean);
   const complete=pairs.filter(x=>x.status==='COMPLETED'&&finite(x.details?.return5Percent));
   const returns=complete.map(x=>x.details.return5Percent);
   const budget=complete.filter(x=>x.details.budgetEligible);
   return {
     variant,signalCount:cohort.length,completed:complete.length,
     pending:pairs.filter(x=>x.status?.startsWith('PENDING_')).length,
     quarantined:pairs.filter(x=>x.status?.startsWith('QUARANTINED_')).length,
     hypotheticalMeanReturn5Percent:returns.length?round(mean(returns)):null,
     hypotheticalMedianReturn5Percent:median(returns),
     hypotheticalPositive5Percent:returns.length?round(100*returns.filter(x=>x>0).length/returns.length):null,
     hypotheticalWorst5Percent:returns.length?round(Math.min(...returns)):null,
     hypotheticalMeanMaxAdversePercent:complete.length?round(mean(complete.map(x=>x.details.maxAdverse5Percent))):null,
     budgetComplete:budget.length,
     prospectiveAccuracyValidated:false,
   };
 });
 return {
   version:MA75_FORWARD_SUMMARY_VERSION,manifestSha256:manifest.manifestSha256,
   totals:counts,issues,integrityPass:issues.length===0,
   groups,
   unsupportedVariants:[{variant:'WAIT_FOR_RETEST_OR_CASH',
     reason:'No independently archived all-opportunity retest/cash ledger; cannot infer policy performance from breakout-only outcomes.'}],
   validatedWinRate:null,independentlyVerifiedFutureSignals:0,eligibleForProduction:false,
   warnings:[
    'Hypothetical observations are not independently authenticated forward evidence.',
    'Same-code observations can overlap; group results are dependent, not valid independent win rate experiments.',
    'Cash/retest alternative needs all breakout opportunities including never-retouched candidates.',
    'Source rights, provider timestamps, split adjustments, official exchange calendar and fills remain external audit gates.',
   ],
 };
}
