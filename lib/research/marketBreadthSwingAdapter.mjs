// Research-only adapter. External verifier must independently check source and TSE sessions.
export function adaptSwingUniverseFiveDay(rows,verify){
 if(typeof verify!=='function')throw Error('INDEPENDENT_VERIFIER_REQUIRED');
 const accepted=[],rejected=[];
 for(const row of Array.isArray(rows)?rows:[]){
  const tradeDate=String(row?.trade_date??''),code=String(row?.code??''),generatedAt=row?.captured_at,
   outcomeDate=row?.outcome_5d_date,result=Number(row?.return_5d),signalTime=Date.parse(generatedAt??'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)||!/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(code)||
   !(typeof row?.return_5d==='number'||typeof row?.return_5d==='string'&&row.return_5d.trim()!=='' )||
   !Number.isFinite(result)||!Number.isFinite(signalTime)||!/^\d{4}-\d{2}-\d{2}$/.test(outcomeDate??'')||
   outcomeDate<=tradeDate||row?.rule_version!=='ai_power_only_v1'){
   rejected.push({tradeDate,code,reason:'INVALID_OR_UNSUPPORTED_ROW'});continue;
  }
  const v=verify({tradeDate,code,generatedAt,outcomeDate,ruleVersion:row.rule_version});
  if(v?.verified!==true||v?.exactlyFiveTseSessions!==true||v?.licensedPriceSource!==true||
   !v?.evaluatedAt||!(Date.parse(v.evaluatedAt)>signalTime)){
   rejected.push({tradeDate,code,reason:'UNVERIFIED_FIVE_DAY_OUTCOME'});continue;
  }
  accepted.push({tradeDate,code,signalGeneratedAt:generatedAt,evaluatedAt:v.evaluatedAt,
   return5dPct:result,horizonTradingDays:5,outcomeVerified:true});
 }
 return {accepted,rejected,source:'swing_universe_observations',researchOnly:true};
}
