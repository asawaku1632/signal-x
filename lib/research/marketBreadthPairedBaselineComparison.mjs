// Offline paired comparison on identical code, trade date and outcome horizon.
export function compareMarketBreadthPairedBaseline({pairs=[],minPairs=30,minDates=10}={}){
 if(!Array.isArray(pairs)||pairs.length>100000)throw new TypeError('INVALID_PAIRED_BASELINE');
 const rejected=[],accepted=[],keys=new Map();
 for(let index=0;index<pairs.length;index++){
  const x=pairs[index];
  const valid=x&&typeof x.code==='string'&&/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(x.code)&&typeof x.tradeDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.tradeDate)&&!Number.isNaN(Date.parse(x.tradeDate+'T00:00:00Z'))&&new Date(x.tradeDate+'T00:00:00Z').toISOString().slice(0,10)===x.tradeDate&&typeof x.signalRecordId==='string'&&typeof x.baselineRecordId==='string'&&x.signalRecordId!==x.baselineRecordId&&Number.isFinite(x.researchReturnPercent)&&Number.isFinite(x.baselineReturnPercent)&&x.horizonSessions===5&&x.researchIndependentlyAudited===true&&x.baselineIndependentlyAudited===true&&x.samePriceBasisVerified===true;
  if(!valid){rejected.push({index,reason:'UNVERIFIED_OR_UNPAIRED_BASELINE'});continue}
  const key=x.code+':'+x.tradeDate;
  const owners=keys.get(key)??[];owners.push(index);keys.set(key,owners);
  accepted.push({index,key,delta:x.researchReturnPercent-x.baselineReturnPercent});
 }
 const duplicate=new Set([...keys.values()].filter(v=>v.length>1).flat());
 const clean=accepted.filter(x=>!duplicate.has(x.index));
 for(const index of duplicate)rejected.push({index,reason:'DUPLICATE_CODE_DATE_PAIR'});
 const n=clean.length,dates=new Set(clean.map(x=>x.key.split(':')[1])),deltas=clean.map(x=>x.delta).sort((a,b)=>a-b);
 const mean=n?deltas.reduce((a,b)=>a+b,0)/n:null,median=n?(deltas[Math.floor((n-1)/2)]+deltas[Math.floor(n/2)])/2:null;
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,pairedSampleReady:n>=minPairs&&dates.size>=minDates,
  counts:{submitted:pairs.length,validPairs:n,rejected:rejected.length,tradeDates:dates.size},
  metrics:{meanPairedDeltaPercentagePoints:mean,medianPairedDeltaPercentagePoints:median,positiveDeltaRate:n?deltas.filter(x=>x>0).length/n:null},
  missing:['INDEPENDENT_PRICE_PROVENANCE_AUDIT','STATISTICAL_UNCERTAINTY','OUT_OF_SAMPLE_REPLICATION','EXECUTION_COSTS_AND_SLIPPAGE'],rejected:rejected.sort((a,b)=>a.index-b.index)};
}
