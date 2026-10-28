// Pure research-only as-of join. Never infers provenance or five-session verification.
import {classifyMarketBreadth} from './marketBreadthShadow.mjs';
const stamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s)?Date.parse(s):NaN;
export function joinMarketBreadthResearch(snapshots,signals){
 const market=new Map(),joined=[],rejected=[];
 for(const row of Array.isArray(snapshots)?snapshots:[]){
  const c=classifyMarketBreadth(row);
  if(c.status==='UNAVAILABLE')continue;
  const arr=market.get(c.tradeDate)??[];arr.push(c);market.set(c.tradeDate,arr);
 }
 for(const s of Array.isArray(signals)?signals:[]){
  const signalAt=stamp(s?.signalGeneratedAt),day=s?.tradeDate,code=s?.code;
  const matches=(market.get(day)??[]).filter(m=>stamp(m.observedAt)<signalAt);
  if(!/^[0-9]{4}[A-Z]?$/.test(code??'')||!Number.isFinite(signalAt)||matches.length===0){
   rejected.push({tradeDate:day??null,code:code??null,reason:'NO_VERIFIED_AS_OF_MATCH'});continue;
  }
  matches.sort((a,b)=>stamp(b.observedAt)-stamp(a.observedAt));
  const latest=stamp(matches[0].observedAt),atLatest=matches.filter(m=>stamp(m.observedAt)===latest);
  // Same-time duplicate observations are ambiguous; never choose arbitrarily.
  if(atLatest.length!==1){rejected.push({tradeDate:day,code,reason:'AMBIGUOUS_MARKET_OBSERVATION'});continue;}
  joined.push({tradeDate:day,code,signalGeneratedAt:s.signalGeneratedAt,
   marketObservedAt:atLatest[0].observedAt,marketStatus:atLatest[0].status,
   marketRuleVersion:atLatest[0].ruleVersion,source:atLatest[0].source,researchOnly:true});
 }
 return {researchOnly:true,joined,rejected,productionEligible:false};
}
