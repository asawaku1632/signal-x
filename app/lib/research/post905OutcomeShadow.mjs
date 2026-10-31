/**
 * Research-only forward-window outcome measurement for already validated
 * J-Quants minute bars. Never a live 09:05 quote or executable trade signal.
 * A bar's Time denotes its START minute (JST).
 */
const minute = time => {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [h,m]=time.split(':').map(Number);
  return h*60+m;
};
const pct=(a,b)=>Number(((b/a-1)*100).toFixed(5));
export function measurePost905Outcomes(rows,{code,date}={}) {
  if(!Array.isArray(rows)||!/^20\d{2}-\d{2}-\d{2}$/.test(date??'')||
     !/^[0-9]{3}[0-9A-Z]$/.test(code??'')) throw new TypeError('INVALID_RESEARCH_SCOPE');
  const seen=new Set();
  const bars=[];
  for(const r of rows){
    const m=minute(r?.Time);
    if(r?.Date!==date || ![code,code+'0'].includes(r?.Code) ||
       m===null || !((m>=540&&m<=690)||(m>=750&&m<=924)||m===930) ||
       seen.has(m) || ![r.O,r.H,r.L,r.C].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0) ||
       r.H<Math.max(r.O,r.C,r.L) || r.L>Math.min(r.O,r.C,r.H))
      throw new TypeError('INVALID_OR_DUPLICATE_MINUTE_BAR');
    seen.add(m);bars.push({minute:m,time:r.Time,open:r.O,high:r.H,low:r.L,close:r.C});
  }
  bars.sort((a,b)=>a.minute-b.minute);
  const before=bars.filter(b=>b.minute>=540&&b.minute<545);
  const after=bars.filter(b=>b.minute>=545&&b.minute<600);
  // This is a historical reference close, NOT a verified 09:05 execution price.
  const reference=before.length?before.at(-1).close:null;
  const maxHigh=after.length?Math.max(...after.map(b=>b.high)):null;
  const minLow=after.length?Math.min(...after.map(b=>b.low)):null;
  const reached=threshold=>reference===null?null:
    (after.find(b=>b.high/reference-1>=threshold/100-1e-10)?.time??null);
  return {
    version:'post905_outcome_shadow_v1',code,date,
    asOf905ReferenceClose:reference,referenceIsExecutable:false,
    pre905BarCount:before.length,post905MorningBarCount:after.length,
    post905HighestHigh:maxHigh,post905LowestLow:minLow,
    upsideFromReferencePercent:reference&&maxHigh!==null?pct(reference,maxHigh):null,
    downsideFromReferencePercent:reference&&minLow!==null?pct(reference,minLow):null,
    firstPost905OnePctHighAt:reached(1),
    firstPost905TwoPctHighAt:reached(2),
    minuteHighLowOrderUnknown:true,
    actual905AvailabilityVerified:false,
    transactionCostsIncluded:false,slippageIncluded:false,
    hindsightOnly:true,eligibleForNotifications:false,eligibleForProduction:false
  };
}
