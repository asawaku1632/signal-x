// Shadow-only reconciliation of event-date inventory with independently reviewed outcome receipts.
// The caller supplies receipts; this function does not establish their provenance.
import {auditMarketBreadthHistoricalCoverage} from './marketBreadthHistoricalCoverageAudit.mjs';
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function reconcileMarketBreadthEvidence({buckets=[],receipts=[]}={}){
 const coverage=auditMarketBreadthHistoricalCoverage({buckets});
 if(!Array.isArray(receipts)||receipts.length>100000)throw new TypeError('INVALID_OUTCOME_RECEIPTS');
 const known=new Map(coverage.accepted.map(x=>[x.source+':'+x.tradeDate,x]));
 const ids=new Set(),counts=new Map(),accepted=[],rejected=[];
 for(let index=0;index<receipts.length;index++){
  const r=receipts[index],key=r?.source+':'+r?.tradeDate;
  if(!r||!['BB','TECHNICAL'].includes(r.source)||!day(r.tradeDate)||typeof r.eventId!=='string'||!r.eventId.trim()||typeof r.outcomeId!=='string'||!r.outcomeId.trim()||r.eventId===r.outcomeId||r.horizonSessions!==5||r.originalSignalTimestampVerified!==true||r.outcomePriceIndependentlyVerified!==true||r.providerRightsVerified!==true){rejected.push({index,reason:'UNVERIFIED_RECEIPT'});continue}
  if(!known.has(key)){rejected.push({index,reason:'NO_EVENT_BUCKET'});continue}
  const id=r.source+':'+r.eventId,oid=r.source+':'+r.outcomeId;
  if(ids.has(id)||ids.has(oid)){rejected.push({index,reason:'DUPLICATE_EVIDENCE_ID'});continue}
  if((counts.get(key)??0)>=known.get(key).eventCount){rejected.push({index,reason:'EXCEEDS_EVENT_COUNT'});continue}
  ids.add(id);ids.add(oid);counts.set(key,(counts.get(key)??0)+1);accepted.push({index,source:r.source,tradeDate:r.tradeDate,eventId:r.eventId,outcomeId:r.outcomeId});
 }
 const dates=new Set(accepted.map(x=>x.tradeDate));
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  submittedReceipts:receipts.length,acceptedReceipts:accepted.length,rejectedReceipts:rejected.length,verifiedTradeDatesClaimed:dates.size,
  eventDateCoverage:coverage.counts.distinctEventDates,eligibleForExternalAudit:accepted.length>=30&&dates.size>=10,
  independentImprovementVerified:false,accepted,rejected,
  limitations:['RECEIPT_VERIFICATION_FLAGS_ARE_SELF_REPORTED','NO_CRYPTOGRAPHIC_OR_THIRD_PARTY_ATTESTATION','NO_CAUSAL_EFFECT_ESTIMATE','NO_PRODUCTION_PROMOTION']};
}
