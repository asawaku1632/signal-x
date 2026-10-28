// Read-only adapter for public.market_index_research_runs.
// An index level alone is NOT a daily percent change or a breadth snapshot.
export function auditMarketIndexResearchRows(rows) {
  const counts={total:0,usableForBreadth:0,providerApprovalRequired:0,
    unavailable:0,missingObservation:0};
  const byIndex={nikkei:0,topix:0};
  for(const row of Array.isArray(rows)?rows:[]) {
    counts.total++;
    if(row?.index_key==='nikkei'||row?.index_key==='topix')byIndex[row.index_key]++;
    if(row?.reason==='PROVIDER_APPROVAL_REQUIRED')counts.providerApprovalRequired++;
    if(row?.status!=='observed')counts.unavailable++;
    if(row?.observed_at==null||row?.value==null)counts.missingObservation++;
    // This table has no advance/decline/unchanged fields and cannot independently
    // satisfy the market-breadth classifier's contract, even for observed rows.
  }
  return {researchOnly:true,counts,byIndex,classification:'UNAVAILABLE',
    reason:'INDEX_LEVELS_ARE_NOT_MARKET_BREADTH'};
}
