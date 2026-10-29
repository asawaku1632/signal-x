/** Offline stability audit of prospective daily cohort gaps.
 * Uses equal-weighted independent trading dates; no threshold search or model update.
 */
export function auditProspectiveGapStability(report,{minDays=20}={}){
 if(!report||!Array.isArray(report.daily)||!Number.isInteger(minDays)||minDays<2)throw Error("INVALID_GAP_STABILITY_INPUT");
 const eligible=report.daily.filter(x=>Number.isInteger(x.highCount)&&x.highCount>=10&&Number.isInteger(x.lowCount)&&x.lowCount>=10&&Number.isFinite(x.gapPp));
 const unique=new Set(eligible.map(x=>x.date));
 if(unique.size!==eligible.length||eligible.some(x=>typeof x.date!=="string"||!/^\d{4}-\d\d-\d\d$/.test(x.date)))throw Error("INVALID_OR_DUPLICATE_DATE");
 const sorted=[...eligible].sort((a,b)=>a.date.localeCompare(b.date));
 const gaps=sorted.map(x=>x.gapPp);
 const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 const median=a=>a.length?([...a].sort((x,y)=>x-y)[Math.floor((a.length-1)/2)]+[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)])/2:null;
 const leaveOneOut=gaps.length>1?gaps.map((_,i)=>avg(gaps.filter((__,j)=>j!==i))):[];
 const months=new Set(sorted.map(x=>x.date.slice(0,7)));
 const positive=gaps.filter(x=>x>0).length;
 return {version:"PROSPECTIVE_GAP_STABILITY_SHADOW_V1",dates:gaps.length,months:months.size,meanGapPp:avg(gaps),medianGapPp:median(gaps),
  positiveGapDates:positive,leaveOneOutMeanRange:leaveOneOut.length?[Math.min(...leaveOneOut),Math.max(...leaveOneOut)]:null,
  status:gaps.length<minDays?"INSUFFICIENT_DATES":"DESCRIPTIVE_ONLY",
  deployable:false,independentlyAuthenticated:false,
  warning:"Post-hoc stability is descriptive: date count, authentic as-of snapshots, held-out periods and forward execution evidence are still required."};
}
