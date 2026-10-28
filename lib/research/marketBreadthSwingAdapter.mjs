// Pure adapter for existing public.swing_universe_observations rows.
// Caller must independently verify provider provenance and five TSE sessions.
export function adaptSwingUniverseFiveDay(rows, verify) {
  if(typeof verify !== 'function') throw Error('INDEPENDENT_VERIFIER_REQUIRED');
  const accepted=[], rejected=[];
  for(const row of Array.isArray(rows)?rows:[]) {
    const tradeDate=String(row?.trade_date??'');
    const code=String(row?.code??'');
    const generatedAt=row?.captured_at;
    const outcomeDate=row?.outcome_5d_date;
    const result=Number(row?.return_5d);
    const signalTime=Date.parse(generatedAt??'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate) ||
       !/^[0-9]{4}[A-Z]?$/.test(code) ||
       typeof row?.return_5d !== 'number' && typeof row?.return_5d !== 'string' ||
       !Number.isFinite(result) || !Number.isFinite(signalTime) ||
       !/^\d{4}-\d{2}-\d{2}$/.test(outcomeDate??'') ||
       outcomeDate<=tradeDate || row?.rule_version!=='ai_power_only_v1') {
      rejected.push({tradeDate,code,reason:'INVALID_OR_UNSUPPORTED_ROW'});continue;
    }
    const verification=verify({tradeDate,code,generatedAt,outcomeDate,ruleVersion:row.rule_version});
    if(verification?.verified!==true || verification?.exactlyFiveTseSessions!==true ||
       verification?.licensedPriceSource!==true || !verification?.evaluatedAt ||
       !(Date.parse(verification.evaluatedAt)>signalTime)) {
      rejected.push({tradeDate,code,reason:'UNVERIFIED_FIVE_DAY_OUTCOME'});continue;
    }
    accepted.push({tradeDate,code,signalGeneratedAt:generatedAt,
      evaluatedAt:verification.evaluatedAt,return5dPct:result,
      horizonTradingDays:5,outcomeVerified:true});
  }
  return {accepted,rejected,source:'swing_universe_observations',researchOnly:true};
}
