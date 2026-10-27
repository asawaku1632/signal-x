/**
 * Offline risk diagnostics for an explicitly supplied, chronological,
 * non-overlapping hypothetical trade-return series. No trade execution.
 * A forward-return cross-section must not be passed as a portfolio equity curve.
 */
export function assessForwardExperimentRisk(trades,{
  roundTripCostPct=0.3,maxAllowedDrawdownPct=10,minTrades=30,
}={}) {
  if(!Array.isArray(trades)) throw new TypeError("trades must be an array");
  const reasons=[];
  if(!Number.isFinite(roundTripCostPct)||roundTripCostPct<0) reasons.push("INVALID_COST");
  if(!Number.isFinite(maxAllowedDrawdownPct)||maxAllowedDrawdownPct<=0) reasons.push("INVALID_DRAWDOWN_LIMIT");
  if(!Number.isInteger(minTrades)||minTrades<2) reasons.push("INVALID_MIN_TRADES");
  let equity=1,peak=1,maxDrawdownPct=0,netTotal=0,wins=0,prevEnd=null;
  const seen=new Set();
  for(const trade of trades) {
    if(!trade||typeof trade.id!=="string"||!trade.id.trim()||seen.has(trade.id)||
       typeof trade.startDate!=="string"||typeof trade.endDate!=="string"||
       !/^\d{4}-\d{2}-\d{2}$/.test(trade.startDate)||
       !/^\d{4}-\d{2}-\d{2}$/.test(trade.endDate)||
       trade.endDate<trade.startDate||!Number.isFinite(trade.grossReturnPct)||
       trade.grossReturnPct<=-100||trade.verified!==true) {
      reasons.push("INVALID_OR_UNVERIFIED_TRADE");continue;
    }
    seen.add(trade.id);
    if(prevEnd!==null&&trade.startDate<=prevEnd) reasons.push("OVERLAPPING_OR_UNSORTED_TRADES");
    prevEnd=trade.endDate;
    const net=trade.grossReturnPct-roundTripCostPct;
    if(net<=-100) {reasons.push("NON_POSITIVE_EQUITY_FACTOR");continue;}
    netTotal+=net;
    if(net>0) wins++;
    equity*=1+net/100;
    peak=Math.max(peak,equity);
    maxDrawdownPct=Math.max(maxDrawdownPct,(peak-equity)/peak*100);
  }
  if(trades.length<minTrades) reasons.push("INSUFFICIENT_TRADES");
  if(maxDrawdownPct>maxAllowedDrawdownPct) reasons.push("DRAWDOWN_LIMIT_EXCEEDED");
  return {status:reasons.length?"RISK_REVIEW_BLOCKED":"DESCRIPTIVE_RISK_ONLY",
    reasons:[...new Set(reasons)],tradeCount:trades.length,
    averageNetReturnPct:reasons.length?null:netTotal/trades.length,
    netWinRate:reasons.length?null:wins/trades.length,
    compoundedNetReturnPct:reasons.length?null:(equity-1)*100,
    maxDrawdownPct:reasons.length?null:maxDrawdownPct,
    costAssumptionPct:roundTripCostPct,
    improvementProven:false,autoApply:false,productionApproval:false,
    note:"Requires chronological non-overlapping verified hypothetical trades; excludes intratrade drawdown, position sizing, taxes, liquidity, and actual slippage.",
  };
}
