/** Offline calendar-stratified score gap audit; no inferred market regime. */
export function auditProspectiveCalendarStrata(daily,options={}){
 const minDatesPerMonth=options.minDatesPerMonth??5;
 if(!Number.isInteger(minDatesPerMonth)||minDatesPerMonth<1)throw Error("INVALID_MONTH_SAMPLE_GATE");
 if(!Array.isArray(daily))throw Error("INVALID_CALENDAR_STRATA");
 const used=new Set(),groups=new Map();
 let excludedDates=0;
 const exclusionReasons={insufficientHigh:0,insufficientLow:0,invalidGap:0};
 for(const row of daily){
  if(!row||typeof row.date!=="string"||!/^\d{4}-\d\d-\d\d$/.test(row.date)||!Number.isFinite(Date.parse(row.date+"T00:00:00Z"))||
   new Date(row.date+"T00:00:00Z").toISOString().slice(0,10)!==row.date||used.has(row.date))throw Error("INVALID_OR_DUPLICATE_STRATA_DATE");
  used.add(row.date);
  if(!(Number.isInteger(row.highCount)&&row.highCount>=10&&Number.isInteger(row.lowCount)&&row.lowCount>=10&&Number.isFinite(row.gapPp))){
   excludedDates++;
   if(!Number.isInteger(row.highCount)||row.highCount<10)exclusionReasons.insufficientHigh++;
   if(!Number.isInteger(row.lowCount)||row.lowCount<10)exclusionReasons.insufficientLow++;
   if(!Number.isFinite(row.gapPp))exclusionReasons.invalidGap++;
   continue;
  }
  const month=row.date.slice(0,7),g=groups.get(month)??[];
  g.push(row.gapPp);groups.set(month,g);
 }
 const median=values=>{const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return Number((sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2).toFixed(4));};
 const months=[...groups].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,gaps])=>({
  month,dates:gaps.length,sufficientDates:gaps.length>=minDatesPerMonth,meanGapPp:Number((gaps.reduce((a,b)=>a+b,0)/gaps.length).toFixed(4)),medianGapPp:median(gaps),positiveDates:gaps.filter(x=>x>0).length,
  positiveDateShare:gaps.filter(x=>x>0).length/gaps.length,majorityPositive:gaps.filter(x=>x>0).length>gaps.length/2
 }));
 return {months,qualifyingMonths:months.length,minDatesPerMonth,receivedDates:daily.length,excludedDates,exclusionReasons,
  qualifyingDates:daily.length-excludedDates,
  medianPositiveSufficientMonths:months.filter(x=>x.sufficientDates&&x.medianGapPp>0).length,
  conflictingMeanMedianMonths:months.filter(x=>x.sufficientDates&&Math.sign(x.meanGapPp)!==Math.sign(x.medianGapPp)).length,
  sufficientlyObservedMonths:months.filter(x=>x.sufficientDates).length,
  positiveMeanMonths:months.filter(x=>x.meanGapPp>0).length,
  positiveSufficientMonths:months.filter(x=>x.sufficientDates&&x.meanGapPp>0).length,
  majorityPositiveSufficientMonths:months.filter(x=>x.sufficientDates&&x.majorityPositive).length,
  actualMarketRegimeKnown:false,readyForTraining:false,readyForTrading:false,
  warning:"Calendar months are not market regimes; benchmark returns and verified predecision market labels are required for regime claims."};
}
