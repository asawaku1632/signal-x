/** Offline research export adapter; never fetches quotes, writes a database, or certifies caller assertions. */
import {reconcileMorningForwardLedger} from "./morningForwardLedger.mjs";
export function reviewMorningForwardExport(exportData){
 if(!exportData||typeof exportData!=="object"||Array.isArray(exportData))throw Error("INVALID_FORWARD_EXPORT");
 const {snapshots,outcomes}=exportData;
 if(!Array.isArray(snapshots)||!Array.isArray(outcomes)||snapshots.length>100000||outcomes.length>100000)throw Error("INVALID_FORWARD_EXPORT_ARRAYS");
 const audit=reconcileMorningForwardLedger({snapshots,outcomes});
 const byDate=new Map();
 for(const row of audit.paired){
  const g=byDate.get(row.tradeDate)??{date:row.tradeDate,count:0,baselineSum:0,candidateSum:0};
  g.count++;g.baselineSum+=row.baselineReturn;g.candidateSum+=row.candidateReturn;byDate.set(row.tradeDate,g);
 }
 const dates=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(g=>({
  date:g.date,pairs:g.count,baselineMean:g.baselineSum/g.count,candidateMean:g.candidateSum/g.count,
  improvementPp:(g.candidateSum-g.baselineSum)/g.count}));
 const gap=dates.length?dates.reduce((sum,d)=>sum+d.improvementPp,0)/dates.length:null;
 // Per-date observed/expected pairs keep incomplete trading dates visible.
 const expectedByDate=new Map();
 for(const x of snapshots){
  if(x&&typeof x.tradeDate==="string"&&/^\\d{4}-\\d{2}-\\d{2}$/.test(x.tradeDate)){
   expectedByDate.set(x.tradeDate,(expectedByDate.get(x.tradeDate)??0)+1);
  }
 }
 const matchedByDate=new Map(dates.map(d=>[d.date,d.pairs]));
 const dateCoverage=[...expectedByDate].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,expected])=>({
  date,expected,matched:matchedByDate.get(date)??0,coverage:(matchedByDate.get(date)??0)/expected
 }));
 const incompleteDates=dateCoverage.filter(d=>d.coverage<1).length;
 const completeDates=dateCoverage.filter(d=>d.coverage===1).length;
 const completeDayMeans=dates.filter(d=>dateCoverage.some(x=>x.date===d.date&&x.coverage===1));
 const completeDateImprovementPp=completeDayMeans.length?
  completeDayMeans.reduce((sum,d)=>sum+d.improvementPp,0)/completeDayMeans.length:null;
 const outcomeKeys=new Set(outcomes.filter(x=>x&&typeof x.experimentId==="string"&&typeof x.tradeDate==="string"&&typeof x.code==="string").map(x=>JSON.stringify([x.experimentId,x.tradeDate,x.code])));
 const snapshotKeys=new Set(snapshots.filter(x=>x&&typeof x.experimentId==="string"&&typeof x.tradeDate==="string"&&typeof x.code==="string").map(x=>JSON.stringify([x.experimentId,x.tradeDate,x.code])));
 const orphanOutcomeKeys=[...outcomeKeys].filter(k=>!snapshotKeys.has(k)).length;
 const pairCoverage=snapshots.length?audit.pairedCount/snapshots.length:null;
 const activeMonths=new Set(dates.map(d=>d.date.slice(0,7))).size;
 const blockers=[];
 if(!snapshots.length)blockers.push("NO_PREDECISION_SNAPSHOTS");
 if(!outcomes.length)blockers.push("NO_MATURED_OUTCOMES");
 if(pairCoverage===null||pairCoverage<0.9)blockers.push("INSUFFICIENT_PAIR_COVERAGE");
 if(dates.length<20)blockers.push("INSUFFICIENT_FORWARD_DATES");
 if(activeMonths<3)blockers.push("INSUFFICIENT_FORWARD_MONTHS");
 if(orphanOutcomeKeys)blockers.push("ORPHAN_OUTCOMES");
 if(incompleteDates)blockers.push("INCOMPLETE_TRADING_DATES");
 blockers.push("INDEPENDENT_SOURCE_AND_TIME_AUTHENTICATION_REQUIRED");
 return {version:"OFFLINE_MORNING_FORWARD_EXPORT_V1",input:{snapshots:snapshots.length,outcomes:outcomes.length},
  reconciledPairs:audit.pairedCount,unmatchedSnapshots:snapshots.length-audit.pairedCount,
  exclusions:audit.reasons,dates,observedDates:dates.length,observedMonths:activeMonths,
  pairCoverage,orphanOutcomeKeys,blockers,dateCoverage,incompleteDates,completeDates,
  completeDateImprovementPp,
  equalDateImprovementPp:gap,independentlyAuthenticated:false,
  decision:"DO_NOT_PROMOTE",trainingEnabled:false,notificationsEnabled:false,tradingEnabled:false,
  note:"This is an exploratory summary of caller supplied export records, not independently authenticated 09:05 predictions or trading profitability."};
}
