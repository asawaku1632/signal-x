// Pure research-only as-of join. Never infers provenance or five-session verification.
import {classifyMarketBreadth} from './marketBreadthShadow.mjs';
const jstDay=t=>Number.isFinite(t)?new Date(t+9*3600000).toISOString().slice(0,10):null;
const stamp=s=>{
 if(typeof s!=='string')return NaN;
 const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(s);
 if(!m)return NaN;
 const d=new Date(m[1]+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==m[1]||Number(m[2])>23||Number(m[3])>59||Number(m[4])>59)return NaN;
 if(m[5]!=='Z'&&(Number(m[5].slice(1,3))>23||Number(m[5].slice(4))>59))return NaN;
 return Date.parse(s);
};
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
  if(!/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(code??'')||!Number.isFinite(signalAt)||jstDay(signalAt)!==day||matches.length===0){
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
