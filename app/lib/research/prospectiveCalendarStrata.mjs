/** Offline calendar-stratified score gap audit; no inferred market regime. */
export function auditProspectiveCalendarStrata(daily){
 if(!Array.isArray(daily))throw Error("INVALID_CALENDAR_STRATA");
 const used=new Set(),groups=new Map();
 for(const row of daily){
  if(!row||typeof row.date!=="string"||!/^\d{4}-\d\d-\d\d$/.test(row.date)||!Number.isFinite(Date.parse(row.date+"T00:00:00Z"))||
   new Date(row.date+"T00:00:00Z").toISOString().slice(0,10)!==row.date||used.has(row.date))throw Error("INVALID_OR_DUPLICATE_STRATA_DATE");
  used.add(row.date);
  if(!(Number.isInteger(row.highCount)&&row.highCount>=10&&Number.isInteger(row.lowCount)&&row.lowCount>=10&&Number.isFinite(row.gapPp)))continue;
  const month=row.date.slice(0,7),g=groups.get(month)??[];
  g.push(row.gapPp);groups.set(month,g);
 }
 const months=[...groups].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,gaps])=>({
  month,dates:gaps.length,meanGapPp:Number((gaps.reduce((a,b)=>a+b,0)/gaps.length).toFixed(4)),positiveDates:gaps.filter(x=>x>0).length
 }));
 return {months,qualifyingMonths:months.length,positiveMeanMonths:months.filter(x=>x.meanGapPp>0).length,
  actualMarketRegimeKnown:false,readyForTraining:false,readyForTrading:false,
  warning:"Calendar months are not market regimes; benchmark returns and verified predecision market labels are required for regime claims."};
}
