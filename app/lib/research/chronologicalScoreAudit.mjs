/** Frozen calendar-boundary comparison. NO optimization or production calls. */
const isDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const FIXED=Object.freeze({threshold:85,split:"2026-09-02",minGroup:10});
export function auditChronologicalScoreSplit(rows,{freeze=FIXED}={}){
 if(!Array.isArray(rows)||!freeze||freeze.threshold!==85||freeze.split!=="2026-09-02"||freeze.minGroup!==10)throw Error("NON_FROZEN_EVALUATION");
 const seen=new Set(),days=new Map(),excluded={invalid:0,duplicate:0,unverifiedPrior:0,unverifiedOutcome:0};
 for(const r of rows){
  if(!r||!isDate(r.date)||typeof r.code!=="string"||!/^(?:\d{4}|\d{3}[A-Z])$/.test(r.code)||!Number.isFinite(r.priorScore)||!Number.isFinite(r.price)||r.price<=0||!Number.isFinite(r.nextPrice)||r.nextPrice<=0){excluded.invalid++;continue;}
  const key=r.date+"|"+r.code;
  if(seen.has(key)){excluded.duplicate++;continue;}seen.add(key);
  if(r.priorProvenanceIndependentlyVerified!==true||!isDate(r.priorDate)||r.priorDate>=r.date){excluded.unverifiedPrior++;continue;}
  if(r.outcomeProvenanceIndependentlyVerified!==true||!isDate(r.outcomeDate)||r.outcomeDate<=r.date){excluded.unverifiedOutcome++;continue;}
  const ret=100*(r.nextPrice/r.price-1);
  const d=days.get(r.date)||{high:[],low:[]};d[r.priorScore>=85?"high":"low"].push(ret);days.set(r.date,d);
 }
 const halves={before:[],after:[]};let comparable=0;
 for(const [date,d] of days){if(d.high.length<10||d.low.length<10)continue;
  const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
  halves[date<FIXED.split?"before":"after"].push(avg(d.high)-avg(d.low));comparable++;
 }
 const info=a=>({days:a.length,meanGapPp:a.length?Number((a.reduce((s,x)=>s+x,0)/a.length).toFixed(4)):null,highWonDays:a.filter(x=>x>0).length});
 const earlier=info(halves.before),later=info(halves.after);
 return {version:"CHRONOLOGICAL_PRIOR_SCORE_AUDIT_V1",freeze:FIXED,earlier,later,comparableDates:comparable,excluded,
  independentVerificationByThisFunction:false,prospectiveValidation:false,readyForSignals:false,
  warning:"Frozen post-hoc chronological descriptive comparison only; caller truth flags cannot be authenticated by this offline function. No pretrade inference."};
}
