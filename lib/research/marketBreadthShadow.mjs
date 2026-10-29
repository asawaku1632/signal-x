// Research-only classifier. Strict timestamp, provider rights, and same JST trading date.
const stamp=s=>{
 if(typeof s!=='string')return NaN;
 const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(s);
 if(!m)return NaN;
 const d=new Date(m[1]+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==m[1]||Number(m[2])>23||Number(m[3])>59||Number(m[4])>59)return NaN;
 if(m[5]!=='Z'&&(Number(m[5].slice(1,3))>23||Number(m[5].slice(4))>59))return NaN;
 return Date.parse(s);
};
export function classifyMarketBreadth(input){
 const {tradeDate,observedAt,source,licenseVerified,nikkeiChangePct,topixChangePct,advancers,decliners,unchanged=0}=input??{};
 const t=stamp(observedAt);
 const jstDate=Number.isFinite(t)?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t)):null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate??'')||!Number.isFinite(t)||jstDate!==tradeDate||
  typeof source!=='string'||!source.trim()||licenseVerified!==true||
  ![nikkeiChangePct,topixChangePct,advancers,decliners,unchanged].every(x=>typeof x==='number'&&Number.isFinite(x))||
  ![advancers,decliners,unchanged].every(x=>Number.isSafeInteger(x)&&x>=0)||
  advancers+decliners+unchanged===0)
  return {status:'UNAVAILABLE',reason:'UNVERIFIED_OR_INCOMPLETE_INPUT',researchOnly:true};
 const total=advancers+decliners+unchanged,advanceRatio=advancers/total,declineRatio=decliners/total;
 const divergence=nikkeiChangePct>0&&topixChangePct<=0&&declineRatio>=0.6;
 return {status:divergence?'INDEX_BREADTH_DIVERGENCE':'OBSERVED',researchOnly:true,tradeDate,observedAt,source,
 advanceRatio,declineRatio,total,nikkeiChangePct,topixChangePct,ruleVersion:'market-breadth-shadow-v1'};
}
