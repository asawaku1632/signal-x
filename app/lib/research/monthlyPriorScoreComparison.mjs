/** Offline retrospective month/day-matched comparison using prior SAVED score. */
const valid=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const num=x=>typeof x==="number"&&Number.isFinite(x);
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
export function comparePriorSavedScoresByMonth(rows,{minPerGroup=10}={}){
 if(!Array.isArray(rows)||!Number.isInteger(minPerGroup)||minPerGroup<1)throw Error("INVALID_MONTH_COMPARISON");
 const groups=new Map(),seen=new Set(),excluded={invalid:0,duplicate:0,missingPrior:0,missingPrice:0};
 for(const r of rows){
  if(!r||!valid(r.date)||typeof r.code!=="string"||!/^(?:\d{4}|\d{3}[A-Z])$/.test(r.code)){excluded.invalid++;continue;}
  const key=r.date+"|"+r.code;if(seen.has(key)){excluded.duplicate++;continue;}seen.add(key);
  if(!num(r.priorScore)){excluded.missingPrior++;continue;}
  if(!num(r.price)||!num(r.nextPrice)||r.price<=0||r.nextPrice<=0){excluded.missingPrice++;continue;}
  const daily=groups.get(r.date)||{high:[],low:[]};
  daily[r.priorScore>=85?"high":"low"].push(100*(r.nextPrice/r.price-1));groups.set(r.date,daily);
 }
 const months=new Map();
 for(const [date,d] of groups){
  if(d.high.length<minPerGroup||d.low.length<minPerGroup)continue;
  const month=date.slice(0,7),diff=mean(d.high)-mean(d.low);
  if(!months.has(month))months.set(month,[]);
  months.get(month).push(diff);
 }
 return {version:"PRIOR_SAVED_SCORE_MONTH_DAY_MATCH_V1",
  monthly:[...months].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,gaps])=>({
   month,comparableDays:gaps.length,meanGapPp:Number(mean(gaps).toFixed(4)),
   highWonDays:gaps.filter(x=>x>0).length
  })),excluded,shadowOnly:true,predictiveValidation:false,
  warning:"Retrospective saved-price differences, not authenticated decision-time inputs; no trading claims."};
}
