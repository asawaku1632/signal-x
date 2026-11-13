// Research-only classification from J-Quants V2 financial summary rows.
// Missing, noncomparable or ambiguous statements remain UNKNOWN.
const dateOK=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'');
const numeric=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
export function classifyEarnings(current,prior){
  if(!current||!prior) return {fundamentalClass:'UNKNOWN',reason:'MISSING_PERIOD'};
  if(!dateOK(current.DiscDate)||!dateOK(prior.DiscDate)||!/^\d{2}:\d{2}:\d{2}$/.test(current.DiscTime||'')) return {fundamentalClass:'UNKNOWN',reason:'MISSING_DISCLOSURE_TIMESTAMP'};
  if(current.Code!==prior.Code || current.CurPerType!==prior.CurPerType || !['1Q','2Q','3Q','FY'].includes(current.CurPerType)) return {fundamentalClass:'UNKNOWN',reason:'PERIOD_MISMATCH'};
  if(!dateOK(current.CurPerEn)||!dateOK(prior.CurPerEn)) return {fundamentalClass:'UNKNOWN',reason:'INVALID_PERIOD_END'};
  const expected=(Number(current.CurPerEn.slice(0,4))-1)+current.CurPerEn.slice(4);
  if(prior.CurPerEn!==expected || prior.DiscDate>=current.DiscDate) return {fundamentalClass:'UNKNOWN',reason:'NONCOMPARABLE_PERIOD'};
  const op=numeric(current.OP),previous=numeric(prior.OP);
  if(op===null||previous===null||previous<=0) return {fundamentalClass:'UNKNOWN',reason:'NONPOSITIVE_OR_MISSING_BASE'};
  const yoyPct=100*(op/previous-1);
  return {fundamentalClass:yoyPct>0?'POSITIVE':yoyPct<0?'NEGATIVE':'UNKNOWN',reason:yoyPct===0?'UNCHANGED':'YOY_OPERATING_PROFIT',yoyPct};
}
