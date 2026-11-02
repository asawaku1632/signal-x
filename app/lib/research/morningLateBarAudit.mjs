/**
 * Compare immutable 09:08 morning capture with independent after-close
 * 5-minute-bar research. NEVER retroactively relabel an unavailable
 * morning decision as buy/skip, and never fabricate an executable 09:05 fill.
 */
export const MORNING_LATE_EVIDENCE_POLICY="MORNING_VS_LATE_BAR_AVAILABILITY_V1";
const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const code=x=>typeof x==="string"&&/^[0-9A-Z]{4}$/.test(x);
const positive=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
export function compareMorningAndLateBars(morningRuns,lateRuns){
  const late=new Map();
  for(const run of Array.isArray(lateRuns)?lateRuns:[]){
    const day=run?.trade_date;
    if(!date(day)||!["COMPLETE","PARTIAL"].includes(run?.status)||
       !Array.isArray(run?.results))continue;
    for(const r of run.results){
      if(!code(r?.code)||r?.date!==day)continue;
      const key=day+":"+r.code;
      if(late.has(key)){late.set(key,null);continue;}
      const entry=Array.isArray(r.entries)?r.entries.find(x=>x?.time==="09:05"):null;
      late.set(key, r.complete===true&&positive(entry?.entryPrice)&&
        positive(r.closePrice)?true:false);
    }
  }
  const visited=new Set(),daySet=new Set(),causes=new Map();
  let observed=0,unavailable=0,recoveredLate=0,neverObserved=0;
  for(const run of Array.isArray(morningRuns)?morningRuns:[]){
    if(!date(run?.trade_date)||!Array.isArray(run?.morning_observations))continue;
    for(const row of run.morning_observations){
      const key=run.trade_date+":"+String(row?.code??"");
      if(!code(row?.code)||visited.has(key))continue;
      visited.add(key);daySet.add(run.trade_date);
      if(["BUY_CANDIDATE","CAUTION","SKIP"].includes(row?.label)){observed++;continue;}
      if(row?.label!=="UNAVAILABLE")continue;
      unavailable++;
      const reason=String(row.quoteReason??"NOT_RECORDED");
      causes.set(reason,(causes.get(reason)??0)+1);
      if(late.get(key)===true)recoveredLate++;else neverObserved++;
    }
  }
  return {
    policy:MORNING_LATE_EVIDENCE_POLICY,days:daySet.size,
    morningObserved:observed,morningUnavailable:unavailable,
    lateAvailableOnly:recoveredLate,stillUnknown:neverObserved,
    reasons:[...causes].map(([reason,count])=>({reason,count})).sort((a,b)=>b.count-a.count),
    status:unavailable>0&&recoveredLate>0?"RETROSPECTIVE_BARS_ONLY":
      unavailable>0?"NO_LATE_EVIDENCE":"NO_MORNING_GAP",
    warning:"AFTER_CLOSE_DATA_DOES_NOT_VALIDATE_AN_EARLIER_BUY_DECISION",
  };
}
