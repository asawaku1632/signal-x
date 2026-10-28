// Descriptive cohort summary only; no causal or production inference.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function stats(rows){
 const values=rows.map(r=>r.return5dPct).sort((a,b)=>a-b),n=values.length;
 return {n,uniqueDates:new Set(rows.map(r=>r.tradeDate)).size,uniqueSymbols:new Set(rows.map(r=>r.code)).size,
 mean5dPct:n?values.reduce((a,b)=>a+b,0)/n:null,
 median5dPct:n?(values[Math.floor((n-1)/2)]+values[Math.floor(n/2)])/2:null,
 positiveRate:n?values.filter(x=>x>0).length/n:null};
}
export function summarizeBreadthResearchCohorts(rows,{minPerCohort=30,minDates=10}={}){
 const groups={INDEX_BREADTH_DIVERGENCE:[],OBSERVED:[]},rejections={};
 const seen=new Set(),dupes=new Set(),input=Array.isArray(rows)?rows:[];
 const key=r=>[r?.tradeDate,r?.code,r?.signalGeneratedAt].join('|');
 for(const r of input){const k=key(r);if(seen.has(k))dupes.add(k);seen.add(k);}
 for(const r of input){
  const reason=dupes.has(key(r))?'DUPLICATE':r?.eligible!==true?'EVIDENCE_NOT_VERIFIED':
   !Object.hasOwn(groups,r?.marketStatus)?'UNKNOWN_MARKET_COHORT':
   !finite(r?.return5dPct)?'INVALID_RETURN':null;
  if(reason){rejections[reason]=(rejections[reason]??0)+1;continue;}
  groups[r.marketStatus].push(r);
 }
 const divergence=stats(groups.INDEX_BREADTH_DIVERGENCE),other=stats(groups.OBSERVED);
 const adequate=divergence.n>=minPerCohort&&other.n>=minPerCohort&&
  divergence.uniqueDates>=minDates&&other.uniqueDates>=minDates;
 return {researchOnly:true,productionEligible:false,comparisonReady:adequate,
  divergence,other,rejectionCounts:rejections,
  deltaMean5dPct:adequate?divergence.mean5dPct-other.mean5dPct:null,
  warning:'Exploratory descriptive comparison only; does not establish significance or predictive edge.'};
}
