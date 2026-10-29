/**
 * Prospective shadow ledger: fixed after 2026-10-29 JST.
 * Pure function. It never authenticates caller assertions, fetches quotes,
 * writes data, alerts users, or certifies a trading rule.
 */
const FREEZE="2026-10-29";
const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const instant=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const strictInstant=x=>{if(!instant(x))return false;const m=/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(Z|[+-](\d\d):(\d\d))$/.exec(x);return !!m&&date(m[1])&&Number(m[2])<24&&Number(m[3])<60&&Number(m[4])<60&&(!m[6]||(Number(m[6])<=23&&Number(m[7])<60));};
const mean=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
const rounded=x=>x===null?null:Number(x.toFixed(4));
export function auditProspectiveScoreLedger(rows){
 if(!Array.isArray(rows))throw Error("INVALID_PROSPECTIVE_LEDGER");
 const seen=new Set(),groups=new Map();
 // Quarantine every row of a duplicated stock/date group, regardless of input order.
 const keyCounts=new Map();
 for(const r of rows){if(r&&date(r.date)&&typeof r.code==="string"&&/^(?:\d{4}|\d{3}[A-Z])$/.test(r.code)&&r.date>FREEZE){
  const k=r.date+"|"+r.code;keyCounts.set(k,(keyCounts.get(k)??0)+1);
 }}
 const excluded={preFreeze:0,invalid:0,duplicate:0,featureNotAsOf:0,outcomeUnconfirmed:0,incompletePair:0};
 for(const r of rows){
  if(!r||!date(r.date)||typeof r.code!=="string"||!/^(?:\d{4}|\d{3}[A-Z])$/.test(r.code)||
    !finite(r.priorScore)||!finite(r.price)||r.price<=0){excluded.invalid++;continue;}
  if(r.date<=FREEZE){excluded.preFreeze++;continue;}
  const key=r.date+"|"+r.code;
  if(keyCounts.get(key)>1){if(seen.has(key))excluded.duplicate++;seen.add(key);continue;}
  if(seen.has(key)){excluded.duplicate++;continue;}seen.add(key);
  if(r.featureSnapshotVerified!==true||!strictInstant(r.featureAvailableAt)||Date.parse(r.featureAvailableAt)>=Date.parse(r.date+"T00:00:00+09:00")){
    excluded.featureNotAsOf++;continue;
  }
  if(!finite(r.nextPrice)||r.nextPrice<=0){excluded.incompletePair++;continue;}
  if(r.outcomeSourceVerified!==true||!date(r.outcomeTradeDate)||r.outcomeTradeDate<=r.date||
     !strictInstant(r.outcomeAvailableAt)||Date.parse(r.outcomeAvailableAt)<=Date.parse(r.date+"T23:59:59+09:00")||
     Date.parse(r.outcomeAvailableAt)<Date.parse(r.outcomeTradeDate+"T00:00:00+09:00")){
    excluded.outcomeUnconfirmed++;continue;
  }
  const bucket=groups.get(r.date)||{high:[],low:[]};
  bucket[r.priorScore>=85?"high":"low"].push(100*(r.nextPrice/r.price-1));
  groups.set(r.date,bucket);
 }
 const daily=[...groups].sort((a,b)=>a[0].localeCompare(b[0]))
  .map(([date,g])=>({date,highCount:g.high.length,lowCount:g.low.length,
    highMeanPct:rounded(mean(g.high)),lowMeanPct:rounded(mean(g.low)),
    gapPp:g.high.length&&g.low.length?rounded(mean(g.high)-mean(g.low)):null}));
 const comparable=daily.filter(d=>d.highCount>=10&&d.lowCount>=10);
 const gaps=comparable.map(d=>d.gapPp);
 const status=comparable.length>=20?"DESCRIPTIVE_SAMPLE_ACCUMULATED":"INSUFFICIENT_COMPARABLE_DATES";
 return {version:"PROSPECTIVE_SCORE_LEDGER_SHADOW_V1",freezeDate:FREEZE,scoreThreshold:85,
  totalInput:rows.length,eligibleRows:daily.reduce((n,d)=>n+d.highCount+d.lowCount,0),
  observedDays:daily.length,comparableDays:comparable.length,averageGapPp:rounded(mean(gaps)),
  highOutperformedDays:comparable.filter(d=>d.gapPp>0).length,
  status,daily,excluded,independentlyAuthenticatedByFunction:false,
  signalEnabled:false,readyForTrading:false,
  warning:"Caller verification flags are NOT source authentication. Sample accumulation is not proof of predictive accuracy, execution price or trading safety."};
}
