/**
 * Compare an immutable BB five-trading-day observation against independently
 * supplied J-Quants V2 daily bars. Never changes source data or grants license.
 * Exact entry/exit price conventions must be independently reviewed.
 */
export function compareBbOutcomeWithJquantsBars(observation,bars,{tolerancePct=0.02}={}) {
 const blocked=(reason)=>({status:"BLOCKED",reason,priceBasisVerified:false,
  autoApply:false,productionWrites:false,productionApproval:false});
 if(!observation||observation.horizon!==5||observation.horizon_unit!=="TRADING_DAY"||
    observation.provider!=="YAHOO_CHART"||!Number.isFinite(observation.entry_price)||
    !Number.isFinite(observation.future_close)||observation.entry_price<=0||
    !Number.isFinite(observation.return_percent)||typeof observation.code!=="string"||
    !/^\d{4}-\d{2}-\d{2}$/.test(observation.observation_date??"")||
    !/^\d{4}-\d{2}-\d{2}$/.test(observation.evaluated_trade_date??""))
   return blocked("INVALID_BB_OBSERVATION");
 if(!Array.isArray(bars)||!Number.isFinite(tolerancePct)||tolerancePct<0)
   return blocked("INVALID_REFERENCE_BARS");
 const normalized=bars.map(b=>({code:String(b?.Code??""),date:b?.Date,
   close:b?.C,adjustedClose:b?.AdjC}));
 const sameCode=normalized.filter(b=>b.code===observation.code&&
   typeof b.date==="string"&&b.date>observation.observation_date&&
   b.date<=observation.evaluated_trade_date&&Number.isFinite(b.close));
 if(new Set(sameCode.map(b=>b.date)).size!==sameCode.length)
   return blocked("DUPLICATE_REFERENCE_DATE");
 sameCode.sort((a,b)=>a.date.localeCompare(b.date));
 if(sameCode.length!==5||sameCode[4]?.date!==observation.evaluated_trade_date)
   return blocked("FIVE_TRADING_DAYS_NOT_ESTABLISHED");
 const expected=sameCode[4].close;
 const calculated=(observation.future_close/observation.entry_price-1)*100;
 const diff=Math.abs(calculated-observation.return_percent);
 if(diff>tolerancePct) return blocked("STORED_RETURN_INCONSISTENT");
 const exitDiff=Math.abs(expected-observation.future_close);
 return {status:exitDiff<=0.01?"REFERENCE_CLOSE_MATCHES":"REFERENCE_CLOSE_DIFFERS",
  observationCode:observation.code,observationDate:observation.observation_date,
  evaluatedTradeDate:observation.evaluated_trade_date,
  yahooFutureClose:observation.future_close,jquantsUnadjustedClose:expected,
  absoluteCloseDifference:exitDiff,priceBasisVerified:false,
  licenseReview:"NOT_VERIFIED",autoApply:false,productionWrites:false,
  productionApproval:false,
  note:"Unadjusted closing-price comparison only. Entry basis, corporate actions, source provenance, and data licensing remain unverified; this is not an executable trade audit."};
}
