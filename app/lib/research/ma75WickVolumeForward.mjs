import { auditMa75PriceHistory, auditMa75SourceAsOf, auditMa75AsOfInputs } from './ma75WickVolumeSafety.mjs';
/** Research-only frozen candidate. No scoring, trading or notifications. */
export const MA75_WICK_VOLUME_V1 = Object.freeze({
  upperWickMinimum: 0.35, volumeRatioMinimum: 1.5,
  volumeLookback: 20, shareLot: 100, budgetMinYen: 100000,
  budgetMaxYen: 500000, frictionPerSide: 0.001,
  holdSessions: 5, status: 'SHADOW_NOT_APPROVED'
});
const finitePositive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
/** Only information available at the completed signal-day close is used for selection. */
export function classifyMa75WickVolume({ bars, signalIndex, ma75Today, ma75Prior, provenance = null }) {
  const r = MA75_WICK_VOLUME_V1;
  if (!Array.isArray(bars) || !Number.isInteger(signalIndex) || signalIndex < 75 ||
      signalIndex >= bars.length || !finitePositive(ma75Today) || !finitePositive(ma75Prior))
    return { status: 'INVALID_INPUT', eligible: false };
  const b = bars[signalIndex], p = bars[signalIndex - 1];
  const recent = bars.slice(signalIndex - r.volumeLookback, signalIndex);
  const values = [b?.open,b?.high,b?.low,b?.close,b?.volume,p?.close,...recent.map(x=>x?.volume)];
  if (!values.every(finitePositive) || b.high < Math.max(b.open,b.close) ||
      b.low > Math.min(b.open,b.close) || b.high <= b.low)
    return { status: 'INVALID_OHLCV_OR_ZERO_RANGE', eligible: false };
  const safety = auditMa75PriceHistory(bars, signalIndex-74, signalIndex);
  if (safety !== 'PASS') return {status:safety,eligible:false};
  const ma75Audit = auditMa75AsOfInputs({bars,signalIndex,ma75Today,ma75Prior});
  if (!ma75Audit.verified) return {status:ma75Audit.status,eligible:false};
  if (provenance !== null) {
    const provenanceStatus = auditMa75SourceAsOf(provenance);
    if (provenanceStatus !== 'TIMING_PLAUSIBLE_NOT_AUTHENTICATED')
      return {status:provenanceStatus,eligible:false};
  }
  const volumeMean = recent.reduce((s,x)=>s+x.volume,0)/recent.length;
  const wick = (b.high-Math.max(b.open,b.close))/(b.high-b.low);
  if (!(volumeMean > 0)) return {status:'INVALID_VOLUME_BASELINE',eligible:false};
  const volumeRatio = b.volume/volumeMean;
  const breakout = b.close > ma75Today && p.close <= ma75Prior;
  return { status: 'SHADOW_ONLY', eligible: breakout && wick >= r.upperWickMinimum &&
    volumeRatio >= r.volumeRatioMinimum, breakout, upperWickRatio: wick,
    volumeRatio, selectionAsOf: b.time ?? null,
    provenanceStatus: provenance === null ? 'PROVENANCE_NOT_SUPPLIED' : 'TIMING_PLAUSIBLE_NOT_AUTHENTICATED' };
}
/** Future bars are used for outcome audit only, never candidate selection. */
export function auditMa75FillAndBudget({ bars, signalIndex }) {
  const r=MA75_WICK_VOLUME_V1;
  if (!Array.isArray(bars) || !Number.isInteger(signalIndex) || signalIndex < 0)
    return { status:'INVALID_INPUT' };
  const entry=bars[signalIndex+1], exit=bars[signalIndex+r.holdSessions];
  if (!entry || !exit) return { status:'PENDING' };
  const window=bars.slice(signalIndex+1,signalIndex+r.holdSessions+1);
  if (window.length !== r.holdSessions ||
      window.some(b=>![b?.open,b?.high,b?.low,b?.close].every(finitePositive) ||
        b.high < Math.max(b.open,b.close) || b.low > Math.min(b.open,b.close)))
    return { status:'INVALID_OHLCV' };
  const safety = auditMa75PriceHistory(bars, signalIndex, signalIndex+r.holdSessions);
  if (safety !== 'PASS') return {status:safety,fillVerified:false};
  const entryYen100=entry.open*(1+r.frictionPerSide)*r.shareLot;
  const minLots=Math.max(1,Math.ceil(r.budgetMinYen/entryYen100));
  const maxLots=Math.floor(r.budgetMaxYen/entryYen100);
  const budgetLotsAvailable=maxLots>=minLots;
  const fillUnverified=window.some(b=>b.high===b.low);
  const grossReturnPercent=(exit.close*(1-r.frictionPerSide)/
    (entry.open*(1+r.frictionPerSide))-1)*100;
  return { status:fillUnverified?'FILL_UNVERIFIED':'HYPOTHETICAL_ONLY',
    budgetEligible:budgetLotsAvailable, minLots:budgetLotsAvailable?minLots:null,
    maxLots:budgetLotsAvailable?maxLots:null,
    minShares:budgetLotsAvailable?minLots*r.shareLot:null,
    maxShares:budgetLotsAvailable?maxLots*r.shareLot:null,
    entryYen100, grossReturnPercent, fillVerified:false };
}
