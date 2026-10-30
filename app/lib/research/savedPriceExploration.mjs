/**
 * Descriptive-only saved-price research. Input may be historic SQL exports,
 * does NOT require trusted provenance and NEVER produces a live signal.
 * Raw prices are reference observations, not executable fill prices.
 */
const day=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const val=x=>(typeof x==="number"&&Number.isFinite(x))?x:(typeof x==="string"&&x.trim()!==""&&Number.isFinite(Number(x))?Number(x):null);
const round=x=>x===null?null:Number(x.toFixed(4));
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const median=xs=>{if(!xs.length)return null;const a=[...xs].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const std=xs=>{const m=avg(xs);return xs.length<2?null:Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1));};
const unique=rows=>new Set(rows.map(x=>x.code)).size;
const summarize=rs=>{const v=rs.map(x=>x.returnPct);
 return {observations:v.length,codes:unique(rs),dates:new Set(rs.map(x=>x.date)).size,
  meanReturnPct:round(avg(v)),medianReturnPct:round(median(v)),
  positiveRatePct:v.length?round(100*v.filter(x=>x>0).length/v.length):null,
  standardDeviationPct:round(std(v))};};
export function describeSavedPriceCohorts(rows,{cutoff="2026-09-02",minGroup=10,clip=5}={}){
 if(!Array.isArray(rows)||!day(cutoff)||!Number.isInteger(minGroup)||minGroup<1||
 !Number.isFinite(clip)||clip<=0)throw Error("INVALID_EXPLORATORY_OPTIONS");
 const excluded={invalid:0,duplicate:0,beforeCutoff:0,missingPrices:0,missingPriorScore:0};
 const seen=new Set(),accepted=[];
 for(const row of rows){
  if(!row||!day(row.date)||typeof row.code!=="string"||!/^(?:\d{4}|\d{3}[A-Z])$/.test(row.code)){
    excluded.invalid++;continue;
  }
  if(row.date<cutoff){excluded.beforeCutoff++;continue;}
  const k=row.date+"|"+row.code;
  if(seen.has(k)){excluded.duplicate++;continue;}
  seen.add(k);
  const p=val(row.price),n=val(row.nextPrice??row.next_price);
  if(p===null||n===null||p<=0||n<=0){excluded.missingPrices++;continue;}
  const s=val(row.priorScore??row.prior_score);
  if(s===null){excluded.missingPriorScore++;continue;}
  const ret=100*(n/p-1);
  if(!Number.isFinite(ret)){excluded.invalid++;continue;}
  accepted.push({date:row.date,code:row.code,priorScore:s,returnPct:ret});
 }
 const groups={high:accepted.filter(x=>x.priorScore>=85),low:accepted.filter(x=>x.priorScore<85)};
 const byDay=new Map();
 for(const x of accepted){
  if(!byDay.has(x.date))byDay.set(x.date,{high:[],low:[]});
  byDay.get(x.date)[x.priorScore>=85?"high":"low"].push(x.returnPct);
 }
 const days=[];
 for(const [date,x] of byDay){
  if(x.high.length<minGroup||x.low.length<minGroup)continue;
  const raw=avg(x.high)-avg(x.low),bound=v=>Math.max(-clip,Math.min(clip,v));
  const clipped=avg(x.high.map(bound))-avg(x.low.map(bound));
  const overall=avg([...x.high,...x.low]);
  days.push({date,highCount:x.high.length,lowCount:x.low.length,gap:raw,clippedGap:clipped,
   exPostRegime:overall>0.25?"UP":overall< -0.25?"DOWN":"FLAT"});
 }
 days.sort((a,b)=>a.date.localeCompare(b.date));
 const byRegime=Object.fromEntries(["UP","FLAT","DOWN"].map(k=>{
  const d=days.filter(x=>x.exPostRegime===k);
  return [k,{days:d.length,meanGapPp:round(avg(d.map(x=>x.gap))),highWonDays:d.filter(x=>x.gap>0).length}];
 }));
 const trimmed=[...days].sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap)).slice(Math.min(3,days.length));
 const codeCounts=new Map();for(const x of groups.high)codeCounts.set(x.code,(codeCounts.get(x.code)||0)+1);
 const topCodes=[...codeCounts].map(([code,n])=>({code,n})).sort((a,b)=>b.n-a.n||a.code.localeCompare(b.code)).slice(0,10);
 return {version:"SAVED_PRICE_EXPLORATORY_V1",scope:"RETROSPECTIVE_DESCRIPTIVE_ONLY",
  rowsInput:rows.length,rowsAccepted:accepted.length,excluded,
  cohorts:{high:summarize(groups.high),low:summarize(groups.low)},
  comparableDates:days.length,equalDayMeanGapPp:round(avg(days.map(x=>x.gap))),
  equalDayMedianGapPp:round(median(days.map(x=>x.gap))),
  clippedGapPp:round(avg(days.map(x=>x.clippedGap))),
  dropTop3AbsoluteDayGapsPp:round(avg(trimmed.map(x=>x.gap))),
  highWonDates:days.filter(x=>x.gap>0).length,regimes:byRegime,
  highTop10ObservationCount:topCodes.reduce((a,b)=>a+b.n,0),
  independentProvenanceVerified:false,signalEligible:false,shadowOnly:true,
  warning:"Historical saved prices and scores are not authenticated decision-time features or fills. Ex-post regime is NOT predictable. No use for trade decisions or notifications."};
}
