// Strict research-only promotion gate. Legacy capture timestamps are not independent signal evidence.
const time=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s)?Date.parse(s):NaN;
export function verifyMarketBreadthResearchPair(row, evidence){
 const fail=reason=>({eligible:false,reason,researchOnly:true,productionEligible:false});
 if(!row||!evidence||evidence.signalProvenanceVerified!==true||evidence.signalGeneratedAt!==row.signalGeneratedAt)
  return fail('SIGNAL_PROVENANCE_UNVERIFIED');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(row.tradeDate??'')||!/^\d{4}-\d{2}-\d{2}$/.test(row.outcomeDate??'')||row.outcomeDate<=row.tradeDate)
  return fail('TRADE_DATE_INVALID');
 const signal=time(row.signalGeneratedAt),market=time(row.marketObservedAt),evaluated=time(row.evaluatedAt);
 if(![signal,market,evaluated].every(Number.isFinite)||!(market<signal&&signal<evaluated))
  return fail('AS_OF_TIME_INVALID');
 if(evidence.marketStatusVerified!==true||evidence.marketStatus!==row.marketStatus||
    !['INDEX_BREADTH_DIVERGENCE','OBSERVED'].includes(row.marketStatus))
  return fail('MARKET_COHORT_UNVERIFIED');
 if(evidence.marketLicenseVerified!==true||evidence.outcomeLicenseVerified!==true||
    typeof evidence.marketProvider!=='string'||!evidence.marketProvider.trim()||
    typeof evidence.outcomeProvider!=='string'||!evidence.outcomeProvider.trim())
  return fail('PROVIDER_RIGHTS_UNVERIFIED');
 if(evidence.fiveTseSessionsVerified!==true||evidence.outcomePriceVerified!==true||
    evidence.outcomeDate!==row.outcomeDate||row.horizonTradingDays!==5||
    typeof row.return5dPct!=='number'||!Number.isFinite(row.return5dPct))
  return fail('FIVE_DAY_OUTCOME_UNVERIFIED');
 if(!/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(row.code??''))
  return fail('INVALID_SECURITY_CODE');
 return {eligible:true,researchOnly:true,productionEligible:false,
  ruleVersion:'market-breadth-pair-evidence-v1',tradeDate:row.tradeDate,code:row.code,
  signalGeneratedAt:row.signalGeneratedAt,marketObservedAt:row.marketObservedAt,
  evaluatedAt:row.evaluatedAt,return5dPct:row.return5dPct,
  marketProvider:evidence.marketProvider,outcomeProvider:evidence.outcomeProvider};
}
