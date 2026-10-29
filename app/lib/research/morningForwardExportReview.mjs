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
 return {version:"OFFLINE_MORNING_FORWARD_EXPORT_V1",input:{snapshots:snapshots.length,outcomes:outcomes.length},
  reconciledPairs:audit.pairedCount,unmatchedSnapshots:snapshots.length-audit.pairedCount,
  exclusions:audit.reasons,dates,observedDates:dates.length,
  equalDateImprovementPp:gap,independentlyAuthenticated:false,
  decision:"DO_NOT_PROMOTE",trainingEnabled:false,notificationsEnabled:false,tradingEnabled:false,
  note:"This is an exploratory summary of caller supplied export records, not independently authenticated 09:05 predictions or trading profitability."};
}
